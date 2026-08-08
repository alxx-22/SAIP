# SAIP — SQL build plan (Fabric SQL Database)

The database behind SAIP's own data: users and access, the configurable
question set, monitoring answers, meetings, incentives and preferences.

**It deliberately does not contain accounts, account alignments, service
contracts or opportunities.** Those are mastered elsewhere and already arrive in
Fabric. Where SAIP points at one, it stores the source system's key in a column
named `account_external_id` and holds no foreign key. Referential integrity
across that boundary is asserted by `990_verify.sql`, not by the engine — a FK
to a mirrored table breaks the moment the mirror refreshes, and it would make
this database undeployable on its own.

### The saip schema is shared

Dataflow Gen2 destinations land upstream tables (account/sales alignments,
opportunity product) in the **`saip` schema alongside SAIP's own tables**, not
in `dbo`. That works, and nothing here depends on separating them — but it means
*schema* no longer tells you *ownership*, so two things follow:

- **`990_verify.sql` checks by an explicit ownership list**, not by schema.
  Scoping structural checks to "everything in `saip`" would fail on tables this
  deployment does not control and cannot fix. The list at the top of `990` is
  the authority on what SAIP owns.
- **A Replace-mode dataflow pointed at a name SAIP owns would drop that table
  and its data on the next refresh.** `990` prints every table in the schema it
  does not own so the collision is visible before a refresh finds it. Check that
  list after adding any dataflow.

---

## Run order

| # | Script | Creates |
| --- | --- | --- |
| 000 | `000_schema_and_conventions.sql` | `saip` schema, deployment log, conventions |
| 010 | `010_identity_access.sql` | `capability`, `role`, `role_capability`, `user`, `user_role` |
| 020 | `020_configuration.sql` | `question_section`, `option_set`, `option`, `question`, `question_system_reference` |
| 030 | `030_account_monitoring.sql` | `account_monitoring`, `account_monitoring_answer` (+`_option`) |
| 040 | `040_meetings.sql` | `meeting`, `meeting_tag`, `meeting_answer` |
| 050 | `050_incentives.sql` | `incentive`, `incentive_account`, `incentive_user`, `incentive_role`, `incentive_resource` |
| 060 | `060_user_preferences.sql` | `user_preference` |
| 070 | `070_views.sql` | Five views, plus one conditional on the CRM mirror |
| 900 | `900_seed.sql` | Capabilities, roles, grants, sections, dropdowns, questions |
| 990 | `990_verify.sql` | Nothing — read-only checks |

22 tables, 5–6 views. Every script is **re-runnable**: objects are created only
if absent and seed data is `MERGE`d on its business key, so a partial deployment
can be repeated without dropping anything.

```powershell
# Entra auth only — there are no SQL logins in Fabric SQL
sqlcmd -S "<server>.database.fabric.microsoft.com,1433" -d "<database>" `
       -G -C -I -i 000_schema_and_conventions.sql
