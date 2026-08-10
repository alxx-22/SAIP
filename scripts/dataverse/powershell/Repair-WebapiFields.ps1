& {
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$Url='https://orgb9e83276.crm.dynamics.com'
$Api="$Url/api/data/v9.2/"
$Site='SAIP - SAIP'
$FIELDS=@{
  'saip_capability'='saip_capabilityid,saip_name,createdon,modifiedon,saip_key,saip_description'
  'saip_role'='saip_roleid,saip_name,createdon,modifiedon,saip_key,saip_description,saip_isadministrator,saip_issystemmanaged,saip_capabilitykeys'
  'saip_user'='saip_userid,saip_name,createdon,modifiedon,saip_key,saip_email,saip_status,saip_lastsignin,saip_rolekeys'
  'saip_questionsection'='saip_questionsectionid,saip_name,createdon,modifiedon,saip_key,saip_description,saip_area,saip_sortorder,saip_isenabled'
  'saip_optionset'='saip_optionsetid,saip_name,createdon,modifiedon,saip_key,saip_description,saip_usage,saip_iscodedependent'
  'saip_option'='saip_optionid,saip_name,createdon,modifiedon,saip_key,saip_optionsetkey,saip_sortorder,saip_isenabled'
  'saip_question'='saip_questionid,saip_name,createdon,modifiedon,saip_key,saip_sectionkey,saip_helptext,saip_inputtype,saip_isrequired,saip_sortorder,saip_isenabled,saip_optionsetkey,saip_nameprovisional,saip_systemreferences'
  'saip_account'='saip_accountid,saip_name,createdon,modifiedon,saip_key,saip_companygroupid,saip_industry,saip_region,saip_annualservicesrevenue,saip_currencycode,saip_activecontractcount,saip_lastmeetingdate'
  'saip_servicecontract'='saip_servicecontractid,saip_name,createdon,modifiedon,saip_key,saip_accountkey,saip_sla,saip_value,saip_currencycode,saip_cities,saip_renewaldate'
  'saip_opportunity'='saip_opportunityid,saip_name,createdon,modifiedon,saip_key,saip_opportunitynumber,saip_accountkey,saip_companygroupid,saip_description,saip_stage,saip_forecastcategory,saip_closedate,saip_totalvalue,saip_currencycode,saip_ownername,saip_owneremail,saip_campaignname,saip_salesmotion'
  'saip_opportunityline'='saip_opportunitylineid,saip_name,createdon,modifiedon,saip_key,saip_opportunitynumber,saip_productcategory,saip_value,saip_currencycode'
  'saip_score'='saip_scoreid,saip_name,createdon,modifiedon,saip_key,saip_accountkey,saip_scorekey,saip_value,saip_status,saip_deltapoints,saip_explainer'
  'saip_monitoringanswer'='saip_monitoringanswerid,saip_name,createdon,modifiedon,saip_key,saip_accountkey,saip_questionkey,saip_valuedate,saip_updatedby'
  'saip_meeting'='saip_meetingid,saip_name,createdon,modifiedon,saip_key,saip_accountkey,saip_meetingdate,saip_place,saip_tags,saip_subject,saip_comments,saip_loggedby'
  'saip_incentive'='saip_incentiveid,saip_name,createdon,modifiedon,saip_key,saip_overview,saip_campaigncode,saip_type,saip_startdate,saip_enddate,saip_createdby,saip_nominatedaccountkeys,saip_assigneduserkeys,saip_assignedrolekeys'
  'saip_incentivedocument'='saip_incentivedocumentid,saip_name,createdon,modifiedon,saip_key,saip_incentivekey,saip_mimetype,saip_sizebytes,saip_sortorder,saip_uploadedon,saip_uploadedby'
}

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
$P='mspp'
$wid=(@((G "$($P)_websites?`$select=$($P)_websiteid,$($P)_name").value)|Where-Object{$_."$($P)_name" -eq $Site}|Select-Object -First 1)."$($P)_websiteid"
if(-not $wid){Write-Host "No website '$Site'." -ForegroundColor Red;return}
$rows=@((G "$($P)_sitesettings?`$filter=_$($P)_websiteid_value eq $wid&`$select=$($P)_sitesettingid,$($P)_name,$($P)_value").value)
Write-Host "`nReplacing the deprecated * with explicit column lists`n" -ForegroundColor Cyan
$done=0
foreach($t in $FIELDS.Keys|Sort-Object){
  $setting="Webapi/$t/fields"
  $row=$rows|Where-Object{$_."$($P)_name" -eq $setting}|Select-Object -First 1
  if(-not $row){
    Invoke-RestMethod -Method Post -Uri ($Api+"$($P)_sitesettings") -Headers $H -ContentType 'application/json' -Body (@{"$($P)_name"=$setting;"$($P)_value"=$FIELDS[$t];"$($P)_websiteid@odata.bind"="/$($P)_websites($wid)"}|ConvertTo-Json)|Out-Null
    Write-Host ("  + {0,-40} created" -f $setting) -ForegroundColor Green; $done++; continue}
  if($row."$($P)_value" -eq $FIELDS[$t]){Write-Host ("  - {0,-40} already explicit" -f $setting) -ForegroundColor DarkGray; continue}
  # DELETE + POST, not PATCH. In the enhanced data model mspp_sitesetting is a
  # virtual projection over powerpagecomponent, and updating through it fails
  # with "The given key was not present in the dictionary". Create works.
  try{
    Invoke-RestMethod -Method Delete -Uri ($Api+"$($P)_sitesettings($($row."$($P)_sitesettingid"))") -Headers $H|Out-Null
  }catch{
    $m=$_.Exception.Message; if($_.ErrorDetails -and $_.ErrorDetails.Message){$m=$_.ErrorDetails.Message}
    Write-Host ("  ! {0,-40} delete failed: {1}" -f $setting,$m) -ForegroundColor Red; continue}
  Invoke-RestMethod -Method Post -Uri ($Api+"$($P)_sitesettings") -Headers $H -ContentType 'application/json' -Body (@{"$($P)_name"=$setting;"$($P)_value"=$FIELDS[$t];"$($P)_websiteid@odata.bind"="/$($P)_websites($wid)"}|ConvertTo-Json)|Out-Null
  Write-Host ("  ~ {0,-40} '{1}' -> {2} columns" -f $setting,$row."$($P)_value",($FIELDS[$t] -split ',').Count) -ForegroundColor Green; $done++}
$after=@((G "$($P)_sitesettings?`$filter=_$($P)_websiteid_value eq $wid&`$select=$($P)_name,$($P)_value").value)|Where-Object{$_."$($P)_name" -like 'Webapi/*/fields'}
$stars=@($after|Where-Object{$_."$($P)_value" -eq '*'}).Count
Write-Host "`n$done changed. $($after.Count) fields settings, $stars still set to '*'." -ForegroundColor $(if($stars -eq 0){'Green'}else{'Yellow'})
Write-Host "`nNow clear the portal cache, then retry /_api/saip_capabilities" -ForegroundColor Yellow
Write-Host ''
}
