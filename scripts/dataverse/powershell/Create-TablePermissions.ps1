<#
  Creates the table permissions the SAIP tables need, and attaches them to a
  web role.

    powershell -ExecutionPolicy Bypass -File .\Create-TablePermissions.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\Create-TablePermissions.ps1 -WebRole "Authenticated Users"

  THE OTHER HALF of Create-SiteSettings.ps1. A site setting makes a table
  reachable; a table permission decides what the signed-in visitor may do with
  it. Missing setting gives 404, missing permission gives 403, and neither
  message mentions the thing that is actually missing.

  READ IS NOT THE DEFAULT FOR EVERYTHING. Four tables are written to by the app
  and six more only by administrators, so the privileges differ per table and
  the admin ones go on a separate role. Granting write everywhere would be one
  line shorter and would let any signed-in visitor rewrite the question set
  through the Web API -- the portal serves it whether or not the UI shows a
  button.

  SAFE TO RE-RUN. Permissions are matched on name and skipped if present.

  NOTHING IS DELETED, including a permission whose privileges have since been
  reduced in this file -- widening by accident is recoverable, silently
  narrowing someone's access mid-demo is not. It reports the difference instead.
#>

[CmdletBinding()]
param(
  [switch] $DryRun,
  [string] $DataverseUrl,
  [string] $WebsiteName,
  <# Only needed when two sites share a name. Wins over -WebsiteName. #>
  [string] $WebsiteId,

  <# The role every signed-in user holds. Power Pages creates this one. #>
  [string] $WebRole = 'Authenticated Users',

  <#
    The role allowed to change configuration. Omit it and the admin tables get
    read-only permissions on the ordinary role -- the app still works, the admin
    portal will not save, and the script says so. That is the safe default:
    handing configuration rights to every signed-in visitor because a parameter
    was forgotten is not.
  #>
  [string] $AdminWebRole
)

. (Join-Path $PSScriptRoot '_Common.ps1')

<#
  Privileges per table.

  read    - everything the app displays
  write   - the app updates existing rows
  create  - the app inserts rows
  delete  - the app removes rows

  Nothing here grants delete except the two places the app genuinely deletes:
  incentive documents, and the dropdown options an administrator removes from a
  list.
#>
$PERMISSIONS = @(
  # --- Read-only: the app displays these and never writes them ---------------
  @{ Table = 'saip_account';          Read = $true }
  @{ Table = 'saip_capability';       Read = $true }
  @{ Table = 'saip_score';            Read = $true }
  @{ Table = 'saip_servicecontract';  Read = $true }
  @{ Table = 'saip_opportunity';      Read = $true }
  @{ Table = 'saip_opportunityline';  Read = $true }

  # --- The app's own write paths ---------------------------------------------
  # Monitoring answers are upserted: existing rows are updated, and an answer
  # never recorded before has to be created.
  @{ Table = 'saip_monitoringanswer'; Read = $true; Write = $true; Create = $true }
  # A meeting is only ever logged, never edited afterwards.
  @{ Table = 'saip_meeting';          Read = $true; Create = $true }
  # Incentives are created, and their assignment lists are rewritten.
  @{ Table = 'saip_incentive';        Read = $true; Write = $true; Create = $true }
  @{ Table = 'saip_incentivedocument'; Read = $true; Create = $true; Delete = $true }

  # --- Configuration: read for everyone, write for administrators ------------
  @{ Table = 'saip_role';             Read = $true; Admin = $true }
  @{ Table = 'saip_user';             Read = $true; Admin = $true }
  @{ Table = 'saip_question';         Read = $true; Admin = $true }
  @{ Table = 'saip_questionsection';  Read = $true; Admin = $true }
  @{ Table = 'saip_optionset';        Read = $true; Admin = $true }
  @{ Table = 'saip_option';           Read = $true; Admin = $true }
)

