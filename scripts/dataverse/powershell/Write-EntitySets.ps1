<#
  Writes generated/entity-sets.json from live metadata.

  Dot-sourced by Create-Tables.ps1 and by Get-EntitySets.ps1, so the two cannot
  disagree about what the handoff file contains.

  Entity SET names go in the Web API URL and are NOT derivable from the logical
  name with any rule worth trusting -- Dataverse mostly appends 's' but not
  always, and a wrong one 404s in a way that reads like a permissions error.
  So they are read from the service rather than guessed.
#>

function Write-EntitySets {
  param([Parameter(Mandatory)] $Schema)

  $wanted = $Schema.tables | ForEach-Object { $_.logicalName }

  $all = Get-Dv ("EntityDefinitions?`$select=LogicalName,EntitySetName,SchemaName," +
                 "PrimaryIdAttribute,PrimaryNameAttribute&`$filter=startswith(LogicalName,'$($Schema.prefix)_')")

  $rows = $all.value |
    Where-Object { $wanted -contains $_.LogicalName } |
    Select-Object LogicalName, EntitySetName, SchemaName, PrimaryIdAttribute, PrimaryNameAttribute

  $outFile = Join-Path $script:DataDir 'entity-sets.json'
  ($rows | ConvertTo-Json -Depth 5) | Set-Content -Path $outFile -Encoding UTF8

  Write-Host ''
  Write-Host "Wrote $(@($rows).Count) entity set name(s) to $outFile" -ForegroundColor Green

  if (@($rows).Count -lt $wanted.Count) {
    Write-Host ("Expected $($wanted.Count). Missing tables are usually still publishing -- " +
                'wait a minute and run Get-EntitySets.ps1 again.') -ForegroundColor Yellow
  }
}
