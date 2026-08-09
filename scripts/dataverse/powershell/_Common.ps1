<#
  Shared plumbing for the SAIP Dataverse scripts.

  Dot-sourced by Create-Tables.ps1 and Seed-Data.ps1. Not run directly.

  WHY POWERSHELL AT ALL. There is a Node version of these scripts that is
  easier to read. It needs Node installed, and Azure CLI for a token — two
  installs that a managed corporate laptop may simply not allow. PowerShell 5.1
  ships with Windows and `Invoke-RestMethod` is in the box, so this version
  needs nothing.

  NOTHING HERE IS STORED. The token lives in a process variable for the life of
  the script and is never written to disk.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 still defaults to TLS 1.0 on some builds, and every
# Microsoft endpoint below refuses that. Without this line the first call fails
# with a bare "connection was closed" that says nothing about why.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── Configuration ────────────────────────────────────────────────────────────

<#
  Read through Get-Variable, not by naming it directly.

  `Set-StrictMode -Version Latest` makes referencing a variable that was never
  assigned a terminating error. Scripts that declare a -DataverseUrl parameter
  create it implicitly, so the direct test worked in those and threw in the one
  script that does not -- a trap that only shows up when a new entry point is
  added. This form is correct regardless of the caller.
#>
$fromCaller = Get-Variable -Name DataverseUrl -Scope Script -ValueOnly -ErrorAction SilentlyContinue
if (-not $fromCaller) {
  $fromCaller = if ($env:DATAVERSE_URL) { $env:DATAVERSE_URL }
                else { 'https://orgb9e83276.crm.dynamics.com' }
}
$script:DataverseUrl = $fromCaller
$script:DataverseUrl = $script:DataverseUrl.TrimEnd('/')
$script:ApiRoot      = "$script:DataverseUrl/api/data/v9.2/"
$script:Solution     = if ($env:DATAVERSE_SOLUTION) { $env:DATAVERSE_SOLUTION } else { 'SAIPDemo' }

# The tenant, taken from the DLP error message the portal produced earlier.
# `organizations` also works; a specific tenant id just skips a redirect.
$script:TenantId = if ($env:DATAVERSE_TENANT) { $env:DATAVERSE_TENANT }
                   else { '105b2061-b669-4b31-92ac-24d304d195dc' }

<#
  The Azure CLI's own public client id.

  Deliberate: it exists in every tenant, is already consented for Dataverse —
  that is exactly what `az account get-access-token --resource <dataverse>`
  does — and it is a PUBLIC client, so device code works with no secret and no
  app registration of your own.

  Override with DATAVERSE_CLIENT_ID if your tenant blocks it.
#>
$script:ClientId = if ($env:DATAVERSE_CLIENT_ID) { $env:DATAVERSE_CLIENT_ID }
                   else { '04b07795-8ddb-461a-bbee-02f9e1bf7b46' }

# ── Token ────────────────────────────────────────────────────────────────────

<#
  Device code flow.

  Prints a code, you paste it into a browser, the script polls until you have
  signed in. No CLI, no module, no secret — and it handles MFA and conditional
  access because the sign-in happens in a real browser.
#>
function Get-DataverseToken {
  if ($env:DATAVERSE_TOKEN) {
    Write-Host "Using DATAVERSE_TOKEN from the environment." -ForegroundColor DarkGray
    return $env:DATAVERSE_TOKEN
  }

  $deviceCodeUrl = "https://login.microsoftonline.com/$script:TenantId/oauth2/v2.0/devicecode"
  $tokenUrl      = "https://login.microsoftonline.com/$script:TenantId/oauth2/v2.0/token"

  $request = Invoke-RestMethod -Method Post -Uri $deviceCodeUrl -Body @{
    client_id = $script:ClientId
    scope     = "$script:DataverseUrl/.default offline_access"
  }

  Write-Host ''
  Write-Host '  ------------------------------------------------------------'
  Write-Host "  $($request.message)" -ForegroundColor Cyan
  Write-Host '  ------------------------------------------------------------'
  Write-Host ''

  # Opening the browser is a convenience, not a requirement — the message above
  # has the URL if this is blocked.
  try { Start-Process $request.verification_uri | Out-Null } catch { }

  $deadline = (Get-Date).AddSeconds([int]$request.expires_in)
  $interval = [int]$request.interval
  if ($interval -lt 1) { $interval = 5 }

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds $interval
    try {
      $response = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body @{
        grant_type  = 'urn:ietf:params:oauth:grant-type:device_code'
        client_id   = $script:ClientId
        device_code = $request.device_code
      }
      Write-Host 'Signed in.' -ForegroundColor Green
      return $response.access_token
    }
    catch {
      # "authorization_pending" is the normal answer until you finish signing
      # in. "slow_down" means back off. Anything else is a real failure and
      # waiting longer will not fix it.
      $detail = $null
      if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        try { $detail = $_.ErrorDetails.Message | ConvertFrom-Json } catch { }
      }
      $code = if ($detail) { $detail.error } else { 'unknown' }

      switch ($code) {
        'authorization_pending' { continue }
        'slow_down'             { $interval += 5; continue }
        default {
          $description = if ($detail) { $detail.error_description } else { $_.Exception.Message }
          throw "Sign-in failed ($code): $description"
        }
      }
    }
  }
  throw 'Sign-in timed out. Run the script again.'
}

