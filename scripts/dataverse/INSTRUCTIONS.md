# SAIP — get the site running on Dataverse

Five commands, then one upload. Everything below runs in the **VS Code terminal**
(or any PowerShell window). You do not need Node or the Azure CLI.

Unzip anywhere, then:

```powershell
cd <wherever you unzipped>\saip\powershell
```

Every command signs you in the same way: it prints a code, you paste it at
**microsoft.com/devicelogin**, and it carries on. MFA works because it is a real
browser sign-in. The token is never written to disk.

**Every script is safe to re-run.** They check first and skip what already
exists. Nothing is ever deleted.

---

## Step 1 — Fix the contract data

```powershell
powershell -ExecutionPolicy Bypass -File .\Seed-Data.ps1
```

Expect `saip_servicecontracts   10 new   11 updated`.

**Then delete two rows by hand.** Maker portal → **SAIP Service Contract** →
delete these two:

- `4009003121`
- `4009003138`

Those were a bug in my fixtures: five accounts shared the same two contract
numbers, so the earlier seed matched them and overwrote, leaving four accounts
with no contracts at all. The fixtures now give every account its own numbers,
but the seeder never deletes, so the two originals have to go by hand.

---

## Step 2 — Turn the tables on

```powershell
powershell -ExecutionPolicy Bypass -File .\Create-SiteSettings.ps1 -IncludeInnerError
```

Writes 33 site settings — two per table, plus one that makes errors readable.
Expect `Done. 33 created`.

**If it stops and lists your websites**, this environment has more than one and
it will not guess. Re-run adding the name it printed:

```powershell
powershell -ExecutionPolicy Bypass -File .\Create-SiteSettings.ps1 -IncludeInnerError -WebsiteName "SAIP"
```

If two sites share a name it prints their ids instead — use `-WebsiteId "<id>"`.
Whichever you use here, use the same one in step 3.

*This replaces filling in 33 forms in the Portal Management app.*

`-IncludeInnerError` makes Dataverse return the real reason a call failed instead
of a generic message. Useful now, worth removing later — it exposes internal
detail to anyone who can reach the site.

---

## Step 3 — Grant access

```powershell
powershell -ExecutionPolicy Bypass -File .\Create-TablePermissions.ps1 -AdminWebRole "Administrators"
```

Writes 22 table permissions and attaches them to the web roles. Expect
`Done. 22 created`.

*This replaces 22 permission forms in the design studio, each with an "Add roles"
step at the bottom that is easy to miss.*

**Add the same `-WebsiteName` (or `-WebsiteId`) here if step 2 needed one.**

**If it stops and lists your web roles**, the names on your site differ from the
defaults. Re-run with the ones it printed:

```powershell
powershell -ExecutionPolicy Bypass -File .\Create-TablePermissions.ps1 -WebRole "<name>" -AdminWebRole "<name>"
```

Without `-AdminWebRole` everything still works except saving in the admin portal.
That is deliberate — configuration rights should not land on every signed-in
visitor because a parameter was forgotten.

---

## Step 4 — Clear the cache

Power Pages caches both of the things you just wrote. In the design studio
(make.powerpages.microsoft.com), top right → **Sync configuration**.

Skip this and the next step fails for a reason that has already been fixed.

---

## Step 5 — Check it worked

Signed into your portal, open this in the browser:

```
https://<your-site>/_api/saip_accounts
```

**JSON back means steps 2–4 are correct** and the app will work.

| Response | Cause |
| --- | --- |
| JSON | Working — go to step 6 |
| 403 | Table permission. Re-run step 3 with the right `-WebRole` |
| 404 | Site setting, or the cache. Re-run step 2, then step 4 |
| 401 | Portal session expired. Sign in again |

This is **not** the URL that gave you a 401 before. That one was
`orgb9e83276.crm.dynamics.com`, which needs a bearer token a browser cannot
produce. This one is your own portal, so it authenticates on your session
cookie — exactly as the app does.

---

## Step 6 — Tell the app who is signed in

In the design studio, edit your page template's `<head>` and add this above the
app script:

```liquid
<script>
  window.SAIP_USER = {
    id: {{ user.id | json }},
    name: {{ user.fullname | json }},
    email: {{ user.email | json }}
  };
</script>
```

Liquid runs in templates, not in `.js` files, which is why it goes here rather
than in the bundle.

**Without it every rep resolves to the first row in `saip_user`** — same
portfolio, same roles, for everyone. The app logs a warning to the console when
that happens, so you will know.

---

## Step 7 — Upload

The zip has two builds. Copy the contents of **one** of them into your Power
Pages web files folder:

| Folder | Use it when |
| --- | --- |
| `dist-dataverse` | Steps 1–6 are done. Reads the live tables |
| `dist-sample` | You want the UI now, before the setup above. Sample data, works anywhere |

```powershell
# Copy the three files in, replacing what is there
Copy-Item .\dist-dataverse\* C:\powerpages\saip\<your-web-files-folder>\ -Force

# Then upload
pac pages upload --path C:\powerpages\saip
```

Only those three compiled files go into the Power Pages folder — never `src/`,
`node_modules/` or anything `.tsx`. There is no build step on the Power Pages
side.

Check the diff before you upload. I have not run this command.

---

## What you will see

- **Value Overview's hardware spend and prediction tiles read £0.** No dataflow
  produces those figures yet, so the service returns zero rather than inventing
  a number. They fill in when the modelling lands.
- **Incentive documents list but do not download.** The rows exist; the files
  behind them do not yet.
- **The "Sample data" badges are gone** on the Dataverse build, and present on
  the sample one. They follow the data source automatically.
- **The admin portal saves for real** and says so, but the ribbons still read
  their questions from code — so renaming a question there does not yet change
  what a rep sees.

---

## Files in this zip

| | |
| --- | --- |
| `INSTRUCTIONS.md` | This file |
| `powershell/Seed-Data.ps1` | Step 1 — fills the tables |
| `powershell/Create-SiteSettings.ps1` | Step 2 — 33 site settings |
| `powershell/Create-TablePermissions.ps1` | Step 3 — 22 table permissions |
| `powershell/Create-Tables.ps1` | Already run. Here for a rebuild elsewhere |
| `powershell/Get-EntitySets.ps1` | Already run. Re-run only if tables are recreated |
| `powershell/_Common.ps1`, `_Portal.ps1` | Shared sign-in and discovery |
| `generated/*.json` | The table definitions and the 206 records |
| `dist-dataverse/`, `dist-sample/` | The two builds |
| `POWER-PAGES-SETUP.md` | The manual version of steps 2, 3 and 6, if you would rather click |
