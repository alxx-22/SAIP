<#
  Writes generated/entity-sets.json, and nothing else.

    powershell -ExecutionPolicy Bypass -File .\Get-EntitySets.ps1

  Run this if Create-Tables.ps1 built everything but was throttled on its last
  step. It creates nothing, so it is safe to run at any time, as often as you
  like.

  It reads small and falls back smaller -- see Write-EntitySets.ps1 -- so it
  gets through throttling that the tail of a long metadata run does not.

  This is the file to send back: the logical and entity-set names the front end
  needs to call these tables.
#>

[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot '_Common.ps1')
. (Join-Path $PSScriptRoot 'Write-EntitySets.ps1')

$schemaFile = Join-Path $script:DataDir 'schema.json'
if (-not (Test-Path $schemaFile)) { throw "Missing $schemaFile" }
$schema = Get-Content $schemaFile -Raw | ConvertFrom-Json

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl"

$script:Token = Get-DataverseToken

Write-EntitySets -Schema $schema

<#
  Publish, but only after the file is safely on disk.

  If Create-Tables.ps1 was throttled at its tail, PublishAllXml may not have
  run either -- and an unpublished table cannot be added to a Power Pages site,
  failing with an error that reads like a permissions problem. So retry it here.

  Non-fatal on purpose: the file above is what this script exists to produce,
  and losing it to a 429 on a step that can be redone from the maker portal
  ("Publish all customizations") would be the wrong trade.
#>
try {
  Write-Host ''
  Write-Host 'Publishing customisations...' -ForegroundColor Cyan
  Post-Dv 'PublishAllXml' @{} | Out-Null
  Write-Host 'Published.' -ForegroundColor Green
}
catch {
  Write-Host ''
  Write-Host 'Publish did not get through -- entity-sets.json above is still good.' -ForegroundColor Yellow
  Write-Host 'Run this script again later, or use Publish all customizations in the' -ForegroundColor Yellow
  Write-Host 'maker portal.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Next:  powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1'
