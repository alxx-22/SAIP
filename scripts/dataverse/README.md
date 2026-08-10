# Dataverse demo tables

Creates 16 native Dataverse tables and seeds them from the app's own fixtures, so
the prototype runs on data that survives a page reload.

```bash
export DATAVERSE_URL="https://orgb9e83276.crm.dynamics.com"
export DATAVERSE_TOKEN="<bearer token>"

node scripts/dataverse/create-tables.mjs --dry-run   # review, no network calls
node scripts/dataverse/create-tables.mjs             # ~124 metadata objects
node scripts/dataverse/export-mock.mjs               # fixtures → JSON
node scripts/dataverse/seed.mjs                      # ~206 records
```

Both scripts are **safe to re-run** and **never delete anything**.

**On Windows without Node**, use the PowerShell equivalents in `powershell/` —
they need nothing installed and sign in with a device code. `INSTRUCTIONS.md` is
the step-by-step version, and the one to hand to someone doing this for the
first time.

The PowerShell set also covers the two things Node does not, because they are
Power Pages configuration rather than table creation:

| | |
| --- | --- |
| `Create-SiteSettings.ps1` | The 33 `Webapi/...` site settings, without which every table 404s |
| `Create-TablePermissions.ps1` | The 22 table permissions, attached to a web role, without which every table 403s |

Both detect whether the site uses the standard (`adx_`) or enhanced (`mspp_`)
data model and read entity set names, the `Global` scope value and the web-role
relationship from metadata rather than hard-coding any of them — the wrong guess
there writes rows that look right and do nothing.

---

## Why this exists, and what is temporary

The plan is that most of this eventually arrives as Dataverse **virtual tables**
over the Fabric SQL database (`sql/README.md`). The SQL Server connector is
currently blocked by a tenant DLP policy, and the prototype should not have to
wait on that to stop losing its data on every reload.

So be clear about what you are building:

| | |
| --- | --- |
| `saip_incentivedocument` | **Permanent.** Virtual tables cannot carry notes, so PDF attachments must hang off a native table whatever happens with Fabric |
| The other 15 | **Temporary.** Delete them once the virtual tables land — they are unmanaged and in their own solution, so it is a clean removal |

**DLP does not block any of this.** DLP governs *connectors*; these are direct
Web API calls with your own token. It is the one part of the backend you can make
progress on while the connector request sits with your admin.

## Ids are text columns, not lookups

Deliberately, and it is the reason this work isn't throwaway.

A virtual table cannot sit on the 1 side of a 1:N relationship, so the real
schema will never have lookups between these entities — the app filters by id.
Modelling the demo tables with lookups would make them nicer to browse in the
maker portal and would mean rewriting every service method at the swap. Text ids
keep the front end identical either way.

Same reason list columns (`capabilitykeys`, `rolekeys`, `nominatedaccountkeys`)
are comma-separated text rather than junction tables.

---

## Getting a token

Two options. Neither is stored anywhere by these scripts.

**Your own account** — fine for a first run, expires in about an hour:

```bash
az login
export DATAVERSE_TOKEN=$(az account get-access-token \
  --resource "https://orgb9e83276.crm.dynamics.com" \
  --query accessToken -o tsv)
```

**An app registration** — better for anything repeatable, and you need a service
principal for the SQL connector anyway. Grant it the *System Customizer* role in
the environment, then use the client-credentials flow with
`scope=https://orgb9e83276.crm.dynamics.com/.default`.

### The org URL

```
https://orgb9e83276.crm.dynamics.com
```

Confirmed: United States region, so the segment is plain `crm` with no number.
Worth knowing if this ever moves — the segment varies by region (`crm4` is EMEA,
`crm11` UK), and a wrong one fails DNS or 401s, neither of which says "wrong
region". `pac org list` prints the real value.

---

## What gets created

| Group | Tables |
| --- | --- |
| Identity & access | `capability`, `role`, `user` |
| Configuration | `questionsection`, `optionset`, `option`, `question` |
| Account data | `account`, `servicecontract`, `opportunity`, `opportunityline`, `score` |
| Written by the app | `monitoringanswer`, `meeting` |
| Incentives | `incentive`, `incentivedocument` |

All under the `saip` publisher prefix, in an unmanaged solution called
`SAIPDemo` (override with `DATAVERSE_SOLUTION`). Creating them in a solution
rather than the Default Solution is what makes them portable to another
environment later.

`create-tables.mjs` finishes by calling `PublishAllXml` — **tables are not usable
by a Power Pages site until customisations are published**, and the symptom
otherwise is a table that exists in the maker portal but cannot be added to the
site, which reads like a permissions problem.

## The handoff file

`generated/entity-sets.json` is written from the live metadata after creation:

```json
[
  {
    "LogicalName": "saip_account",
    "EntitySetName": "saip_accounts",
    "PrimaryIdAttribute": "saip_accountid",
    "PrimaryNameAttribute": "saip_name"
  }
]
```

**Entity set names are never derived.** Dataverse mostly pluralises with a
trailing `s`, but not always, and a wrong one 404s in a way that looks like a
permissions error. This file is what the Web API client reads.

## Dates

Every date column uses **DateOnly** behaviour, not UserLocal. These are business
dates — a renewal, a close, the day a workshop happened — and UserLocal shifts
them across timezone boundaries, so a contract renewing on the 1st would read as
the 31st for anyone west of whoever entered it.

## The fixture snapshot

`export-mock.mjs` bundles the real TypeScript fixtures with esbuild and runs them
once. The fixtures generate their dates **relative to today**, so what lands in
Dataverse is a snapshot: "renewing in 90 days" becomes a fixed date.

Re-run both scripts if the demo data drifts far enough into the past to stop
demonstrating the states it was designed to show — overdue monitoring, contracts
renewing soon, opportunities closing.

Document *bytes* are not seeded. `incentivedocument` rows are created with no note
behind them, which is exactly the state the UI already renders as unavailable.

---

## Next

Nothing in `src/` reads these yet. Wiring them is a new
`src/services/dataverse/dataverseAccountService.ts` implementing the same
`AccountService` interface, and one line changed in `src/services/index.ts` — the
`SWAP POINT`. The mock service stays where it is, so you can flip between them.
