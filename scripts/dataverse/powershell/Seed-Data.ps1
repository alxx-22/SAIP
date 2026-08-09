<#
  Seeds the SAIP demo tables.

    powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1

  Run Create-Tables.ps1 first — this needs the entity-sets.json it writes.

  SAFE TO RE-RUN. Every record is matched on its business key and updated in
  place if found, so running it twice updates rather than duplicates.

  NOTHING IS DELETED. A row removed from the fixtures stays in Dataverse; the
  script says so at the end rather than tidying up, because "the seed script
  quietly deleted my hand-edited demo record" is a bad afternoon.

  This script does no field mapping of its own. `records.json` already holds
  every record with its Dataverse column names, produced from the same
  definitions the Node seeder uses — see mappings.mjs for why.
#>

[CmdletBinding()]
param(
  [switch] $DryRun,
  [string] $DataverseUrl
)

. (Join-Path $PSScriptRoot '_Common.ps1')

$recordsFile = Join-Path $script:DataDir 'records.json'
if (-not (Test-Path $recordsFile)) { throw "Missing $recordsFile" }
$payload = Get-Content $recordsFile -Raw | ConvertFrom-Json

$entitySetsFile = Join-Path $script:DataDir 'entity-sets.json'
$entitySets = $null
if (Test-Path $entitySetsFile) {
  $entitySets = Get-Content $entitySetsFile -Raw | ConvertFrom-Json
}
elseif (-not $DryRun) {
  throw "Missing $entitySetsFile — run Create-Tables.ps1 first."
}

<#
  logical name -> entity set name, from what Dataverse actually generated.

  Never derived. It mostly pluralises with a trailing 's' but not always, and a
  wrong entity set name 404s in a way that looks like a permissions error.
#>
$setOf = @{}
if ($entitySets) {
  foreach ($row in @($entitySets)) { $setOf[$row.LogicalName] = $row.EntitySetName }
}

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl"
Write-Host "Fixtures generated on $($payload.generatedOn)$(if ($DryRun) { '   (DRY RUN)' })"
Write-Host ''

if (-not $DryRun) { $script:Token = Get-DataverseToken; Write-Host '' }

$inserted = 0
$updated  = 0

foreach ($table in $payload.tables) {
  $logicalName = $table.logicalName
  $entitySet = if ($setOf.ContainsKey($logicalName)) { $setOf[$logicalName] } else { $null }

  if (-not $entitySet) {
    if ($DryRun) {
      Write-Host ("  {0,-30} {1,4} record(s)   (entity set unknown until tables exist)" -f $logicalName, $table.records.Count) -ForegroundColor DarkGray
      $inserted += $table.records.Count
      continue
    }
    Write-Host "  ! $logicalName not in entity-sets.json — run Create-Tables.ps1 first" -ForegroundColor Yellow
    continue
  }

  $localInserted = 0
  $localUpdated  = 0

  foreach ($record in $table.records) {
    if ($DryRun) { $localInserted++; continue }

    $key = [string]$record.$($payload.keyField)
    # Escape single quotes: an account named O'Brien would otherwise break the
    # OData filter rather than simply not matching.
    $safeKey = $key.Replace("'", "''")

    $idField = "${logicalName}id"
    $existing = Get-Dv "$entitySet`?`$filter=$($payload.keyField) eq '$safeKey'&`$select=$idField"

    # ConvertFrom-Json gives a PSCustomObject; the Web API wants a plain map.
    $body = @{}
    foreach ($property in $record.PSObject.Properties) { $body[$property.Name] = $property.Value }

    if ($existing.value.Count -gt 0) {
      $id = $existing.value[0].$idField
      Patch-Dv "$entitySet($id)" $body | Out-Null
      $localUpdated++
    }
    else {
      Post-Dv $entitySet $body | Out-Null
      $localInserted++
    }
  }

  $inserted += $localInserted
  $updated  += $localUpdated
  Write-Host ("  {0,-30} {1,4} new  {2,4} updated" -f $entitySet, $localInserted, $localUpdated)
}

Write-Host ''
Write-Host "Done. $inserted created, $updated updated." -ForegroundColor Cyan
Write-Host 'Rows removed from the fixtures are left in place — delete those by hand if you want them gone.' -ForegroundColor DarkGray
