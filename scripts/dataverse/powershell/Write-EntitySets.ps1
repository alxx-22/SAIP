<#
  Writes generated/entity-sets.json from live metadata.

  Dot-sourced by Create-Tables.ps1 and Get-EntitySets.ps1, so the two cannot
  disagree about what the handoff file contains.

  Entity SET names go in the Web API URL and are NOT derivable from the logical
  name with any rule worth trusting -- Dataverse mostly appends 's' but not
  always, and a wrong one 404s in a way that reads like a permissions error.
  So they are read from the service rather than guessed.

  TWO STRATEGIES, because one filtered scan is the most throttle-prone shape of
  request there is. `EntityDefinitions?$filter=startswith(...)` walks the whole
  metadata catalogue, and right after a large metadata change -- exactly when
  this runs -- Dataverse 429s it for minutes at a time.

  So: try the scan once, and if it will not go through, read the 16 tables one
  at a time instead. Each of those is a keyed lookup, small enough to slip
  through throttling that blocks the scan, and a single table failing only
  costs that table rather than the whole file.
#>

function Write-EntitySets {
  param([Parameter(Mandatory)] $Schema)

  $wanted = @($Schema.tables | ForEach-Object { $_.logicalName })
  $rows = @()

  # -- Strategy 1: one scan ---------------------------------------------------
  try {
    Write-Host 'Reading entity set names...' -ForegroundColor Cyan
    # Two attempts, not ten. If the scan is being throttled it will keep being
    # throttled, and the per-table reads below are the thing that works -- so
    # get to them in ~6 seconds rather than after four minutes of waiting.
    $all = Get-Dv ("EntityDefinitions?`$select=LogicalName,EntitySetName,SchemaName," +
                   "PrimaryIdAttribute,PrimaryNameAttribute&`$filter=startswith(LogicalName,'$($Schema.prefix)_')") `
                  -MaxAttempts 2
    $rows = @($all.value | Where-Object { $wanted -contains $_.LogicalName })
  }
  catch {
    Write-Host ''
    Write-Host 'The filtered read did not get through. Falling back to one request' -ForegroundColor Yellow
    Write-Host 'per table, which is smaller and usually will.' -ForegroundColor Yellow
    Write-Host ''
    $rows = @()
  }

  # -- Strategy 2: one keyed lookup per table ---------------------------------
  if ($rows.Count -lt $wanted.Count) {
    foreach ($logicalName in $wanted) {
      if ($rows | Where-Object { $_.LogicalName -eq $logicalName }) { continue }
      try {
        $one = Get-Dv ("EntityDefinitions(LogicalName='$logicalName')" +
                       "?`$select=LogicalName,EntitySetName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute")
        if ($one) {
          $rows += $one
          Write-Host "  + $logicalName -> $($one.EntitySetName)" -ForegroundColor Green
        }
      }
      catch {
        Write-Host "  ! $logicalName could not be read: $($_.Exception.Message)" -ForegroundColor Yellow
      }
    }
  }

  $out = @($rows | Select-Object LogicalName, EntitySetName, SchemaName, PrimaryIdAttribute, PrimaryNameAttribute |
           Sort-Object LogicalName)

  if ($out.Count -eq 0) {
    throw 'No entity set names could be read. Wait a few minutes and run Get-EntitySets.ps1 again.'
  }

  $outFile = Join-Path $script:DataDir 'entity-sets.json'
  <#
    Written WITHOUT a byte order mark.

    `Set-Content -Encoding UTF8` writes one on Windows PowerShell 5.1. PowerShell
    reads it back happily, so nothing here noticed -- but a BOM makes the file
    invalid JSON per RFC 8259, and this is a handoff file meant to be read by
    other tools. Node's JSON.parse rejects it outright.
  #>
  [System.IO.File]::WriteAllText(
    $outFile,
    ($out | ConvertTo-Json -Depth 5),
    (New-Object System.Text.UTF8Encoding $false)
  )

  Write-Host ''
  Write-Host "Wrote $($out.Count) entity set name(s) to $outFile" -ForegroundColor Green

  if ($out.Count -lt $wanted.Count) {
    $missing = $wanted | Where-Object { $out.LogicalName -notcontains $_ }
    Write-Host ''
    Write-Host "Expected $($wanted.Count). Still missing: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host 'Those are usually still publishing. Run Get-EntitySets.ps1 again in a few' -ForegroundColor Yellow
    Write-Host 'minutes -- it will fill in the gaps.' -ForegroundColor Yellow
  }
}
