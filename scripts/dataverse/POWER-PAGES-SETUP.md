# Switching SAIP onto the Dataverse tables

The tables exist and hold data. This is what has to be true in the Power Pages
site before the app can read them.

**Nothing here is optional.** A table that is missing either its site setting or
its table permission comes back as `403` or as an empty list, and neither error
mentions the setting that is missing — which is why the app's error message says
so explicitly instead.

---

## 1. Site settings — one pair per table

**Power Pages → Settings → Site settings → New.** Sixteen tables, two settings
each. The name uses the table's **logical** name.

| Name | Value |
| --- | --- |
| `Webapi/saip_account/enabled` | `true` |
| `Webapi/saip_account/fields` | `*` |
| `Webapi/saip_capability/enabled` | `true` |
| `Webapi/saip_capability/fields` | `*` |
| `Webapi/saip_incentive/enabled` | `true` |
| `Webapi/saip_incentive/fields` | `*` |
| `Webapi/saip_incentivedocument/enabled` | `true` |
| `Webapi/saip_incentivedocument/fields` | `*` |
| `Webapi/saip_meeting/enabled` | `true` |
| `Webapi/saip_meeting/fields` | `*` |
| `Webapi/saip_monitoringanswer/enabled` | `true` |
| `Webapi/saip_monitoringanswer/fields` | `*` |
| `Webapi/saip_opportunity/enabled` | `true` |
| `Webapi/saip_opportunity/fields` | `*` |
| `Webapi/saip_opportunityline/enabled` | `true` |
| `Webapi/saip_opportunityline/fields` | `*` |
| `Webapi/saip_option/enabled` | `true` |
| `Webapi/saip_option/fields` | `*` |
| `Webapi/saip_optionset/enabled` | `true` |
| `Webapi/saip_optionset/fields` | `*` |
| `Webapi/saip_question/enabled` | `true` |
| `Webapi/saip_question/fields` | `*` |
| `Webapi/saip_questionsection/enabled` | `true` |
| `Webapi/saip_questionsection/fields` | `*` |
| `Webapi/saip_role/enabled` | `true` |
| `Webapi/saip_role/fields` | `*` |
| `Webapi/saip_score/enabled` | `true` |
| `Webapi/saip_score/fields` | `*` |
| `Webapi/saip_servicecontract/enabled` | `true` |
| `Webapi/saip_servicecontract/fields` | `*` |
| `Webapi/saip_user/enabled` | `true` |
| `Webapi/saip_user/fields` | `*` |

Plus one, worth having while this is being set up:

| Name | Value |
| --- | --- |
| `Webapi/error/innererror` | `true` |

That makes Dataverse return the real reason a call failed instead of a generic
message. Turn it off before anyone outside the team uses the site — it exposes
internal detail in the browser.

### `fields` set to `*`

`*` means every column. Narrowing it is a real hardening step later, but doing it
now guarantees a column gets missed and produces a blank tile with no error at
all. Get it working first, then tighten.

---

## 2. Table permissions — what each role can do

**Power Pages → Set up → Table permissions.** Create one per table, attach it to
the web role, and set the access type to **Global** (these tables have no owner
or account relationship to scope by).

Read is enough for most of them. Four tables need more, because the app writes
to them:

| Table | Privileges | Why |
| --- | --- | --- |
| `saip_monitoringanswer` | Read, Write, **Create** | Saving the monitoring form creates the answers that don't exist yet |
| `saip_meeting` | Read, **Create** | Logging a meeting |
| `saip_incentive` | Read, Write, **Create** | Creating an incentive; changing its assignment |
| `saip_incentivedocument` | Read, Create, Delete | Attaching and removing documents (once the upload path lands) |
| every other `saip_*` table | Read | |

**The admin portal needs more, and only for administrators.** Editing roles,
users, questions and dropdowns writes to `saip_role`, `saip_user`,
`saip_question`, `saip_questionsection`, `saip_optionset` and `saip_option`. Give
those Read + Write + Create + Delete on the **administrator role only** — the
admin screens are hidden from everyone else, but the Web API is reachable
regardless of what the UI shows, so the table permission is the actual gate.

---

## 3. Who is signed in

The app needs to know which `saip_user` row is the visitor. Add this to the page
template's `<head>`, above the app script:

```liquid
<script>
  window.SAIP_USER = {
    id: {{ user.id | json }},
    name: {{ user.fullname | json }},
    email: {{ user.email | json }}
  };
</script>
```

Liquid runs in web templates, not in `.js` web files, which is why this goes in
the template rather than in the bundle.

**Without it the app falls back to the first user in the table and logs a
warning.** That is fine for a demo and wrong for anything else — every rep would
see the same portfolio and hold the same roles.

---

## 4. Build the right bundle

The data source is fixed at build time:

```powershell
# Reads Dataverse through /_api
$env:VITE_DATA_SOURCE = "dataverse"
npm run build
```

Anything else — including not setting it — builds against the sample data.

There is deliberately no auto-detection. A bundle that changes data source
depending on where it is opened is impossible to reason about when a screen
comes back empty, and "is this even talking to Dataverse?" is the first question
worth being able to answer.

The zip ships both builds so they can be swapped without a rebuild:

- `dist-sample/` — sample data, works anywhere, shows "Sample data" badges
- `dist-dataverse/` — reads the tables, works only inside Power Pages

The badges are not decoration. They are gated on the same flag as the data
source, so a screen showing real figures never wears one and a screen showing
invented figures always does.

---

## 5. What still shows nothing

**Value Overview's hardware spend and prediction tiles read £0.** There is no
source for them — they came from the brief as modelled figures and no dataflow
produces them. The service returns zeroes rather than inventing numbers, because
a plausible fabricated revenue prediction is the one thing on that page that
could actually mislead someone into a decision. They will fill in when the
modelling lands.

**Incentive documents list but do not download.** The rows exist; the bytes live
in a Dataverse note that nothing writes yet. The UI already renders that state as
unavailable.

---

## If a screen comes back empty

Open the browser console. The Web API errors say which of the two things above
is missing:

- **403** — table permission, for the web role the signed-in user actually holds
- **404** — the site setting, or an entity set name that doesn't match this
  environment. If the tables were recreated elsewhere, re-run
  `Get-EntitySets.ps1` and paste its output over `src/services/dataverse/entitySets.ts`
- **401** — the portal session expired; sign in again
