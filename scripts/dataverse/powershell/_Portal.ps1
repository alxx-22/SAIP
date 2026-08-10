<#
  Shared discovery for the Power Pages configuration scripts.

  Dot-sourced by Create-SiteSettings.ps1 and Create-TablePermissions.ps1 after
  _Common.ps1. Not run directly.

  NOTHING HERE IS HARD-CODED THAT CAN BE READ INSTEAD. Power Pages configuration
  lives in ordinary Dataverse tables, but WHICH tables depends on how the site
  was created:

    - Standard data model:  adx_website, adx_sitesetting, adx_entitypermission
    - Enhanced data model:  mspp_website, mspp_sitesetting, mspp_entitypermission

  A site built with `--modelVersion 2` is the enhanced one. Guessing wrong does
  not fail loudly -- it writes rows into a table the site never reads, and the
  settings simply have no effect. So the prefix is detected, entity set names
  are read from metadata for the same reason the SAIP ones were, and the option
  value for "Global" is resolved by its label rather than by a number remembered
  from documentation.
#>

$script:PortalPrefix = $null
$script:EntitySetCache = @{}

<#
  Which data model this environment's Power Pages site uses.

  Decided by which website table actually exists. Both can be present in an
  environment that has had sites of both kinds, so the one holding websites
  wins, and a tie is reported rather than guessed at.
#>
function Get-PortalPrefix {
  if ($script:PortalPrefix) { return $script:PortalPrefix }

  $found = @()
  foreach ($prefix in @('mspp', 'adx')) {
    $exists = Get-Dv "EntityDefinitions(LogicalName='${prefix}_website')?`$select=LogicalName" -AllowNotFound
    if ($exists) { $found += $prefix }
  }

  if ($found.Count -eq 0) {
    throw 'No Power Pages tables in this environment. Is this the right Dataverse URL?'
  }

  if ($found.Count -eq 1) {
    $script:PortalPrefix = $found[0]
  }
  else {
    # Both table sets exist. Pick whichever actually holds websites.
    $counts = @{}
    foreach ($prefix in $found) {
      $set = Get-PortalEntitySet "${prefix}_website"
      $rows = Get-Dv "$set`?`$select=${prefix}_websiteid"
      $counts[$prefix] = @($rows.value).Count
    }
    $best = ($counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1)
    if ($best.Value -eq 0) {
      throw 'Both adx_ and mspp_ tables exist but neither holds a website. Nothing to configure.'
    }
    $script:PortalPrefix = $best.Key
  }

  $model = if ($script:PortalPrefix -eq 'mspp') { 'enhanced' } else { 'standard' }
  Write-Host "Data model: $model ($($script:PortalPrefix)_*)" -ForegroundColor DarkGray
  return $script:PortalPrefix
}

<#
  Entity set name for a logical name, read from the service.

  Same reason as the SAIP tables: `adx_sitesetting` pluralises to
  `adx_sitesettings`, but that is a fact about this environment rather than a
  rule, and a wrong guess 404s in a way that reads like a permissions error.
#>
function Get-PortalEntitySet {
  param([Parameter(Mandatory)][string] $LogicalName)

  if ($script:EntitySetCache.ContainsKey($LogicalName)) {
    return $script:EntitySetCache[$LogicalName]
  }

  $definition = Get-Dv "EntityDefinitions(LogicalName='$LogicalName')?`$select=EntitySetName"
  if (-not $definition.EntitySetName) { throw "Could not read the entity set name for $LogicalName." }

  $script:EntitySetCache[$LogicalName] = $definition.EntitySetName
  return $definition.EntitySetName
}

<#
  The website these settings belong to.

  A site setting with no website attaches to nothing and silently does nothing,
  which is the single most common way this is got wrong by hand. So the id is
  resolved here and every row gets it.

  With one website it is chosen automatically. With several, the name has to be
  given -- picking one for you is the kind of help that configures the wrong
  site.
