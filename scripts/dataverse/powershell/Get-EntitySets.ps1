<#
  Writes generated/entity-sets.json, and nothing else.

    powershell -ExecutionPolicy Bypass -File .\Get-EntitySets.ps1

  Run this if Create-Tables.ps1 built everything but was throttled on its last
  step. It does ONE read, so it succeeds where the tail of a long metadata run
  gets 429'd -- and it creates nothing, so it is safe at any time.

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

Write-Host ''
Write-Host 'Next:  powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1'
