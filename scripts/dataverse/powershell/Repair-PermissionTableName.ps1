& {
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$Url=if($env:DATAVERSE_URL){$env:DATAVERSE_URL}else{'https://orgb9e83276.crm.dynamics.com'}
$Api="$($Url.TrimEnd('/'))/api/data/v9.2/"
$Site='SAIP - SAIP'
if($env:DATAVERSE_TOKEN){$tok=$env:DATAVERSE_TOKEN}else{
$dc=Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/105b2061-b669-4b31-92ac-24d304d195dc/oauth2/v2.0/devicecode' -Body @{client_id='04b07795-8ddb-461a-bbee-02f9e1bf7b46';scope="$Url/.default"}
Write-Host "`n  $($dc.message)`n" -ForegroundColor Cyan
try{Start-Process $dc.verification_uri|Out-Null}catch{}
$tok=$null
while(-not $tok){Start-Sleep -Seconds 5
  try{$tok=(Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/105b2061-b669-4b31-92ac-24d304d195dc/oauth2/v2.0/token' -Body @{grant_type='urn:ietf:params:oauth:grant-type:device_code';client_id='04b07795-8ddb-461a-bbee-02f9e1bf7b46';device_code=$dc.device_code}).access_token}catch{}}
Write-Host 'Signed in.' -ForegroundColor Green}
$H=@{Authorization="Bearer $tok";Accept='application/json';'OData-MaxVersion'='4.0';'OData-Version'='4.0'}
function G($q){Invoke-RestMethod -Method GET -Uri ($Api+$q) -Headers $H}
$P='mspp'; $pE="${P}_entitypermission"
$def=G "EntityDefinitions(LogicalName='$pE')?`$select=EntitySetName,PrimaryNameAttribute,PrimaryIdAttribute"
$pSet=$def.EntitySetName; $nameF=$def.PrimaryNameAttribute; $permId=$def.PrimaryIdAttribute
$wDef=G "EntityDefinitions(LogicalName='${P}_website')?`$select=EntitySetName,PrimaryNameAttribute"
$wid=(@((G "$($wDef.EntitySetName)?`$select=${P}_websiteid,$($wDef.PrimaryNameAttribute)").value)|Where-Object{$_."$($wDef.PrimaryNameAttribute)" -eq $Site}|Select-Object -First 1)."${P}_websiteid"

$cols=@((G "EntityDefinitions(LogicalName='$pE')/Attributes?`$select=LogicalName").value|%{$_.LogicalName})
$logicalF=if($cols -contains "${P}_entitylogicalname"){"${P}_entitylogicalname"}else{$null}
Write-Host "`nprimary name column : $nameF"
Write-Host "logical name column : $(if($logicalF){$logicalF}else{'(none - only the primary name holds the table)'})"

$sel="$permId,$nameF"+$(if($logicalF){",$logicalF"}else{''})
$rows=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$sel").value)

<#
  Put the real table logical name into the column Power Pages reads.

  The display name was written into it, so every permission names a table that
  does not exist -- which grants nothing, no matter which web role is attached.
  The intended table is taken from the logical-name column when the environment
  has one, and otherwise recovered from the name I generated ("SAIP <table>"
  and "SAIP <table> (admin)").
#>
$fixed=0; $ok=0; $skipped=0
foreach($r in $rows){
  $current=[string]$r.$nameF
  $target=$null
  if($logicalF -and $r.$logicalF -and ([string]$r.$logicalF) -like 'saip_*'){$target=[string]$r.$logicalF}
  elseif($current -match '^SAIP\s+(saip_[a-z]+)'){$target=$Matches[1]}

  if(-not $target){Write-Host ("  . {0,-36} not a SAIP permission, left alone" -f $current) -ForegroundColor DarkGray;$skipped++;continue}
  if($current -eq $target){Write-Host ("  - {0,-36} already correct" -f $current) -ForegroundColor DarkGray;$ok++;continue}

  Invoke-RestMethod -Method Patch -Uri ($Api+"$pSet($($r.$permId))") -Headers $H -Body (@{$nameF=$target}|ConvertTo-Json) -ContentType 'application/json'|Out-Null
  Write-Host ("  ~ {0,-36} -> {1}" -f $current,$target) -ForegroundColor Green
  $fixed++
}

# Read it back. Nothing here is trusted on the strength of a 204.
$after=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$permId,$nameF").value)
$good=@($after|Where-Object{([string]$_.$nameF) -like 'saip_*'}).Count
Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "$fixed corrected, $ok already right, $skipped skipped." -ForegroundColor Cyan
Write-Host "$good permission(s) now name a real saip_ table." -ForegroundColor $(if($good -ge 22){'Green'}else{'Yellow'})
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "`nNext: clear the portal cache at /_services/about, then reload the site." -ForegroundColor Yellow
Write-Host ''
}