function Format-Privileges($entry) {
  $names = @()
  foreach ($privilege in @('Read', 'Write', 'Create', 'Delete')) {
    if ($entry[$privilege]) { $names += $privilege.ToLower() }
  }
  return ($names -join ', ')
}

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl$(if ($DryRun) { '   (DRY RUN -- nothing will be written)' })"
Write-Host "Role:      $WebRole"
Write-Host "Admin:     $(if ($AdminWebRole) { $AdminWebRole } else { '(none given -- configuration will be read-only)' })"
Write-Host ''

if ($DryRun) {
  foreach ($entry in $PERMISSIONS) {
    Write-Host ("  + {0,-24} {1}" -f $entry['Table'], (Format-Privileges $entry)) -ForegroundColor Green
    if ($entry['Admin'] -and $AdminWebRole) {
      Write-Host ("  + {0,-24} read, write, create, delete   [{1}]" -f $entry['Table'], $AdminWebRole) -ForegroundColor Green
    }
  }
  $total = $PERMISSIONS.Count + $(if ($AdminWebRole) { @($PERMISSIONS | Where-Object { $_['Admin'] }).Count } else { 0 })
  Write-Host ''
  Write-Host "Done. $total would be created." -ForegroundColor Cyan
  return
}

$script:Token = Get-DataverseToken
. (Join-Path $PSScriptRoot '_Portal.ps1')

$prefix  = Get-PortalPrefix
$website = Get-PortalWebsite -Name $WebsiteName -Id $WebsiteId
$set     = Get-PortalEntitySet "${prefix}_entitypermission"
$roleSet = Get-PortalEntitySet "${prefix}_webrole"

$permissionEntity = "${prefix}_entitypermission"
$idField          = "${prefix}_entitypermissionid"
$nameField        = "${prefix}_name"
$scopeField       = "${prefix}_scope"
$websiteBind      = "${prefix}_websiteid@odata.bind"

<#
  The column naming the table, which moved between the two data models.

  Asked rather than assumed: writing the logical name into a column that does
  not exist is a 400, but writing it into the WRONG existing column produces a
  permission that applies to nothing and reports success.
#>
$entityField = if (Test-Column -Entity $permissionEntity -Attribute "${prefix}_entitylogicalname") {
  "${prefix}_entitylogicalname"
} else {
  "${prefix}_entityname"
}

<#
  "Global" resolved from the option set by its label.

  These tables have no owner or account relationship to scope by, so Global is
  the only scope that means anything for them. The numeric value differs between
  data models, which is exactly why it is looked up.
#>
$globalScope = Get-OptionValue -Entity $permissionEntity -Attribute $scopeField -Label 'Global'

<#
  The navigation property linking a permission to a web role.

  An N:N relationship, and its navigation property name is not derivable -- so
  it is read from the relationship metadata rather than guessed, the same way
  entity set names are.
#>
$relationships = Get-Dv ("EntityDefinitions(LogicalName='$permissionEntity')?" +
                         "`$select=LogicalName&`$expand=ManyToManyRelationships")
$link = $relationships.ManyToManyRelationships |
        Where-Object { $_.Entity1LogicalName -eq "${prefix}_webrole" -or $_.Entity2LogicalName -eq "${prefix}_webrole" } |
        Select-Object -First 1

if (-not $link) { throw "No relationship between $permissionEntity and ${prefix}_webrole." }

$roleNavigation = if ($link.Entity1LogicalName -eq $permissionEntity) {
  $link.Entity1NavigationPropertyName
} else {
  $link.Entity2NavigationPropertyName
}

# --- Web roles --------------------------------------------------------------

function Resolve-WebRole {
  param([Parameter(Mandatory)][string] $Name)

  $safeName = $Name.Replace("'", "''")
  $response = Get-Dv ("$roleSet`?`$filter=${prefix}_name eq '$safeName' and " +
                      "_${prefix}_websiteid_value eq $($website.Id)&`$select=${prefix}_webroleid")

  if (@($response.value).Count -eq 0) {
    $all = Get-Dv "$roleSet`?`$filter=_${prefix}_websiteid_value eq $($website.Id)&`$select=${prefix}_name"
    Write-Host ''
    Write-Host "No web role called '$Name' on this site. It has:" -ForegroundColor Yellow
    foreach ($role in $all.value) { Write-Host "  $($role.$nameField)" }
    Write-Host ''
    Write-Host 'Re-run with -WebRole "<one of the names above>".' -ForegroundColor Yellow
    # exit, not throw: the list above IS the error message, and a PowerShell
    # stack trace printed on top of it buries the useful part.
    exit 1
  }

  return $response.value[0]."${prefix}_webroleid"
}

