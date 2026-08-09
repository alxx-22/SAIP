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
Write-Host "Solution:  $script:Solution$(if ($DryRun) { '   (DRY RUN — nothing will be written)' })"
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
  Note '·' "publisher $($schema.prefix)"
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
  Note '·' "solution $script:Solution"
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
    Note '·' $table.logicalName
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
      Note '·' "  $($column.logicalName)"
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
# Power Pages site, and the error reads like a permissions problem.

Write-Host ''
Write-Host 'Publishing customisations…' -ForegroundColor Cyan
Post-Dv 'PublishAllXml' @{} | Out-Null

# ── The handoff file ─────────────────────────────────────────────────────────
# Entity SET names go in the Web API URL and are not derivable from the logical
# name with any rule worth trusting, so they are read from live metadata.

$wanted = $schema.tables | ForEach-Object { $_.logicalName }
$all = Get-Dv "EntityDefinitions?`$select=LogicalName,EntitySetName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute&`$filter=startswith(LogicalName,'$($schema.prefix)_')"
$rows = $all.value | Where-Object { $wanted -contains $_.LogicalName } |
  Select-Object LogicalName, EntitySetName, SchemaName, PrimaryIdAttribute, PrimaryNameAttribute

$outFile = Join-Path $script:DataDir 'entity-sets.json'
($rows | ConvertTo-Json -Depth 5) | Set-Content -Path $outFile -Encoding UTF8

Write-Host ''
Write-Host "Wrote $($rows.Count) entity set name(s) to $outFile" -ForegroundColor Green
Write-Host "Done. $created created, $skipped already present." -ForegroundColor Cyan
Write-Host ''
Write-Host 'Next:  powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1'
Write-Host 'Then send entity-sets.json back — it is what the app needs to call these tables.'
