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
$P=if(TryG "EntityDefinitions(LogicalName='mspp_website')?`$select=LogicalName"){'mspp'}else{'adx'}
function SetOf($l){(G "EntityDefinitions(LogicalName='$l')?`$select=EntitySetName").EntitySetName}
function NameOf($l){(G "EntityDefinitions(LogicalName='$l')?`$select=PrimaryNameAttribute").PrimaryNameAttribute}
$wSet=SetOf "${P}_website";$wName=NameOf "${P}_website"
$wid=(@((G "$wSet`?`$select=${P}_websiteid,$wName").value)|Where-Object{$_.$wName -eq $Site}|Select-Object -First 1)."${P}_websiteid"
$pE="${P}_entitypermission";$pSet=SetOf $pE;$pName=NameOf $pE
$permIdField="${P}_entitypermissionid"
$rSet=SetOf "${P}_webrole";$rName=NameOf "${P}_webrole"
$eF=if(TryG "EntityDefinitions(LogicalName='$pE')/Attributes(LogicalName='${P}_entitylogicalname')?`$select=LogicalName"){"${P}_entitylogicalname"}else{"${P}_entityname"}
$rel=(G "EntityDefinitions(LogicalName='$pE')?`$select=LogicalName&`$expand=ManyToManyRelationships").ManyToManyRelationships|Where-Object{$_.Entity1LogicalName -eq "${P}_webrole" -or $_.Entity2LogicalName -eq "${P}_webrole"}|Select-Object -First 1
$nav=if($rel.Entity1LogicalName -eq $pE){$rel.Entity1NavigationPropertyName}else{$rel.Entity2NavigationPropertyName}
$navFromRole=if($rel.Entity1LogicalName -eq $pE){$rel.Entity2NavigationPropertyName}else{$rel.Entity1NavigationPropertyName}

Write-Host "`n== A. From the ROLE side, one record at a time ==" -ForegroundColor Cyan
<#
  The reliable shape. Dataverse does not dependably expand a collection-valued
  navigation property while returning a COLLECTION of records -- it answers with
  the rows and an empty expansion, which reads exactly like "no links". Asking
  for ONE record and expanding from there is the query that tells the truth.
#>
foreach($r in @((G "$rSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=${P}_webroleid,$rName").value)){
  $one=G "$rSet($($r."${P}_webroleid"))?`$select=$rName&`$expand=$navFromRole(`$select=$pName)"
  $names=@($one.$navFromRole|%{$_.$pName}|Where-Object{$_ -like 'SAIP *'})
  Write-Host ("  {0,-24} {1} SAIP permission(s)" -f $r.$rName,$names.Count) -ForegroundColor $(if($names.Count){'Green'}else{'Yellow'})
}

Write-Host "`n== B. From the PERMISSION side, one record at a time ==" -ForegroundColor Cyan
$perms=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$pName,$eF").value)|Where-Object{[string]$_.$eF -like 'saip_*'}
$linked=0
foreach($perm in $perms){
  $one=G "$pSet($($perm.$permIdField))?`$select=$pName&`$expand=$nav(`$select=$rName)"
  $rn=@($one.$nav|%{$_.$rName})
  if($rn.Count){$linked++}
  Write-Host ("  {0,-34} {1}" -f $perm.$pName,$(if($rn.Count){$rn -join ','}else{'NONE'})) -ForegroundColor $(if($rn.Count){'Green'}else{'Yellow'})
}
Write-Host "`n$linked of $(@($perms).Count) attached, read one record at a time." -ForegroundColor Cyan

Write-Host "`n== C. The same question asked as a COLLECTION (what I used before) ==" -ForegroundColor Cyan
$coll=@((G "$pSet`?`$filter=_${P}_websiteid_value eq $wid&`$select=$pName,$eF&`$expand=$nav(`$select=$rName)").value)|Where-Object{[string]$_.$eF -like 'saip_*'}
$collLinked=@($coll|Where-Object{@($_.$nav).Count -gt 0}).Count
Write-Host "  $collLinked of $(@($coll).Count) attached, read as a collection." -ForegroundColor Cyan
if($linked -ne $collLinked){
  Write-Host "`n  The two disagree. The per-record answer (B) is the correct one;" -ForegroundColor Yellow
  Write-Host "  the collection expand (C) is the unreliable query, and it is what" -ForegroundColor Yellow
  Write-Host "  reported 'roles=NONE' earlier." -ForegroundColor Yellow
}
Write-Host ''
}
