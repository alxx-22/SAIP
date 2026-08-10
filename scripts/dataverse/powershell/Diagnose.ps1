& {
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$Url=if($env:DATAVERSE_URL){$env:DATAVERSE_URL}else{'https://orgb9e83276.crm.dynamics.com'}
$Api="$($Url.TrimEnd('/'))/api/data/v9.2/"
$Site='SAIP - SAIP'
if($env:DATAVERSE_TOKEN){$tok=$env:DATAVERSE_TOKEN}else{
  $d=Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/105b2061-b669-4b31-92ac-24d304d195dc/oauth2/v2.0/devicecode' -Body @{client_id='04b07795-8ddb-461a-bbee-02f9e1bf7b46';scope="$Url/.default"}
  Write-Host "`n  $($d.message)`n" -ForegroundColor Cyan
  try{Start-Process $d.verification_uri|Out-Null}catch{}
  $tok=$null
  while(-not $tok){
    Start-Sleep -Seconds 5
    try{$tok=(Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/105b2061-b669-4b31-92ac-24d304d195dc/oauth2/v2.0/token' -Body @{grant_type='urn:ietf:params:oauth:grant-type:device_code';client_id='04b07795-8ddb-461a-bbee-02f9e1bf7b46';device_code=$d.device_code}).access_token}catch{}
  }
  Write-Host 'Signed in.' -ForegroundColor Green
}
function G($p){Invoke-RestMethod -Method GET -Uri ($Api+$p) -Headers @{Authorization="Bearer $tok";Accept='application/json';'OData-MaxVersion'='4.0';'OData-Version'='4.0'}}
function Try-G($p){try{G $p}catch{$null}}

$P=if(Try-G "EntityDefinitions(LogicalName='mspp_website')?`$select=LogicalName"){'mspp'}else{'adx'}
function Set-Of($l){(G "EntityDefinitions(LogicalName='$l')?`$select=EntitySetName").EntitySetName}
function Name-Of($l){(G "EntityDefinitions(LogicalName='$l')?`$select=PrimaryNameAttribute").PrimaryNameAttribute}

$wSet=Set-Of "${P}_website"; $wName=Name-Of "${P}_website"
$sites=@((G "$wSet`?`$select=${P}_websiteid,$wName").value)
$w=$sites|Where-Object{$_.$wName -eq $Site}|Select-Object -First 1
if(-not $w){Write-Host "`nNo website called '$Site'. Found:" -ForegroundColor Yellow;$sites|%{Write-Host "  $($_.$wName)"};return}
$wid=$w."${P}_websiteid"

Write-Host "`n================ SAIP DIAGNOSTIC ================" -ForegroundColor Cyan
Write-Host "Model    : $P"
Write-Host "Website  : $Site"
Write-Host "WebsiteId: $wid"

# 1. Can anyone sign in?
Write-Host "`n-- 1. AUTHENTICATION --------------------------------" -ForegroundColor Cyan
$ssSet=Set-Of "${P}_sitesetting"; $ssName=Name-Of "${P}_sitesetting"
$ss=@((G "$ssSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$ssName,${P}_value").value)
$auth=@($ss|Where-Object{$_.$ssName -like 'Authentication/*'})
Write-Host "Site settings on this website : $($ss.Count)"
Write-Host "  of which Webapi/*           : $(@($ss|Where-Object{$_.$ssName -like 'Webapi/*'}).Count)"
Write-Host "  of which Authentication/*   : $($auth.Count)"
if($auth.Count -eq 0){Write-Host "  NO authentication settings -> the site may have no identity provider." -ForegroundColor Yellow}
else{$auth|Select-Object -First 12|%{Write-Host "    $($_.$ssName)"}}

# 2. Is there a contact?
Write-Host "`n-- 2. CONTACTS --------------------------------------" -ForegroundColor Cyan
$total=@((G "contacts?`$select=contactid&`$top=50").value).Count
Write-Host "Contacts in environment (first 50 counted): $total"
$hpe=@((G "contacts?`$filter=contains(emailaddress1,'hpe.com')&`$select=fullname,emailaddress1&`$orderby=createdon desc&`$top=15").value)
if($hpe.Count -eq 0){Write-Host "  none with an hpe.com email" -ForegroundColor Yellow}
else{$hpe|%{Write-Host ("    {0,-30} {1}" -f $_.fullname,$_.emailaddress1)}}
$ext=Try-G "${P}_externalidentities?`$select=${P}_username&`$top=15"
if($ext){Write-Host "External identities (a completed sign-in creates one): $(@($ext.value).Count)"
  @($ext.value)|%{Write-Host "    $($_."${P}_username")"}}
else{Write-Host "External identities: table not readable or empty" -ForegroundColor DarkGray}

# 3. Web roles
Write-Host "`n-- 3. WEB ROLES -------------------------------------" -ForegroundColor Cyan
$rSet=Set-Of "${P}_webrole"; $rName=Name-Of "${P}_webrole"
$roles=@((G "$rSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$rName,${P}_authenticatedusersrole,${P}_anonymoususersrole").value)
foreach($r in $roles){
  $tags=@()
  if($r."${P}_authenticatedusersrole"){$tags+='AUTHENTICATED-default'}
  if($r."${P}_anonymoususersrole"){$tags+='ANONYMOUS-default'}
  Write-Host ("  {0,-34} {1}" -f $r.$rName,($tags -join ', '))
}

# 4. Permissions and their role links
Write-Host "`n-- 4. TABLE PERMISSIONS -----------------------------" -ForegroundColor Cyan
$pE="${P}_entitypermission"; $pSet=Set-Of $pE; $pName=Name-Of $pE
$eF=if(Try-G "EntityDefinitions(LogicalName='$pE')/Attributes(LogicalName='${P}_entitylogicalname')?`$select=LogicalName"){"${P}_entitylogicalname"}else{"${P}_entityname"}
$rel=(G "EntityDefinitions(LogicalName='$pE')?`$select=LogicalName&`$expand=ManyToManyRelationships").ManyToManyRelationships|Where-Object{$_.Entity1LogicalName -eq "${P}_webrole" -or $_.Entity2LogicalName -eq "${P}_webrole"}|Select-Object -First 1
$nav=if($rel.Entity1LogicalName -eq $pE){$rel.Entity1NavigationPropertyName}else{$rel.Entity2NavigationPropertyName}
$globalScope=((G "EntityDefinitions(LogicalName='$pE')/Attributes(LogicalName='${P}_scope')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet").OptionSet.Options|Where-Object{$_.Label.UserLocalizedLabel.Label -eq 'Global'}).Value
$perms=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$pName,$eF,${P}_scope,${P}_read&`$expand=$nav(`$select=$rName)").value)
$saip=@($perms|Where-Object{[string]$_.$eF -like 'saip_*'})
Write-Host "SAIP permissions on this website: $($saip.Count)"
$noRole=0
# NOT $p. PowerShell variable names are case-insensitive, so a loop variable
# called $p IS $P -- the prefix -- and every "${P}_scope" lookup silently
# became a property that does not exist.
foreach($perm in ($saip|Sort-Object {$_.$eF})){
  $rn=@($perm.$nav|%{$_.$rName})
  if($rn.Count -eq 0){$noRole++}
  $scopeOk=if($perm."${P}_scope" -eq $globalScope){'Global'}else{"OTHER($($perm."${P}_scope"))"}
  Write-Host ("  {0,-24} {1,-14} read={2,-6} roles={3}" -f $perm.$eF,$scopeOk,$perm."${P}_read",$(if($rn.Count){$rn -join ','}else{'NONE'})) -ForegroundColor $(if($rn.Count){'Green'}else{'Yellow'})
}

Write-Host "`n-- VERDICT ------------------------------------------" -ForegroundColor Cyan
if($saip.Count -eq 0){Write-Host "No SAIP permissions on THIS website." -ForegroundColor Yellow}
elseif($noRole -gt 0){Write-Host "$noRole permission(s) attached to no role -> they grant nothing." -ForegroundColor Yellow}
elseif($total -eq 0){Write-Host "Permissions are fine. NOBODY has ever signed in (no contacts)," -ForegroundColor Yellow
  Write-Host "so you are browsing as an anonymous visitor, who holds none of these roles." -ForegroundColor Yellow}
else{Write-Host "Permissions and roles look correct. If /_api still refuses you, you are" -ForegroundColor Yellow
  Write-Host "browsing the site signed OUT, or the portal cache has not been cleared." -ForegroundColor Yellow}
Write-Host "=====================================================`n" -ForegroundColor Cyan
}