#>
function Get-PortalWebsite {
  param(
    [string] $Name,
    <# The escape hatch for two sites sharing a name. Wins over -Name. #>
    [string] $Id
  )

  $prefix = Get-PortalPrefix
  $set = Get-PortalEntitySet "${prefix}_website"
  $idField = "${prefix}_websiteid"
  $nameField = "${prefix}_name"

  $response = Get-Dv "$set`?`$select=$idField,$nameField"
  $websites = @($response.value)

  if ($websites.Count -eq 0) { throw 'No Power Pages website found in this environment.' }

  if ($Id) {
    $byId = @($websites | Where-Object { $_.$idField -eq $Id })
    if ($byId.Count -eq 0) {
      Write-Host ''
      Write-Host "No website with id '$Id' in this environment." -ForegroundColor Yellow
      exit 1
    }
    return @{ Id = $Id; Name = $byId[0].$nameField; Set = $set }
  }

  <#
    The list IS the error message, so print it and exit.

    A `throw` here buries five useful lines under a PowerShell stack trace and
    a CategoryInfo block, and the thing you actually need -- the names to choose
    from -- ends up scrolled off the top.
  #>
  function Show-Websites {
    foreach ($site in $websites) { Write-Host "  $($site.$nameField)" -ForegroundColor White }
  }

  if ($Name) {
    $match = @($websites | Where-Object { $_.$nameField -eq $Name })

    if ($match.Count -eq 0) {
      Write-Host ''
      Write-Host "No website called '$Name'. This environment has:" -ForegroundColor Yellow
      Show-Websites
      exit 1
    }

    <#
      Two sites can genuinely share a name -- a live site and a copy of it is
      the usual pair. Taking the first would configure one of them at random and
      report success, and the symptom would be a site that still 404s after a
      run that said it worked.
    #>
    if ($match.Count -gt 1) {
      Write-Host ''
      Write-Host "$($match.Count) websites are called '$Name', so I cannot tell which you mean." -ForegroundColor Yellow
      Write-Host 'Rename one in the maker portal, or pass the id instead:' -ForegroundColor Yellow
      foreach ($site in $match) { Write-Host "  -WebsiteId $($site.$idField)" -ForegroundColor White }
      exit 1
    }

    return @{ Id = $match[0].$idField; Name = $Name; Set = $set }
  }

  if ($websites.Count -gt 1) {
    Write-Host ''
    Write-Host 'This environment has more than one website. Pick the one to configure:' -ForegroundColor Yellow
    Show-Websites
    Write-Host ''
    Write-Host 'Re-run adding, for example:' -ForegroundColor Yellow
    Write-Host "    -WebsiteName ""$($websites[0].$nameField)""" -ForegroundColor White
    exit 1
  }

  return @{ Id = $websites[0].$idField; Name = $websites[0].$nameField; Set = $set }
}

<#
  A choice column's value, resolved by its label.

  The alternative is a magic number copied from documentation, and the option
  values for `scope` differ between the two data models. Reading the label is
  both correct and self-explaining at the call site.
#>
function Get-OptionValue {
  param(
    [Parameter(Mandatory)][string] $Entity,
    [Parameter(Mandatory)][string] $Attribute,
    [Parameter(Mandatory)][string] $Label
  )

  $metadata = Get-Dv ("EntityDefinitions(LogicalName='$Entity')/Attributes(LogicalName='$Attribute')" +
                      "/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet")

  foreach ($option in $metadata.OptionSet.Options) {
    if ($option.Label.UserLocalizedLabel.Label -eq $Label) { return $option.Value }
  }

  $available = ($metadata.OptionSet.Options | ForEach-Object { $_.Label.UserLocalizedLabel.Label }) -join ', '
  throw "No option called '$Label' on $Entity.$Attribute. Available: $available"
}

<# True when a column exists on a table. Column names moved between the two
   data models, so the scripts ask rather than assume. #>
function Test-Column {
  param(
    [Parameter(Mandatory)][string] $Entity,
    [Parameter(Mandatory)][string] $Attribute
  )
  $found = Get-Dv "EntityDefinitions(LogicalName='$Entity')/Attributes(LogicalName='$Attribute')?`$select=LogicalName" -AllowNotFound
  return [bool]$found
}
