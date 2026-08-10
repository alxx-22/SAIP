& {
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$Url='https://orgb9e83276.crm.dynamics.com'
$Api="$Url/api/data/v9.2/"
$Site='SAIP - SAIP'
$dc=Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/105b2061-b669-4b31-92ac-24d304d195dc/oauth2/v2.0/devicecode' -Body @{client_id='04b07795-8ddb-461a-bbee-02f9e1bf7b46';scope="$Url/.default"}
Write-Host "`n  $($dc.message)`n" -ForegroundColor Cyan
try{Start-Process $dc.verification_uri|Out-Null}catch{}
$tok=$null
while(-not $tok){Start-Sleep -Seconds 5
  try{$tok=(Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/105b2061-b669-4b31-92ac-24d304d195dc/oauth2/v2.0/token' -Body @{grant_type='urn:ietf:params:oauth:grant-type:device_code';client_id='04b07795-8ddb-461a-bbee-02f9e1bf7b46';device_code=$dc.device_code}).access_token}catch{}}
Write-Host 'Signed in.' -ForegroundColor Green
$H=@{Authorization="Bearer $tok";Accept='application/json';'OData-MaxVersion'='4.0';'OData-Version'='4.0'}
function G($q){Invoke-RestMethod -Method GET -Uri ($Api+$q) -Headers $H}
$P='mspp'
$pE="${P}_entitypermission"

# Nothing below is guessed. Every column and navigation name is read first.
$def=G "EntityDefinitions(LogicalName='$pE')?`$select=EntitySetName,PrimaryNameAttribute,PrimaryIdAttribute"
$pSet=$def.EntitySetName; $pName=$def.PrimaryNameAttribute; $permId=$def.PrimaryIdAttribute
Write-Host "`nPermission table:" -ForegroundColor Cyan
Write-Host "  entity set   : $pSet"
Write-Host "  primary name : $pName"
Write-Host "  primary id   : $permId"

$eF=$null
foreach($c in (G "EntityDefinitions(LogicalName='$pE')/Attributes?`$select=LogicalName").value){
  if($c.LogicalName -match 'entity(logical)?name'){$eF=$c.LogicalName}}
Write-Host "  table column : $eF"

$wDef=G "EntityDefinitions(LogicalName='${P}_website')?`$select=EntitySetName,PrimaryNameAttribute"
$wid=(@((G "$($wDef.EntitySetName)?`$select=${P}_websiteid,$($wDef.PrimaryNameAttribute)").value)|Where-Object{$_."$($wDef.PrimaryNameAttribute)" -eq $Site}|Select-Object -First 1)."${P}_websiteid"

# The permission you linked in the studio.
$acct=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$permId,$pName,$eF").value)|Where-Object{$_.$eF -eq 'saip_account'}|Select-Object -First 1
if(-not $acct){Write-Host "`nNo saip_account permission found." -ForegroundColor Red;return}
Write-Host "`nsaip_account permission: $($acct.$pName)" -ForegroundColor Cyan
Write-Host "  id: $($acct.$permId)"

<#
  Expand EVERY many-to-many navigation property on this table and see which one
  actually holds the link the studio made. Picking the first relationship that
  merely mentions a web role is what I did before, and it is a guess.
#>
$rels=(G "EntityDefinitions(LogicalName='$pE')?`$select=LogicalName&`$expand=ManyToManyRelationships").ManyToManyRelationships
Write-Host "`nMany-to-many relationships on $pE :" -ForegroundColor Cyan
foreach($r in $rels){
  $nav=if($r.Entity1LogicalName -eq $pE){$r.Entity1NavigationPropertyName}else{$r.Entity2NavigationPropertyName}
  $other=if($r.Entity1LogicalName -eq $pE){$r.Entity2LogicalName}else{$r.Entity1LogicalName}
  $count='?'
  try{
    $one=G "$pSet($($acct.$permId))?`$expand=$nav"
    $count=@($one.$nav).Count
  }catch{$count="expand failed: $($_.Exception.Message)"}
  $flag=if($count -is [int] -and $count -gt 0){'  <== THE LINK IS HERE'}else{''}
  Write-Host ("  {0,-46} -> {1,-24} rows={2}{3}" -f $nav,$other,$count,$flag) -ForegroundColor $(if($flag){'Green'}else{'Gray'})
}

# And the same from the role side, in case it only resolves that way.
$rDef=G "EntityDefinitions(LogicalName='${P}_webrole')?`$select=EntitySetName,PrimaryNameAttribute"
$auth=@((G "$($rDef.EntitySetName)?`$filter=_${P}_websiteid_value eq $wid&`$select=${P}_webroleid,$($rDef.PrimaryNameAttribute)").value)|Where-Object{$_."$($rDef.PrimaryNameAttribute)" -eq 'Authenticated Users'}|Select-Object -First 1
Write-Host "`nFrom the 'Authenticated Users' role:" -ForegroundColor Cyan
foreach($r in (G "EntityDefinitions(LogicalName='${P}_webrole')?`$select=LogicalName&`$expand=ManyToManyRelationships").ManyToManyRelationships){
  $nav=if($r.Entity1LogicalName -eq "${P}_webrole"){$r.Entity1NavigationPropertyName}else{$r.Entity2NavigationPropertyName}
  $other=if($r.Entity1LogicalName -eq "${P}_webrole"){$r.Entity2LogicalName}else{$r.Entity1LogicalName}
  if($other -ne $pE){continue}
  try{$one=G "$($rDef.EntitySetName)($($auth."${P}_webroleid"))?`$expand=$nav"
    Write-Host ("  {0,-46} rows={1}" -f $nav,@($one.$nav).Count) -ForegroundColor $(if(@($one.$nav).Count){'Green'}else{'Gray'})}
  catch{Write-Host ("  {0,-46} expand failed: {1}" -f $nav,$_.Exception.Message) -ForegroundColor Yellow}
}
Write-Host ''
}