$roleId = Resolve-WebRole -Name $WebRole
$adminRoleId = if ($AdminWebRole) { Resolve-WebRole -Name $AdminWebRole } else { $null }

Write-Host "Website:   $($website.Name)"
Write-Host ''

# --- Create -----------------------------------------------------------------

$created = 0
$skipped = 0
$linked  = 0

function New-Permission {
  param(
    [Parameter(Mandatory)][string] $Table,
    [Parameter(Mandatory)][string] $Name,
    [Parameter(Mandatory)][string] $RoleId,
    [hashtable] $Privileges
  )

  $safeName = $Name.Replace("'", "''")
  $existing = Get-Dv ("$set`?`$filter=$nameField eq '$safeName' and " +
                      "_${prefix}_websiteid_value eq $($website.Id)&`$select=$idField")

  if (@($existing.value).Count -gt 0) {
    $permissionId = $existing.value[0].$idField
    Write-Host ("  - {0,-46} exists" -f $Name) -ForegroundColor DarkGray
    $script:skipped++
  }
  else {
    $body = @{
      $nameField    = $Name
      $entityField  = $Table
      $scopeField   = $globalScope
      $websiteBind  = "/$($website.Set)($($website.Id))"
      "${prefix}_read"   = [bool]$Privileges['Read']
      "${prefix}_write"  = [bool]$Privileges['Write']
      "${prefix}_create" = [bool]$Privileges['Create']
      "${prefix}_delete" = [bool]$Privileges['Delete']
    }
    $permissionId = (Post-Dv $set $body @{ Prefer = 'return=representation' }).$idField
    Write-Host ("  + {0,-46} {1}" -f $Name, (Format-Privileges $Privileges)) -ForegroundColor Green
    $script:created++
  }

  <#
    Attach the role. Done separately from the create because the association is
    an N:N write, and because a permission that already existed may still be
    attached to nothing -- which is exactly the half-finished state a hand-built
    one ends up in when the "Add roles" step at the bottom of the form is
    missed.
  #>
  try {
    Post-Dv "$set($permissionId)/$roleNavigation/`$ref" @{
      '@odata.id' = "$script:ApiRoot$roleSet($RoleId)"
    } | Out-Null
    $script:linked++
  }
  catch {
    # Already attached. Dataverse rejects a duplicate association, which here
    # means the desired state is already true -- so it counts as confirmed
    # rather than as nothing having happened.
    if ($_.Exception.Message -notmatch 'duplicate|already exists|Cannot insert duplicate') {
      throw
    }
    $script:linked++
  }
}

foreach ($entry in $PERMISSIONS) {
  New-Permission -Table $entry['Table'] -Name "SAIP $($entry['Table'])" -RoleId $roleId -Privileges $entry

  if ($entry['Admin'] -and $adminRoleId) {
    New-Permission -Table $entry['Table'] -Name "SAIP $($entry['Table']) (admin)" -RoleId $adminRoleId `
      -Privileges @{ Read = $true; Write = $true; Create = $true; Delete = $true }
  }
}

Write-Host ''
Write-Host "Done. $created created, $skipped already existed, $linked role link(s) confirmed." -ForegroundColor Cyan

if (-not $AdminWebRole) {
  Write-Host ''
  Write-Host 'No -AdminWebRole given, so configuration tables are read-only. The admin' -ForegroundColor Yellow
  Write-Host 'portal will show its screens and fail to save. Re-run with, for example:' -ForegroundColor Yellow
  Write-Host '    -AdminWebRole "Administrators"' -ForegroundColor White
}

Write-Host ''
Write-Host 'Power Pages caches permissions. Use Sync configuration in the design studio,' -ForegroundColor Yellow
Write-Host 'then test with:  https://<your-site>/_api/saip_accounts' -ForegroundColor Yellow
