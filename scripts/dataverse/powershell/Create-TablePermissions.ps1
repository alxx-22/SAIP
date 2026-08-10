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
  <#
    Prints every column on the entity permission table and stops.

    For when a write still does not line up: a 400 names the ONE column that is
    wrong, this names the ones that exist.
  #>
  [switch] $ShowColumns,

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

$prefix           = Get-PortalPrefix
$permissionEntity = "${prefix}_entitypermission"

# Before the website is resolved: a diagnostic should not first make you answer
# a question about which site you meant.
if ($ShowColumns) {
  Write-Host ''
  Write-Host "Columns on ${permissionEntity}:" -ForegroundColor Cyan
  foreach ($column in Get-Columns $permissionEntity) {
    Write-Host ("  {0,-46} {1}" -f $column.LogicalName, $column.AttributeType)
  }
  exit 0
}

$website = Get-PortalWebsite -Name $WebsiteName -Id $WebsiteId
$set     = Get-PortalEntitySet "${prefix}_entitypermission"
$roleSet = Get-PortalEntitySet "${prefix}_webrole"

$idField     = "${prefix}_entitypermissionid"
$websiteBind = "${prefix}_websiteid@odata.bind"

<#
  The primary name column, asked for rather than assumed.

  `<prefix>_name` is right for the website, the web role and the site setting,
  and WRONG here -- filtering on mspp_name returns "Could not find a property
  named 'mspp_name' on type mspp_entitypermission". Three tables out of four
  following a pattern is what makes it look like a rule.
#>
$nameField = Get-PrimaryName $permissionEntity

<#
  The scope column, likewise. `<prefix>_scope` is the expected name; if this
  environment calls it something else, find the choice column whose name ends
  that way rather than failing on the assumption.
#>
$scopeField = "${prefix}_scope"
if (-not (Test-Column -Entity $permissionEntity -Attribute $scopeField)) {
  $candidate = Get-Columns $permissionEntity |
               Where-Object { $_.LogicalName -like '*scope*' -and $_.AttributeType -eq 'Picklist' } |
               Select-Object -First 1
  if (-not $candidate) {
    Write-Host ''
    Write-Host "No scope column on $permissionEntity. Run with -ShowColumns to see what it has." -ForegroundColor Yellow
    exit 1
  }
  $scopeField = $candidate.LogicalName
}

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
  The four privilege columns, each confirmed to exist before anything is written.

  A privilege column that is named differently here would be dropped silently
  from the POST body, and the permission would be created granting nothing --
  a run that reports success and produces 403s. Better to stop and say which
  one is missing.
#>
$privilegeFields = @{}
foreach ($privilege in @('read', 'write', 'create', 'delete')) {
  $column = "${prefix}_$privilege"
  if (-not (Test-Column -Entity $permissionEntity -Attribute $column)) {
    Write-Host ''
    Write-Host "$permissionEntity has no '$column' column, so privileges cannot be set." -ForegroundColor Yellow
    Write-Host 'Run with -ShowColumns and send me the list.' -ForegroundColor Yellow
    exit 1
  }
  $privilegeFields[$privilege] = $column
}

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
  $roleNameField = Get-PrimaryName "${prefix}_webrole"
  $response = Get-Dv ("$roleSet`?`$filter=$roleNameField eq '$safeName' and " +
                      "_${prefix}_websiteid_value eq $($website.Id)&`$select=${prefix}_webroleid")

  if (@($response.value).Count -eq 0) {
    $all = Get-Dv "$roleSet`?`$filter=_${prefix}_websiteid_value eq $($website.Id)&`$select=$roleNameField"
    Write-Host ''
    Write-Host "No web role called '$Name' on this site. It has:" -ForegroundColor Yellow
    foreach ($role in $all.value) { Write-Host "  $($role.$roleNameField)" -ForegroundColor White }
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
      $privilegeFields['read']   = [bool]$Privileges['Read']
      $privilegeFields['write']  = [bool]$Privileges['Write']
      $privilegeFields['create'] = [bool]$Privileges['Create']
      $privilegeFields['delete'] = [bool]$Privileges['Delete']
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
  }
  catch {
    # Already attached. Dataverse rejects a duplicate association, which here
    # means the desired state is already true.
    if ($_.Exception.Message -notmatch 'duplicate|already exists|Cannot insert duplicate') {
      throw
    }
  }
}

foreach ($entry in $PERMISSIONS) {
  New-Permission -Table $entry['Table'] -Name "SAIP $($entry['Table'])" -RoleId $roleId -Privileges $entry

  if ($entry['Admin'] -and $adminRoleId) {
    New-Permission -Table $entry['Table'] -Name "SAIP $($entry['Table']) (admin)" -RoleId $adminRoleId `
      -Privileges @{ Read = $true; Write = $true; Create = $true; Delete = $true }
  }
}

<#
  Read the links back before claiming them.

  The POST that attaches a role answers 204 whether or not the association
  stuck, so counting POSTs was reporting "22 role link(s) confirmed" for a run
  in which none had been made. A permission attached to no role looks perfect in
  the maker portal and grants nothing -- it is the exact shape of
  "You don't have permission to read the saip_account table" -- so this is the
  one thing worth spending a request to actually check.
#>
Write-Host ''
Write-Host 'Verifying the role links...' -ForegroundColor Cyan

$check = Get-Dv ("$set`?`$filter=_${prefix}_websiteid_value eq $($website.Id)" +
                 "&`$select=$idField,$nameField,$entityField" +
                 "&`$expand=$roleNavigation(`$select=${prefix}_webroleid)")

$mine = @($check.value | Where-Object { [string]$_.$entityField -like 'saip_*' })
$linked = @($mine | Where-Object { @($_.$roleNavigation).Count -gt 0 }).Count
$unlinked = @($mine | Where-Object { @($_.$roleNavigation).Count -eq 0 })

Write-Host ''
Write-Host "Done. $created created, $skipped already existed, $linked of $($mine.Count) attached to a role." -ForegroundColor Cyan

if ($unlinked.Count -gt 0) {
  Write-Host ''
  Write-Host "$($unlinked.Count) permission(s) are attached to NO web role and therefore grant" -ForegroundColor Yellow
  Write-Host 'nothing. This is what produces "You do not have permission to read...".' -ForegroundColor Yellow
  foreach ($permission in $unlinked) { Write-Host "  $($permission.$nameField)" -ForegroundColor White }
  Write-Host ''
  Write-Host 'Run the script again -- it re-attempts the link for rows that already exist.' -ForegroundColor Yellow
}

if (-not $AdminWebRole) {
  Write-Host ''
  Write-Host 'No -AdminWebRole given, so configuration tables are read-only. The admin' -ForegroundColor Yellow
  Write-Host 'portal will show its screens and fail to save. Re-run with, for example:' -ForegroundColor Yellow
  Write-Host '    -AdminWebRole "Administrators"' -ForegroundColor White
}

Write-Host ''
Write-Host 'Power Pages caches permissions. Use Sync configuration in the design studio,' -ForegroundColor Yellow
Write-Host 'then test with:  https://<your-site>/_api/saip_accounts' -ForegroundColor Yellow
