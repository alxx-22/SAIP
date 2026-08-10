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
function TryG($q){try{G $q}catch{$null}}
<# Returns the error text rather than throwing, because the whole point of this
   run is to SEE what Dataverse says about the association. #>
function Link($q,$target){
  try{Invoke-RestMethod -Method Post -Uri ($Api+$q) -Headers $H -Body (@{'@odata.id'=$target}|ConvertTo-Json -Compress) -ContentType 'application/json'|Out-Null; return $null}
  catch{
    $e=$_
    $msg=$e.Exception.Message
    if($e.ErrorDetails -and $e.ErrorDetails.Message){$d=$e.ErrorDetails.Message
      try{$j=$d|ConvertFrom-Json; if($j.PSObject.Properties['error']){$msg=$j.error.message}else{$msg=$d}}catch{$msg=$d}}
    return $msg}}

$P=if(TryG "EntityDefinitions(LogicalName='mspp_website')?`$select=LogicalName"){'mspp'}else{'adx'}
function SetOf($l){(G "EntityDefinitions(LogicalName='$l')?`$select=EntitySetName").EntitySetName}
function NameOf($l){(G "EntityDefinitions(LogicalName='$l')?`$select=PrimaryNameAttribute").PrimaryNameAttribute}

$wSet=SetOf "${P}_website"; $wName=NameOf "${P}_website"
$wid=(@((G "$wSet`?`$select=${P}_websiteid,$wName").value)|Where-Object{$_.$wName -eq $Site}|Select-Object -First 1)."${P}_websiteid"
if(-not $wid){Write-Host "No website '$Site'." -ForegroundColor Red;return}

$pE="${P}_entitypermission"; $pSet=SetOf $pE; $pName=NameOf $pE
$permIdField="${P}_entitypermissionid"
$rSet=SetOf "${P}_webrole"; $rName=NameOf "${P}_webrole"
$eF=if(TryG "EntityDefinitions(LogicalName='$pE')/Attributes(LogicalName='${P}_entitylogicalname')?`$select=LogicalName"){"${P}_entitylogicalname"}else{"${P}_entityname"}

# Show the relationship rather than assuming a direction -- the POST target
# depends on which side owns the navigation property.
$rel=(G "EntityDefinitions(LogicalName='$pE')?`$select=LogicalName&`$expand=ManyToManyRelationships").ManyToManyRelationships|Where-Object{$_.Entity1LogicalName -eq "${P}_webrole" -or $_.Entity2LogicalName -eq "${P}_webrole"}|Select-Object -First 1
Write-Host "`nRelationship : $($rel.SchemaName)"
Write-Host "  Entity1    : $($rel.Entity1LogicalName)   nav=$($rel.Entity1NavigationPropertyName)"
Write-Host "  Entity2    : $($rel.Entity2LogicalName)   nav=$($rel.Entity2NavigationPropertyName)"
$navFromPerm=if($rel.Entity1LogicalName -eq $pE){$rel.Entity1NavigationPropertyName}else{$rel.Entity2NavigationPropertyName}
$navFromRole=if($rel.Entity1LogicalName -eq $pE){$rel.Entity2NavigationPropertyName}else{$rel.Entity1NavigationPropertyName}

$roles=@((G "$rSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=${P}_webroleid,$rName").value)
$auth=$roles|Where-Object{$_.$rName -eq 'Authenticated Users'}|Select-Object -First 1
$admin=$roles|Where-Object{$_.$rName -eq 'Administrators'}|Select-Object -First 1
if(-not $auth){Write-Host "No 'Authenticated Users' role. Roles are:" -ForegroundColor Red;$roles|%{Write-Host "  $($_.$rName)"};return}

$perms=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$pName,$eF&`$expand=$navFromPerm(`$select=${P}_webroleid)").value)|Where-Object{[string]$_.$eF -like 'saip_*'}
Write-Host "`nAttaching roles to $(@($perms).Count) permission(s)...`n" -ForegroundColor Cyan

$ok=0;$fail=0
foreach($perm in $perms){
  if(@($perm.$navFromPerm).Count -gt 0){Write-Host ("  - {0,-34} already attached" -f $perm.$pName) -ForegroundColor DarkGray;$ok++;continue}
  $isAdmin=[string]$perm.$pName -like '*(admin)*'
  $role=if($isAdmin -and $admin){$admin}else{$auth}
  $rid=$role."${P}_webroleid"

  # Try from the permission side, then from the role side. One of the two owns
  # the navigation property, and which one is not worth guessing.
  $err=Link "$pSet($($perm.$permIdField))/$navFromPerm/`$ref" "$Api$rSet($rid)"
  if($err){$err2=Link "$rSet($rid)/$navFromRole/`$ref" "$Api$pSet($($perm.$permIdField))"
    if($err2){Write-Host ("  ! {0,-34} {1}" -f $perm.$pName,$err) -ForegroundColor Red
      Write-Host ("    reverse also failed: {0}" -f $err2) -ForegroundColor Red;$fail++;continue}}
  Write-Host ("  + {0,-34} -> {1}" -f $perm.$pName,$role.$rName) -ForegroundColor Green
  $ok++
}

# Read back. The POST is not evidence.
$after=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$pName,$eF&`$expand=$navFromPerm(`$select=$rName)").value)|Where-Object{[string]$_.$eF -like 'saip_*'}
$linked=@($after|Where-Object{@($_.$navFromPerm).Count -gt 0}).Count
Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "$linked of $(@($after).Count) SAIP permissions are now attached to a role." -ForegroundColor $(if($linked -eq @($after).Count){'Green'}else{'Yellow'})
if($fail -gt 0){Write-Host "$fail could not be attached -- the error is printed above." -ForegroundColor Yellow}
Write-Host "================================================`n" -ForegroundColor Cyan
}
