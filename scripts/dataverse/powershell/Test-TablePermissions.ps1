<#
  Reads the table permissions back and shows what they actually say.

    powershell -ExecutionPolicy Bypass -File .\Test-TablePermissions.ps1 -WebsiteName "SAIP - SAIP"

  READS ONLY. Creates nothing, changes nothing, safe to run any time.

  WHY THIS EXISTS. "You don't have permission to read the saip_account table"
  is the portal reporting a conclusion, not a cause. Four separate things have
  to be true for a permission to work, and the error names none of them:

    1. the permission row exists
    2. it names the right table
    3. its scope is Global
    4. it is LINKED TO A WEB ROLE the visitor holds

  Creating a row and linking it are two different writes, and 4 is the one that
  silently does nothing when it fails -- the permission looks perfect in the
  maker portal and grants nothing at all. This prints all four so the missing
  one is visible rather than inferred.
#>

[CmdletBinding()]
param(
  [string] $DataverseUrl,
  [string] $WebsiteName,
  [string] $WebsiteId
)

. (Join-Path $PSScriptRoot '_Common.ps1')

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl"

$script:Token = Get-DataverseToken
. (Join-Path $PSScriptRoot '_Portal.ps1')

$prefix           = Get-PortalPrefix
$permissionEntity = "${prefix}_entitypermission"
$website          = Get-PortalWebsite -Name $WebsiteName -Id $WebsiteId
$set              = Get-PortalEntitySet $permissionEntity
$nameField        = Get-PrimaryName $permissionEntity
$idField          = "${prefix}_entitypermissionid"

$entityField = if (Test-Column -Entity $permissionEntity -Attribute "${prefix}_entitylogicalname") {
  "${prefix}_entitylogicalname"
} else {
  "${prefix}_entityname"
}

# The navigation property to expand, discovered rather than guessed -- same
# reasoning as everywhere else in these scripts.
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

$roleNameField = Get-PrimaryName "${prefix}_webrole"
$scopeField    = "${prefix}_scope"
$globalScope   = Get-OptionValue -Entity $permissionEntity -Attribute $scopeField -Label 'Global'

Write-Host "Website:   $($website.Name)"
Write-Host ''

$roleMap = Get-PermissionRoleMap -Prefix $prefix -WebsiteId $website.Id

$response = Get-Dv ("$set`?`$filter=_${prefix}_websiteid_value eq $($website.Id)" +
                    "&`$select=$idField,$nameField,$entityField,$scopeField," +
                    "${prefix}_read,${prefix}_write,${prefix}_create,${prefix}_delete")

$permissions = @($response.value)

if ($permissions.Count -eq 0) {
  Write-Host 'No table permissions on this website at all.' -ForegroundColor Yellow
  Write-Host 'Run Create-TablePermissions.ps1 against THIS website.' -ForegroundColor Yellow
  exit 1
}

$saip = @($permissions | Where-Object { [string]$_.$entityField -like 'saip_*' })

Write-Host ("{0,-34} {1,-22} {2,-8} {3,-22} {4}" -f 'PERMISSION', 'TABLE', 'SCOPE', 'PRIVILEGES', 'ROLES')
Write-Host ('-' * 118)

$unlinked = 0
$notGlobal = 0

foreach ($permission in ($saip | Sort-Object { $_.$entityField })) {
  $privileges = @()
  foreach ($privilege in @('read', 'write', 'create', 'delete')) {
    if ($permission."${prefix}_$privilege") { $privileges += $privilege }
  }

  $roles = @($roleMap[$permission.$idField])
  if ($roles.Count -eq 0) { $unlinked++ }

  $scopeOk = $permission.$scopeField -eq $globalScope
  if (-not $scopeOk) { $notGlobal++ }

  $colour = if ($roles.Count -eq 0 -or -not $scopeOk) { 'Yellow' } else { 'Green' }

  Write-Host ("{0,-34} {1,-22} {2,-8} {3,-22} {4}" -f
    $permission.$nameField,
    $permission.$entityField,
    $(if ($scopeOk) { 'Global' } else { "NOT GLOBAL ($($permission.$scopeField))" }),
    ($privileges -join ','),
    $(if ($roles.Count -eq 0) { '(NONE -- grants nothing)' } else { $roles -join ', ' })
  ) -ForegroundColor $colour
}

Write-Host ''
Write-Host "$($saip.Count) SAIP permission(s) on this website." -ForegroundColor Cyan

if ($unlinked -gt 0) {
  Write-Host ''
  Write-Host "$unlinked permission(s) are attached to NO web role, so they grant nothing." -ForegroundColor Yellow
  Write-Host 'That is the usual cause of "You do not have permission to read...".' -ForegroundColor Yellow
  Write-Host 'Re-running Create-TablePermissions.ps1 will link them.' -ForegroundColor Yellow
}

if ($notGlobal -gt 0) {
  Write-Host ''
  Write-Host "$notGlobal permission(s) are not Global, so they apply through a relationship" -ForegroundColor Yellow
  Write-Host 'these tables do not have.' -ForegroundColor Yellow
}

# --- The roles the site actually has ----------------------------------------
# Printed unconditionally: a permission linked to a role NOBODY HOLDS looks
# perfect in every check above and still refuses every request.

$roleSet = Get-PortalEntitySet "${prefix}_webrole"
$allRoles = Get-Dv ("$roleSet`?`$filter=_${prefix}_websiteid_value eq $($website.Id)" +
                    "&`$select=$roleNameField,${prefix}_authenticatedusersrole")

Write-Host ''
Write-Host 'Web roles on this website:' -ForegroundColor Cyan
foreach ($role in $allRoles.value) {
  $isDefault = $role."${prefix}_authenticatedusersrole"
  Write-Host ("  {0}{1}" -f $role.$roleNameField,
    $(if ($isDefault) { '   <- every signed-in visitor holds this one' } else { '' }))
}

Write-Host ''
Write-Host 'If the permissions above are linked to a role that is NOT marked as the' -ForegroundColor DarkGray
Write-Host 'authenticated users role, only members of that role can read the tables.' -ForegroundColor DarkGray
