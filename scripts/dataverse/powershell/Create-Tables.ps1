<#
  Creates the SAIP demo tables in Dataverse.

    powershell -ExecutionPolicy Bypass -File .\Create-Tables.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\Create-Tables.ps1

  -DryRun makes NO network calls and needs no sign-in. It prints the whole plan,
  so the schema can be reviewed before anyone has access.

  SAFE TO RE-RUN. Every step checks first and skips what already exists, so a
  run interrupted partway — the normal failure across ~120 metadata calls — is
  fixed by running it again.

  NOTHING IS EVER DELETED. Dropping a table takes its data with it, and a script
  that can do that by accident is not one to leave lying around. Delete tables
  from the maker portal, deliberately.
#>

[CmdletBinding()]
param(
  [switch] $DryRun,
  [string] $DataverseUrl
)

. (Join-Path $PSScriptRoot '_Common.ps1')

$schemaFile = Join-Path $script:DataDir 'schema.json'
if (-not (Test-Path $schemaFile)) { throw "Missing $schemaFile" }
$schema = Get-Content $schemaFile -Raw | ConvertFrom-Json

$created = 0
$skipped = 0
function Note($mark, $text, $detail = '') {
  $colour = if ($mark -eq '+') { 'Green' } elseif ($mark -eq '·') { 'DarkGray' } else { 'Yellow' }
  Write-Host ("  {0} {1}{2}" -f $mark, $text, $(if ($detail) { "  $detail" } else { '' })) -ForegroundColor $colour
}

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl"
Write-Host "Solution:  $script:Solution$(if ($DryRun) { '   (DRY RUN -- nothing will be written)' })"
Write-Host ''

if ($DryRun) {
  Note '+' "publisher $($schema.prefix)" '(dry run)'
  Note '+' "solution $script:Solution" '(dry run)'
  # Counted, so the dry-run total matches what the Node script reports.
  $created += 2
  Write-Host ''
  foreach ($table in $schema.tables) {
    Note '+' $table.logicalName $(if ($table.hasNotes) { '(notes enabled, dry run)' } else { '(dry run)' })
    $created++
    foreach ($column in $table.columns) {
      Note '+' "  $($column.logicalName)" "($($column.kind), dry run)"
      $created++
    }
  }
  Write-Host ''
  Write-Host "Done. $created would be created." -ForegroundColor Cyan
  return
}

$script:Token = Get-DataverseToken

# ── Publisher and solution ───────────────────────────────────────────────────
# The publisher owns the `saip_` prefix, and both must exist before any table,
# or the tables land in the Default Solution and become painful to move to
# another environment later.

$existingPublisher = Get-Dv "publishers?`$filter=uniquename eq '$($schema.prefix)'&`$select=publisherid"
if ($existingPublisher.value.Count -gt 0) {
  $publisherId = $existingPublisher.value[0].publisherid
  Note '-' "publisher $($schema.prefix)"
  $skipped++
}
else {
  $body = @{
    uniquename                     = $schema.prefix
    friendlyname                   = 'SAIP'
    description                    = 'Services Account Intelligence Portal'
    customizationprefix            = $schema.prefix
    customizationoptionvalueprefix = 74100
  }
  $publisherId = (Post-Dv 'publishers' $body @{ Prefer = 'return=representation' }).publisherid
  Note '+' "publisher $($schema.prefix)"
  $created++
}

<#
  NOT $solution. PowerShell variable names are case-insensitive, so `$solution`
  and `$script:Solution` are the SAME variable — assigning the lookup result to
  it silently replaced the solution name, and every later reference printed the
  HTTP response instead.
#>
$existingSolution = Get-Dv "solutions?`$filter=uniquename eq '$script:Solution'&`$select=solutionid"
if ($existingSolution.value.Count -gt 0) {
  Note '-' "solution $script:Solution"
  $skipped++
}
else {
  $body = @{
    uniquename              = $script:Solution
    friendlyname            = 'SAIP Demo Data'
    version                 = '1.0.0.0'
    'publisherid@odata.bind' = "/publishers($publisherId)"
  }
  Post-Dv 'solutions' $body @{ Prefer = 'return=representation' } | Out-Null
  Note '+' "solution $script:Solution"
  $created++
}

Write-Host ''

# ── Tables and columns ───────────────────────────────────────────────────────

foreach ($table in $schema.tables) {
  $exists = Get-Dv "EntityDefinitions(LogicalName='$($table.logicalName)')?`$select=LogicalName" -AllowNotFound

  if ($exists) {
    Note '-' $table.logicalName
    $skipped++
  }
  else {
    Post-Dv 'EntityDefinitions' $table.entity $script:SolutionHeader | Out-Null
    Note '+' $table.logicalName $(if ($table.hasNotes) { '(notes enabled)' } else { '' })
    $created++
  }

  foreach ($column in $table.columns) {
    $columnExists = Get-Dv `
      "EntityDefinitions(LogicalName='$($table.logicalName)')/Attributes(LogicalName='$($column.logicalName)')?`$select=LogicalName" `
      -AllowNotFound

    if ($columnExists) {
      Note '-' "  $($column.logicalName)"
      $skipped++
      continue
    }

    Post-Dv "EntityDefinitions(LogicalName='$($table.logicalName)')/Attributes" `
      $column.attribute $script:SolutionHeader | Out-Null
    Note '+' "  $($column.logicalName)" "($($column.kind))"
    $created++
  }
}

# ── Publish ──────────────────────────────────────────────────────────────────
# Without this a table exists in the maker portal but cannot be added to a
# -- Publish, and the handoff file ------------------------------------------
#
# Everything above has already succeeded by this point. These last two steps
# are the ones Dataverse throttles hardest, because they follow a large
# metadata burst -- so a failure HERE must not be reported as a failed run.
# It is caught, explained, and pointed at the script that redoes just this bit.

Write-Host ''
Write-Host "Created $created, skipped $skipped." -ForegroundColor Cyan

try {
  Write-Host 'Publishing customisations...' -ForegroundColor Cyan
  Post-Dv 'PublishAllXml' @{} | Out-Null

  . (Join-Path $PSScriptRoot 'Write-EntitySets.ps1')
  Write-EntitySets -Schema $schema
}
catch {
  Write-Host ''
  Write-Host 'The tables were created, but the final step did not finish:' -ForegroundColor Yellow
  Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'This is throttling after a large metadata change, not a failure of the' -ForegroundColor Yellow
  Write-Host 'creates. Wait a minute, then run:' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '    powershell -ExecutionPolicy Bypass -File .\Get-EntitySets.ps1' -ForegroundColor White
  Write-Host ''
  exit 1
}

Write-Host ''
Write-Host 'Next:  powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1'
Write-Host 'Then send entity-sets.json back -- it is what the app needs to call these tables.'
