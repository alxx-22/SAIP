<#
  Shows what a portal user can reach, and optionally grants them a web role.

    powershell -ExecutionPolicy Bypass -File .\Set-PortalRole.ps1 -Email you@hpe.com
    powershell -ExecutionPolicy Bypass -File .\Set-PortalRole.ps1 -Email you@hpe.com -Role "Administrators"

  Without -Role it READS ONLY and changes nothing.

  WHY THIS IS A SEPARATE THING. Create-TablePermissions.ps1 links a PERMISSION
  to a ROLE. It never links a PERSON to a role, and nothing else in this set
  does either -- so after a completely successful run, nobody has been granted
  anything they did not already have.

  Two facts follow, and both look like bugs when you hit them:

    - "Authenticated Users" is automatic. Every signed-in visitor holds it, so
      the read permissions work the moment you are signed IN TO THE PORTAL --
      which is not the same as being signed in to make.powerpages.microsoft.com.
      If /_api still refuses you, the first question is whether the portal has a
      contact for you at all.

    - "Administrators" is NOT automatic. It is why /_services/about shows a
      version and no Clear cache button, and why the admin portal will not save.
      Somebody has to grant it.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory)][string] $Email,
  <# Omit to report only. Give a role name to grant it. #>
  [string] $Role,
  [string] $DataverseUrl,
  [string] $WebsiteName,
  [string] $WebsiteId
)

. (Join-Path $PSScriptRoot '_Common.ps1')

Write-Host ''
Write-Host "Dataverse: $script:DataverseUrl"

$script:Token = Get-DataverseToken
. (Join-Path $PSScriptRoot '_Portal.ps1')

$prefix   = Get-PortalPrefix
$website  = Get-PortalWebsite -Name $WebsiteName -Id $WebsiteId
$roleSet  = Get-PortalEntitySet "${prefix}_webrole"
$roleName = Get-PrimaryName "${prefix}_webrole"

Write-Host "Website:   $($website.Name)"
Write-Host ''

# --- The contact ------------------------------------------------------------
<#
  No contact means the portal has never seen this person sign in.

  That is not a permissions problem and no amount of re-running the other
  scripts will fix it -- it is the difference between being signed in to the
  MAKER portal and being signed in to the SITE.
#>
$safeEmail = $Email.Replace("'", "''")
$contacts = Get-Dv ("contacts?`$filter=emailaddress1 eq '$safeEmail'" +
                    "&`$select=contactid,fullname,emailaddress1,statecode")
$found = @($contacts.value)

if ($found.Count -eq 0) {
  Write-Host "No contact with the email $Email." -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'The portal creates a contact the first time someone signs IN TO THE SITE.' -ForegroundColor Yellow
  Write-Host 'Being signed in to make.powerpages.microsoft.com is not the same thing.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host "Open https://<your-site>/ , sign in, then run this again." -ForegroundColor White
  exit 1
}

if ($found.Count -gt 1) {
  Write-Host "$($found.Count) contacts share that email, so I cannot tell which is you:" -ForegroundColor Yellow
  foreach ($contact in $found) { Write-Host "  $($contact.fullname)   $($contact.contactid)" }
  exit 1
}

$contact = $found[0]
Write-Host "Contact:   $($contact.fullname)  <$($contact.emailaddress1)>"
if ($contact.statecode -ne 0) {
  Write-Host '           DEACTIVATED -- a deactivated contact cannot sign in.' -ForegroundColor Yellow
}

# --- Their roles ------------------------------------------------------------
# The N:N navigation property, discovered rather than guessed, same as
# everywhere else in these scripts.
$relationships = Get-Dv ("EntityDefinitions(LogicalName='${prefix}_webrole')?" +
                         "`$select=LogicalName&`$expand=ManyToManyRelationships")
$link = $relationships.ManyToManyRelationships |
        Where-Object { $_.Entity1LogicalName -eq 'contact' -or $_.Entity2LogicalName -eq 'contact' } |
        Select-Object -First 1
if (-not $link) { throw "No relationship between ${prefix}_webrole and contact." }

$contactNavigation = if ($link.Entity1LogicalName -eq "${prefix}_webrole") {
  $link.Entity1NavigationPropertyName
} else {
  $link.Entity2NavigationPropertyName
}

$allRoles = Get-Dv ("$roleSet`?`$filter=_${prefix}_websiteid_value eq $($website.Id)" +
                    "&`$select=${prefix}_webroleid,$roleName,${prefix}_authenticatedusersrole" +
                    "&`$expand=$contactNavigation(`$select=contactid)")

$roles = @($allRoles.value)
$held = @($roles | Where-Object {
  @($_.$contactNavigation) | Where-Object { $_.contactid -eq $contact.contactid }
})

Write-Host ''
Write-Host 'Web roles on this site:' -ForegroundColor Cyan
foreach ($webRole in $roles) {
  $isHeld = $held | Where-Object { $_."${prefix}_webroleid" -eq $webRole."${prefix}_webroleid" }
  $isDefault = $webRole."${prefix}_authenticatedusersrole"

  $mark = if ($isHeld) { '[x]' } elseif ($isDefault) { '[~]' } else { '[ ]' }
  $note = if ($isDefault) { '   automatic for every signed-in visitor' } else { '' }

  $colour = if ($isHeld -or $isDefault) { 'Green' } else { 'Gray' }
  Write-Host ("  $mark $($webRole.$roleName)$note") -ForegroundColor $colour
}

Write-Host ''
Write-Host '  [x] explicitly assigned    [~] automatic    [ ] not held' -ForegroundColor DarkGray

# --- Grant ------------------------------------------------------------------
if (-not $Role) {
  Write-Host ''
  Write-Host 'Read-only run. To grant a role, add:  -Role "Administrators"' -ForegroundColor DarkGray
  return
}

$target = $roles | Where-Object { $_.$roleName -eq $Role } | Select-Object -First 1
if (-not $target) {
  Write-Host ''
  Write-Host "No web role called '$Role' on this site. The names are listed above." -ForegroundColor Yellow
  exit 1
}

if ($held | Where-Object { $_."${prefix}_webroleid" -eq $target."${prefix}_webroleid" }) {
  Write-Host ''
  Write-Host "Already holds '$Role'. Nothing to do." -ForegroundColor Cyan
  return
}

Post-Dv "$roleSet($($target."${prefix}_webroleid"))/$contactNavigation/`$ref" @{
  '@odata.id' = "$script:ApiRoot`contacts($($contact.contactid))"
} | Out-Null

# Read it back rather than trusting the 204 -- the same lesson the permission
# links taught: the association POST succeeds whether or not it sticks.
$after = Get-Dv ("$roleSet($($target."${prefix}_webroleid"))?" +
                 "`$select=$roleName&`$expand=$contactNavigation(`$select=contactid)")
$now = @($after.$contactNavigation) | Where-Object { $_.contactid -eq $contact.contactid }

Write-Host ''
if ($now) {
  Write-Host "Granted '$Role' to $($contact.fullname)." -ForegroundColor Green
  Write-Host ''
  Write-Host 'Sign out of the site and back in -- the role is read at sign-in.' -ForegroundColor Yellow
} else {
  Write-Host "The grant did not stick. '$Role' is still not held." -ForegroundColor Yellow
  exit 1
}
