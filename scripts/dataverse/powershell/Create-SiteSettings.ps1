<#
  Creates the Web API site settings the SAIP tables need.

    powershell -ExecutionPolicy Bypass -File .\Create-SiteSettings.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\Create-SiteSettings.ps1

  Two settings per table (33 rows in total) that would otherwise be 33 forms
  filled in by hand in the Portal Management app.

  WHAT THESE DO. A Dataverse table is not reachable through the portal's /_api
  proxy until it has been switched on by name. Without them the Web API answers
  404, which reads like a wrong URL rather than a missing setting -- and the
  table permission, which is the other half, gives a 403 that reads like a bad
  request. Both halves are needed; this script does the first.

  SAFE TO RE-RUN. Settings are matched on name plus website and skipped if they
  already exist, so a run interrupted partway is fixed by running it again.

  NOTHING IS DELETED. A setting removed from the list below stays in the
  environment; the script says so rather than tidying up.
#>

[CmdletBinding()]
param(
  [switch] $DryRun,
  [string] $DataverseUrl,
  <# Only needed when the environment holds more than one Power Pages site. #>
  [string] $WebsiteName,
  <#
    Returns Dataverse's real error text to the browser instead of a generic
    message. Genuinely useful while setting this up, and exposes internal detail
    to anyone who can reach the site -- so it is opt-in and worth turning off
    afterwards.
  #>
  [switch] $IncludeInnerError
)

. (Join-Path $PSScriptRoot '_Common.ps1')

$schemaFile = Join-Path $script:DataDir 'schema.json'
if (-not (Test-Path $schemaFile)) { throw "Missing $schemaFile" }
$schema = Get-Content $schemaFile -Raw | ConvertFrom-Json

<#
  The settings, derived from the schema rather than typed out.

  Listing 33 names by hand would mean a table added later silently missing its
  pair -- the same failure this script exists to prevent, one level up.

  `fields` is `*` on purpose. Narrowing it to named columns is a real hardening
  step, but doing it now guarantees a column gets missed and produces a blank
  tile with no error at all. Get it working, then tighten.
#>
$settings = @()
foreach ($table in $schema.tables) {
  $settings += @{ Name = "Webapi/$($table.logicalName)/enabled"; Value = 'true' }
  $settings += @{ Name = "Webapi/$($table.logicalName)/fields";  Value = '*' }
}
if ($IncludeInnerError) {
  $settings += @{ Name = 'Webapi/error/innererror'; Value = 'true' }
}

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl$(if ($DryRun) { '   (DRY RUN -- nothing will be written)' })"

if ($DryRun) {
  Write-Host ''
  foreach ($setting in $settings) {
    Write-Host ("  + {0,-45} {1}" -f $setting.Name, $setting.Value) -ForegroundColor Green
  }
  Write-Host ''
  Write-Host "Done. $($settings.Count) would be created." -ForegroundColor Cyan
  Write-Host 'Sign in and run again without -DryRun to write them.'
  return
}

$script:Token = Get-DataverseToken
. (Join-Path $PSScriptRoot '_Portal.ps1')

$prefix  = Get-PortalPrefix
$website = Get-PortalWebsite -Name $WebsiteName
$set     = Get-PortalEntitySet "${prefix}_sitesetting"

$nameField    = "${prefix}_name"
$valueField   = "${prefix}_value"
$idField      = "${prefix}_sitesettingid"
$websiteBind  = "${prefix}_websiteid@odata.bind"

Write-Host "Website:   $($website.Name)"
Write-Host ''

$created = 0
$skipped = 0
$updated = 0

foreach ($setting in $settings) {
  # Matched on name AND website: two sites in one environment legitimately hold
  # settings of the same name, and treating them as one row would reconfigure
  # somebody else's site.
  $safeName = $setting.Name.Replace("'", "''")
  $existing = Get-Dv ("$set`?`$filter=$nameField eq '$safeName' and " +
                      "_${prefix}_websiteid_value eq $($website.Id)&`$select=$idField,$valueField")

  if (@($existing.value).Count -gt 0) {
    $row = $existing.value[0]
    if ($row.$valueField -eq $setting.Value) {
      Write-Host ("  - {0,-45} already set" -f $setting.Name) -ForegroundColor DarkGray
      $skipped++
    }
    else {
      # Present but wrong. Correcting it is the whole point of re-running.
      Patch-Dv "$set($($row.$idField))" @{ $valueField = $setting.Value } | Out-Null
      Write-Host ("  ~ {0,-45} {1} -> {2}" -f $setting.Name, $row.$valueField, $setting.Value) -ForegroundColor Yellow
      $updated++
    }
    continue
  }

  Post-Dv $set @{
    $nameField   = $setting.Name
    $valueField  = $setting.Value
    $websiteBind = "/$($website.Set)($($website.Id))"
  } | Out-Null

  Write-Host ("  + {0,-45} {1}" -f $setting.Name, $setting.Value) -ForegroundColor Green
  $created++
}

Write-Host ''
Write-Host "Done. $created created, $updated corrected, $skipped already right." -ForegroundColor Cyan
Write-Host ''
Write-Host 'Power Pages caches these. In the design studio, use Sync configuration' -ForegroundColor Yellow
Write-Host 'before testing, or the site will keep answering from the old set.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Next:  powershell -ExecutionPolicy Bypass -File .\Create-TablePermissions.ps1'