# ── Web API ──────────────────────────────────────────────────────────────────

<#
  One request, with the retry Dataverse actually needs.

  429 is normal across a hundred-odd metadata calls, and the service says how
  long to wait, so honour that rather than guessing. Everything else fails
  loudly — a silent retry on a 400 just repeats a bad payload.
#>
function Invoke-Dv {
  param(
    [Parameter(Mandatory)][string] $Method,
    [Parameter(Mandatory)][string] $Path,
    $Body,
    [hashtable] $ExtraHeaders = @{},
    [switch] $AllowNotFound,
    <#
      How hard to try before giving up.

      Default 10 (~4 minutes) suits a call that has to succeed. A caller with a
      cheaper alternative should pass a small number instead: spending the full
      budget on a request you are going to abandon anyway just delays the thing
      that would have worked.
    #>
    [int] $MaxAttempts = 10
  )

  $uri = if ($Path -like 'http*') { $Path } else { $script:ApiRoot + $Path }

  $headers = @{
    Authorization      = "Bearer $script:Token"
    Accept             = 'application/json'
    'OData-MaxVersion' = '4.0'
    'OData-Version'    = '4.0'
  }
  foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }

  $json = $null
  if ($null -ne $Body) { $json = $Body | ConvertTo-Json -Depth 30 -Compress }

  <#
    Ten attempts, not six.

    Dataverse throttles hard for a while AFTER a large metadata burst — the
    124 creates land fine and then PublishAllXml and the read that follows it
    get 429'd repeatedly. Six attempts of linear backoff (42s total) ran out
    before the service calmed down, which failed the run at the very last
    step, after all the real work had succeeded.
  #>
  for ($attempt = 0; $attempt -lt $MaxAttempts; $attempt++) {
    try {
      if ($null -eq $json) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
      }
      return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers `
        -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ContentType 'application/json; charset=utf-8'
    }
    catch {
      $status = 0
      if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }

      if ($status -eq 404 -and $AllowNotFound) { return $null }

      if ($status -eq 429 -or $status -ge 500) {
        # Exponential, capped: 2, 4, 8, 16, 32, 60, 60... ~4 minutes in total.
        $wait = [Math]::Min(60, [Math]::Pow(2, $attempt + 1))
        <#
          Retry-After, read defensively.

          Windows PowerShell 5.1 exposes response headers as a collection you
          can index by name. PowerShell 7 exposes HttpResponseHeaders, which
          THROWS on that same expression. This has to run on whichever the
          machine happens to have, so try both and fall back to the computed
          backoff rather than letting a header read kill the whole run.
        #>
        $retryAfter = $null
        try   { $retryAfter = $_.Exception.Response.Headers['Retry-After'] }
        catch {
          try {
            $values = $null
            if ($_.Exception.Response.Headers.TryGetValues('Retry-After', [ref]$values)) {
              $retryAfter = @($values)[0]
            }
          } catch { }
        }
        if ($retryAfter) {
          $parsed = 0
          if ([int]::TryParse([string]$retryAfter, [ref]$parsed) -and $parsed -gt 0) { $wait = $parsed }
        }
        Write-Host "    throttled, waiting ${wait}s..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $wait
        continue
      }

      # Surface Dataverse's own message. Its 400s say precisely what is wrong,
      # and swallowing that in favour of "Bad Request" helps nobody.
      $message = $_.Exception.Message
      if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        try { $message = ($_.ErrorDetails.Message | ConvertFrom-Json).error.message }
        catch { $message = $_.ErrorDetails.Message }
      }
      throw "$Method $Path -> $status : $message"
    }
  }
  throw "$Method $Path failed after retries."
}

function Get-Dv    { param($Path, [switch]$AllowNotFound, [int]$MaxAttempts = 10) Invoke-Dv -Method GET -Path $Path -AllowNotFound:$AllowNotFound -MaxAttempts $MaxAttempts }
function Post-Dv   { param($Path, $Body, [hashtable]$ExtraHeaders = @{}) Invoke-Dv -Method POST  -Path $Path -Body $Body -ExtraHeaders $ExtraHeaders }
function Patch-Dv  { param($Path, $Body, [hashtable]$ExtraHeaders = @{}) Invoke-Dv -Method PATCH -Path $Path -Body $Body -ExtraHeaders $ExtraHeaders }

# Adds whatever is created to the solution rather than the Default Solution.
$script:SolutionHeader = @{ 'MSCRM.SolutionUniqueName' = $script:Solution }

# ── Paths ────────────────────────────────────────────────────────────────────

$script:Here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:DataDir   = Join-Path (Split-Path -Parent $script:Here) 'generated'
if (-not (Test-Path $script:DataDir)) {
  # Standalone layout: generated/ sits beside the scripts rather than above.
  $script:DataDir = Join-Path $script:Here 'generated'
}