# …repeat in order, finishing with 990_verify.sql
```

`990` prints PASS/FAIL per check and a `RESULT:` line at the end.

---

## The constraint that shaped every table

These tables reach Power Pages as **Dataverse virtual tables over the SQL Server
connector**, which imposes one hard rule:

> A virtual table's primary key must be a GUID or an integer.

With anything else, reads succeed and **writes fail** with *"No primary key
exists in table"* — surfacing only when a user first tries to save. So every
primary key is `uniqueidentifier` defaulted with `NEWSEQUENTIALID()`, and `990`
asserts it rather than trusting it, including a check for composite keys, which
are equally fatal.

Two further consequences:

- **A virtual table cannot sit on the 1 side of a 1:N relationship** in
  Dataverse. The app filters by id rather than navigating relationships, and
  these tables are indexed for that access pattern.
- **The connector authenticates as one shared identity for every portal user.**
  Per-user visibility is enforced by Power Pages table permissions, never here.
  `created_by` columns are an audit trail, not a security boundary.

---

## Fabric SQL specifics

**Fabric SQL Database shares a code base with Azure SQL Database.** Enforced
`PRIMARY KEY` / `FOREIGN KEY` / `UNIQUE` / `CHECK`, `IDENTITY`, unique indexes,
computed columns, triggers and temporal tables all work normally.

The restrictions widely quoted online — `NOT ENFORCED` constraints, no
`IDENTITY`, no unique indexes — belong to **Fabric Data Warehouse**, a different
item type. They do not apply, and designing around them would have produced a
schema with no integrity at all.

What does differ, and is accounted for:

| Fabric SQL reality | How this build handles it |
| --- | --- |
| Entra ID is the only identity provider; no SQL logins | Connector must use an Entra principal — use a **service principal**, not a person, or the data layer dies when they change role |
| No SQL Server Agent | Anything scheduled (user sync, housekeeping) belongs in a Data Factory pipeline |
| No TDE, no Always Encrypted | Storage encryption with service-managed keys; nothing here assumes column encryption |
| Every eligible table auto-mirrors to OneLake | Documents are stored as **metadata + URL**, never bytes, so mirrors stay small |
| Collation fixed at creation (`SQL_Latin1_General_CP1_CI_AS`) | Uniqueness on labels is case-insensitive by design — two options a user cannot tell apart are a data-entry trap |
| Up to 4 TB, 32 vCores, 150 DBs per workspace | Nowhere near binding for this workload |
| Trial capacity limited to 3 databases | Fine for dev/test/prod-ish, worth knowing before someone adds a fourth |

**Temporal tables are supported but not enabled.** The configuration tables are
the obvious candidates — "who changed this question's wording" is an audit
someone will eventually ask for. It is left off because the interaction between
system versioning and automatic OneLake mirroring needs verifying against the
current mirroring limitations first. `020` carries the exact `ALTER` statements
to switch it on.

---

## Design decisions worth knowing

### Answers are rows, not columns

Account monitoring was seven date columns in the prototype. That only works
while the question set is fixed in code — and the entire point of the admin
portal is that it is not. Answers are therefore one row per
(account, question), in `account_monitoring_answer`.

The cost is real: reporting that wants the old shape needs a pivot.
`saip.vw_account_monitoring_wide` provides one so nobody writes it twice.

**Typed value columns, not one `nvarchar`.** A single text column would make
every date comparison a string parse — and the overdue rule, the thing this
table exists to feed, is a date comparison run across every account on every
notification read. A `CHECK` proves exactly one value column is populated; a
trigger proves it is the *right* one for the question's type, which the
constraint cannot know because it depends on another table.

### Meetings are a hybrid, on purpose

A meeting has a spine — when, where, what, which account — that reporting groups
by and that no administrator should be able to remove. Those are real columns.
Anything an administrator *adds* to the meeting form lands in `meeting_answer`
using the same pattern as monitoring.

Putting the spine through EAV too would make "meetings per account per month" a
pivot over four joins, on the table most likely to be reported on.

### Nominated ≠ assigned

Two tables because they answer two questions. A nominated **account** is a
target of the campaign; an assigned **person** is responsible for acting on it.
A Sales Training incentive typically has no accounts at all and several
assignees — collapsing them would make that inexpressible.

`incentive_user` and `incentive_role` are separate rather than one polymorphic
"assignee" table, because a polymorphic key cannot carry a foreign key and these
both can.

### Nothing derived is stored

- **Incentive status** is a question about `end_date` and today.
  `saip.vw_incentive` computes it. Storing it would mean something has to
  remember to flip it, and the first time that job fails the portal lies.
- **Notifications have no table at all.** A notification exists because a date is
  overdue — it is a question asked of the data, which is why it clears itself
  when the rep updates the date, with nothing to dismiss and nothing to
  reconcile. `saip.vw_overdue_monitoring` *is* the notification list.
  A missing answer counts as overdue: never recorded is not "assume fine", it is
  the strongest signal nobody has done the thing.

### Retire, never delete

Users, options and roles are deactivated rather than removed, because meetings,
incentives and monitoring edits all reference them. The foreign keys agree: a
role still held by anyone is `NO ACTION`, so the database refuses the delete the
admin portal already blocks.

---

## Business keys and why they exist alongside GUIDs

Every configuration row carries **both** a `uniqueidentifier` primary key and a
human-readable `*_key` — `mon-workshop`, `sec-proximity`, `opt-meeting-place`.

The GUID is what Dataverse and the joins use. The key is what the front end
already references: the Account Monitoring ribbon renders `mon-workshop` as a
DOM id, and the notification deep-links target it. It is also stable across
environments, which a GUID minted at deploy time is not — so the same `MERGE`
produces the same logical rows in dev, test and prod with different GUIDs.

**Keys are immutable.** Renaming one detaches every stored answer from the
question it answers. The admin portal shows them read-only and lets the *label*
change instead, which is what anyone actually means by "rename".

---

## The seed is the migration's starting content

`900_seed.sql` is not sample data. Every capability, role, section, question and
option mirrors what the app renders today, key for key.

The test of a correct seed is precise: **when the front end reads from these
tables instead of its TypeScript constants, nothing on screen should change.**

`is_code_dependent` on `option_set` marks the four lists the front end still
matches by exact text — meeting tags, incentive purposes, SLA tiers, opportunity
stages. Renaming an option on one does not fail loudly, it silently stops
matching. **Clear each flag as its consumer is wired**, which makes that column
the checklist for the front-end work that follows this deployment.

### Users are deliberately not seeded

The prototype's people are invented, and invented people in a real database
become invented people in a real report. Load them from Entra instead — `900`
carries the `MERGE` shape and the default-role grant.

**Grant at least one person `role-admin` before switching the portal on**, or
nobody can reach the admin screens to grant it. `990` checks the administrator
role holds `admin.access` for the same reason.

---

## What is not built here, and why

| Not built | Where it lives |
| --- | --- |
| Account, account alignment, contract, opportunity | Mastered upstream, already in Fabric |
| Notifications | Derived — `saip.vw_overdue_monitoring` |
| Incentive status | Derived — `saip.vw_incentive` |
| Document bytes | SharePoint or a Dataverse annotation; only metadata + URL here |
| Row-level security | Power Pages table permissions — the connector is a single shared identity |
| Scores, value overview | Fabric analytics; read-only, no write path needed |

`saip.vw_incentive_opportunity` joins incentives to CRM opportunities on
campaign code. It is **created conditionally** — set `@opportunity_object` in
`070_views.sql` to the mirrored object's real name. Until then the script skips
it with a printed note rather than failing the deployment, and `990` reports it
as absent.

---

## Suggested deployment sequence

1. Create the Fabric SQL Database (**check the collation before creating — it
   cannot be changed afterwards**).
2. Run `000` → `070`.
3. Run `900`. Confirm the counts in `990`: 9 capabilities, 6 roles, 12
   questions, 23 options.
4. Load users from Entra; grant `role-admin` to at least one person.
5. Run `990`. Expect `RESULT: PASS`.
6. Create the Dataverse connection with a **service principal** and add the
   virtual tables. Start with one — `saip.account_monitoring_answer` exercises
   the write path — and prove `GET` and `PATCH` through the Power Pages Web API
   before building the rest.
7. Configure Power Pages table permissions and web roles. **This is the security
   boundary**, not anything in this database.
8. Point `@opportunity_object` at the CRM mirror and re-run `070`.

Step 6 is the one to do first and alone. Writable virtual table + Web API +
table permissions is the least-trodden part of the whole stack, and it is far
cheaper to find a wall there with one table than with twenty-two.
