# SAIP — Services Account Intelligence Portal

Front-end for the HPE Services Account Intelligence Portal, deployed as the entire
front end of a **Microsoft Power Pages** site.

This repository holds **both halves**:

| Path | What it is |
| --- | --- |
| `src/`, `vite.config.ts`, … | The React / Vite / TypeScript application |
| `powerpages/` | The Power Pages site tree, uploaded with `pac pages upload` |

The React app is built to a pinned two-file bundle that is copied into
`powerpages/web-files/` and served by a Web Template. **Power Pages has no Node
build step** — only compiled output ever goes into `powerpages/`, never `src/`.
See [Deploying to Power Pages](#deploying-to-power-pages).

> **This prototype runs entirely on invented sample data.**
> No account name, score, contract, city, date or spend figure in this repository
> is real. See [Placeholder data checklist](#placeholder-data-checklist) for the
> punch list to clear before release.

---

## Quick start

```bash
npm install
npm run dev              # http://localhost:5173
npm run build            # type-check + production bundle into dist/
npm run build:powerpages # build, then sync the bundle into powerpages/
npm run typecheck        # types only
npm run build:debug      # build with sourcemaps, for local debugging only
```

Requires Node 18+.

To ship a change to the live site:

```bash
npm run build:powerpages
pac pages upload --path ./powerpages --modelVersion 2
```

That is the whole loop. [Full detail below.](#deploying-to-power-pages)

---

## What's built

| Area | Status |
| --- | --- |
| Homepage — Account Selection Pane | Built |
| Account Focus — Home tab (what needs attention) | Built — the default tab |
| Account Focus — score gauges | Built, on the header line |
| Account Focus — Ribbon A, Value Overview | Built |
| Account Focus — Ribbon B, Active Service Contracts | Built |
| Account Focus — Opportunities (CRM, line-item grain rolled up) | Built |
| Account Focus — Ribbon C, Account Monitoring (editable) | Built |
| Log a Meeting modal (both entry points) | Built |
| Business Development — incentives, resources, nominated accounts, opportunities | Built |
| Admin portal — users, roles & capabilities, questions, dropdowns | Built (collapsed cards, drag-to-reorder; config not yet consumed by the app) |
| My Incentives — what is assigned to the signed-in person | Built |
| SAIP.Ai assistant | Placeholder only — structural, no agent behind it |
| Retractable left navigation | Built |
| Profile & settings — theme, accent, notification options | Built |
| Light / dark themes + selectable accent | Built |
| Copilot Studio widget | Container + launcher only, per brief |
| Executive View | Nav placeholder only, per brief |
| Entra ID authentication | Deliberately absent — Power Pages handles it |
| Dataverse / Fabric integration | Mock service layer only, built to be swapped |

### Demo flow

Homepage → pick an account → Account Focus opens on **Home**, which says what
needs attention and links to the tab that handles it → **Log a meeting** →
the saved meeting appears under *Recent Meetings*. Meeting logs and Account
Monitoring edits persist in memory for the session, so the write paths are
genuinely exercised rather than faked.

---

## Architecture

```
src/
  services/          ← the ONLY place data comes from
    types.ts           domain types + the AccountService interface
    index.ts           SWAP POINT: binds the interface to an implementation
    derive.ts          derived business rules (overdue, renewing-soon, formatting)
    mock/              invented data + the mock implementation
                       (mockData.ts, mockIncentives.ts, mockAdmin.ts)
  motion/            motion tokens, Framer variants, reduced-motion hook
  hooks/             useAsync (race-safe loader), useCountUp
  components/
    common/            SampleDataBadge, Skeleton, AnimatedModal
    shell/             AppShell (nav), PageHeader, CopilotWidget, SaipAiPrompt
    accounts/          AccountSelectionPane
    scores/            ScoreCard, ScoresOverview, ScoreMiniRow (header gauges)
    focus/             the Account Focus ribbons — Home, Opportunities, the rest
    meetings/          MeetingLogModal, MeetingLogProvider, MeetingHistory
    bizdev/            incentive resources, opportunities table, create form
    admin/             users, roles & capabilities, questions, option sets
  pages/             HomePage, AccountFocusPage, BusinessDevelopmentPage,
                     MyIncentivesPage, AdminPage, ProfilePage, PlaceholderPage
  settings/          SettingsProvider (theme + notifications), accent catalogue

scripts/
  sync-powerpages.mjs  copies dist/ into the site tree, with guard rails

sql/                 ← Fabric SQL Database build (see sql/README.md)
  000…080            schema, tables, views — run in order, all re-runnable
                     (080 = views over the two dataflow tables)
  900_seed.sql       the migration's starting content, keyed to the front end
  990_verify.sql     read-only PASS/FAIL checks

powerpages/          ← the Power Pages site tree (pac pages download/upload)
  web-files/           saip-app.js + saip-app.css and their .webfile.yml records
  web-templates/       SAIP App Host — renders the whole document
  page-templates/      SAIP App — header/footer suppressed
  web-pages/home/      repointed at the SAIP App page template
```

**No component reaches past `services/`.** Every figure on screen arrives through
the `AccountService` interface, so nothing has to be untangled from a component
when the real data source lands.

### Going live against Dataverse

1. Add `src/services/dataverse/dataverseAccountService.ts` implementing
   `AccountService` from `src/services/types.ts`.
2. Change the single line marked `SWAP POINT` in `src/services/index.ts`.

That's the whole integration surface. No component imports change, and
`IS_USING_PLACEHOLDER_DATA` flips to `false`, which removes every "Sample data"
badge across the app at once.

The whole-app "Prototype" banner that used to sit above the header has been
removed at the client's request. The per-card badges are deliberately kept: they
travel with the figure they qualify, so a screenshot of one ribbon still carries
its own caveat, which a banner at the top of the page did not.

Reads map to Dataverse table queries; the two write paths are
`saveAccountMonitoring` and `logMeeting`.

Whatever backs the data, the app reaches it through the **Power Pages Web API**
(`/_api/<entityset>`), which speaks Dataverse only — so every entity has to surface
as a Dataverse table, native or virtual. Two constraints found while scoping this,
recorded here so they aren't rediscovered the hard way:

- **Fabric OneLake virtual tables are read-only**, so they can never serve
  `saveAccountMonitoring` or `logMeeting`. They also require the Fabric capacity to
  be in the *exact same region* as the Dataverse environment.
- **SQL Server virtual tables are writable** and carry no region requirement. They
  need a GUID or integer primary key — with anything else, reads succeed and writes
  fail with *"No primary key exists in table"*. A virtual table also can't sit on
  the 1 side of a 1:N relationship, so filter by `accountId` rather than modelling
  relationships.

Per-user scoping must be enforced by Power Pages table permissions, not by the
backing store: the virtual connector uses a single shared identity for every
portal user.

### Access model

Users and roles are separate tabs because they are separate jobs. The Users
table is a list of people — name, email, last active, an **SAIP Admin** tickbox
and one **job role** from a dropdown. Roles is where a role's *capabilities* are
set.

**Admin is additive, not a job role.** An administrator is still an account
manager or a BD lead, so the tickbox grants `role-admin` alongside whatever the
dropdown says. Underneath, a user still holds a set of roles — what Dataverse
stores — but presenting the raw set made people reason about six checkboxes when
they only ever meant two things.

Capabilities come from a **closed catalogue** (`CAPABILITIES` in
`services/types.ts`), so a role can only be granted access to something the app
actually has. Each maps to a set of Power Pages table permissions; the tick is
the intent, the table permission is the gate.

Two role rules are enforced in the service: a role still held by anyone cannot be
deleted, and the administrator role cannot drop `admin.access` — that would lock
everyone out of the admin portal itself.

### Incentive assignment

An incentive reaches people two ways, and the distinction matters:

- **Nominated accounts** are the *targets* of a campaign. They surface on the
  account's own page, under an **Incentives** tab, showing only the
  opportunities raised against that account rather than the campaign's whole
  pipeline.
- **Assigned users and roles** are who is *responsible*. They surface under
  **My Incentives**, which says why each item is there — named directly, or via
  a role. Assigning by role means anyone joining that role picks it up without
  a list being edited.

A Sales Training incentive typically has no accounts at all and several
assignees, which is why the two are separate fields rather than one.

### Configuration as data

The admin portal (`/#/admin`) manages the questions the app asks, the dropdowns
those questions choose from, and who holds which web role. The seeded values in
`mockAdmin.ts` mirror what the app renders today **field id for field id** — the
Account Monitoring question ids are the same `mon-*` strings the ribbon and the
notification deep-links already use.

That is deliberate: those records are the shape of the eventual tables, and the
seed is the migration's starting content. When the app is wired to read from
them, nothing on screen should change.

Sections, questions, dropdowns and their options are all editable — renamed,
reordered, added and (where safe) deleted.

**Ids are shown but never editable.** `sec-proximity`, `mon-workshop`,
`opt-meeting-place` are what the code, the notification deep-links and the
database join on; renaming one would detach a stored answer from the question it
answers. Labels are free to change, which is what anyone actually wants.

**Edits are a draft until saved.** Each section and each dropdown is one card
with a single Save at the bottom — nothing reaches the service on a keystroke.
The bar appears only once something has changed, lists every reason a save is
blocked, and offers Discard.

Rules live in `components/admin/validation.ts` as pure functions, so they can be
reasoned about and eventually reused by whatever enforces the same thing
server-side. Two levels, and the difference is deliberate:

- **error** blocks the save — the change would break the app or make the record
  meaningless (blank title, duplicate option labels, a dropdown question with no
  list, hiding a question a notification depends on, renaming an option on a
  `codeDependent` list).
- **warning** goes ahead — it only affects how existing *data* reads (deleting a
  question orphans its answers, making a field required leaves old records
  incomplete). An admin may make a mess of their own labels; they may not detach
  a notification from the question that feeds it.

`QuestionDefinition.systemReferences` is what makes that data-driven rather than
a hardcoded list of ids in the UI: a question naming a dependency there cannot be
hidden, retyped or deleted, and the app shows an "In use by the app" badge on it.

**Deletes are guarded in the service, not just the UI**, because the rules are
properties of the data:

| Delete | Blocked when |
| --- | --- |
| Question section | it still holds questions — they would render nowhere |
| Dropdown | a question points at it, **or** it is `codeDependent` |

The second dropdown case is the one a UI-only guard would have missed: SLA tiers
and opportunity stages back typed unions in the front end but are referenced by
no *question*, so nothing on screen would have stopped them being deleted.

**Not yet consumed.** The ribbons and the meeting form still use their TypeScript
constants, so an edit in the admin portal does not change them yet. The portal
says so in its own banner rather than only here.

The database that backs all of this is built in **[`sql/`](sql/README.md)** — 22
tables, seeded so that when the front end reads from them instead of its
constants, nothing on screen should change. Wiring those consumers is the
remaining step.

---

### Opportunities, and the upstream tables

Two Dataflow Gen2 destinations land in the **`saip` schema** of the Fabric SQL
database — `saip.[FY26 Alignments MAIN]` (accounts and sales alignments) and
`saip.Opportunities` (a Salesforce export). Neither belongs to SAIP, and nothing
reads them directly; `sql/080_upstream_views.sql` puts five views in front of
them and `sql/README.md` explains each one.

Three consequences reach the front end:

**`Account.companyGroupId` is the join key to everything upstream.** It is
`Company Group ID` on the alignments table and `Country Sales Entity ID` on
Opportunities — the same value under two names. `accountId` remains SAIP's own
surrogate for routing.

**`Opportunities` is at PRODUCT LINE-ITEM grain.** One opportunity worth £400k
across six products arrives as six rows carrying identical header fields. The
Opportunities ribbon shows one row per *opportunity* with its product lines
expanding underneath, and `getAccountOpportunities` returns them already
grouped — because the grouping happens in `saip.vw_account_opportunity`. Doing
it in the browser would mean fetching every line through the Power Pages Web
API, which pages at 5,000 rows and cannot aggregate. The same reasoning produced
`saip.vw_account_pipeline`: one row per account for every headline figure.

**The header total and the line subtotal do not reconcile, and both are shown.**
`Total Value to HPE (converted)` includes elements with no product line behind
them, so the expanded view labels the line subtotal as a subtotal rather than
presenting either number as "the" value. The mock fixtures reproduce the gap
deliberately — a pane that assumed they matched would look right here and be
wrong against real data.

⚠️ Two things in `080` are marked `CONFIRM:` and need real data: the actual
values in `[Opportunity Sales Stage]`, and which of the three campaign-shaped
columns carries the code an incentive is created with.

### Admin screens: collapsed by default

Roles, sections and dropdowns each render as a **closed card**. Questions used to
render every question of every section expanded, which was several thousand
pixels of form before you could see what sections existed.

Two details are load-bearing:

- **Draft state lives in the card component, not inside the collapse.** The body
  unmounts when closed — fifty mounted cards meant fifty live drafts revalidating
  on every keystroke — but the draft survives, and an `Unsaved changes` chip on
  the closed header says so.
- **Delete and reorder stay on the closed header.** Removing a dropdown or moving
  a section are decisions made *from the list*; needing to expand one to reach
  them would be backwards. They are siblings of the expand button, never children
  of it — nesting a button inside a button is invalid and fires both.

Dropdown options and questions can be **dragged to reorder**, via framer-motion's
`Reorder` (already a dependency) with `dragListener={false}` and an explicit
handle. A row-wide drag listener would make the text inputs in each row
unselectable. The Up/Down buttons remain, and are not redundant: a pointer drag
is unusable by keyboard, which is also why the grip is `aria-hidden`. A drag
renumbers from the array index rather than swapping a pair, since a drag can
cross several rows at once.

---

## Token provenance — confirmed vs. assumed

Values were read out of the **published packages** (`hpe-design-tokens@2.2.3`,
`grommet-theme-hpe@8.1.4`) rather than transcribed from the docs site, so the
"confirmed" rows below are what HPE actually ships.

### Confirmed from the live design system

| What | Source | Notes |
| --- | --- | --- |
| Semantic colours | `hpe-design-tokens` → `color.light.css` | `background-*`, `text-*`, `border-*`, `foreground-*`, `icon-*`. **No raw hex anywhere in this codebase.** |
| Brand colour | `--hpe-color-decorative-brand` | Used for the nav mark and active indicators. |
| Status colours | `background-ok/warning/critical`, `foreground-ok/warning/critical` | Drive score status, renewal badges, overdue flags. |
| Font stack | `--hpe-fontStack-primary` | `'HPE Graphik', Arial, sans-serif`. |
| Font weights | `--hpe-fontWeight-*` | light 300 · regular 400 · medium 500 · semibold 600 · bold 700. |
| Font files | woff2 URLs extracted from `grommet-theme-hpe` | `https://www.hpe.com/content/dam/hpe/fonts/graphik/…` |
| Type scale | `--hpe-base-fontSize-*` | Applied via Grommet's `Text`/size props. |
| Spacing, radius, shadow | `--hpe-spacing-*`, `--hpe-radius-*`, `--hpe-shadow-*` | |
| Breakpoints | `--hpe-breakpoint-*` | 576 / 768 / 1080 / 1440. |
| Focus indicator | `--hpe-focusIndicator-*` | Applied globally to `:focus-visible`. |

### Assumed — reconcile before release

| # | Assumption | Why | Where |
| --- | --- | --- | --- |
| 1 | **Motion durations and easing are placeholders.** | `hpe-design-tokens@2.2.3` ships **no motion tokens** — searching every file in the package for `motion`/`duration`/`easing`/`transition`/`cubic-bezier` returns nothing. The brief's fallback scale is used instead: fast 140ms, standard 220ms, entrance 340ms, exit 260ms; ease-out entrances, ease-in exits, ease-in-out state changes. | `src/motion/tokens.ts` — all in one file, so reconciling is a single edit. No component hardcodes a duration. |
| 2 | **`fontWeight-light: 300` is mapped to the Extralight web font.** | HPE's CDN publishes Extralight / Regular / Medium / Semibold / Bold. There is no file named "Light", though the token scale defines 300. | `src/styles/fonts.css` |
| 3 | **Ambient loop duration (2.6s) is invented.** | Not covered by the brief or any token. Chosen slow enough to read as a flag rather than a distraction. | `src/motion/tokens.ts` (`duration.ambient`) |
| 4 | **90-day "renewing soon" window.** | Taken from the brief's worked example (*"e.g. within 90 days"*), not from a confirmed business rule. | `src/services/derive.ts` (`RENEWAL_SOON_DAYS`) |
| 5 | **12-month monitoring cadence.** | Same — the brief's example (*"no workshop in 12 months"*). Drives both the derived workshop flag and the overdue flags. | `src/services/derive.ts` (`MONITORING_OVERDUE_MONTHS`) |
| 6 | **Light mode only.** | `color.dark.css` ships in the token package but SAIP has not decided whether it supports dark mode. | `src/main.tsx` — swap the colour CSS import to enable. |
| 7 | **`en-GB` locale and GBP formatting.** | Mock accounts are all UK & Ireland. Real data will need locale/currency per account. | `src/services/derive.ts` |
| 8 | **Glow treatments are composed, not tokenised.** | HPE publishes `--hpe-shadow-*` but nothing for coloured glow. Each glow is a `box-shadow` built **from the semantic colour tokens** (`--hpe-color-foreground-ok`, `-warning`, `-critical`, and the accent), so a glow can't drift off-palette — but the blur radii and spreads are chosen, not sourced. | `src/motion/tokens.ts` (`glow`, `svgGlow`) |
| 9 | **SLA coverage model (`customer` vs `location`).** | Read from the brief as: some customers hold one contract covering every site, others hold a contract per site. It changes what the SLA spend breakdown counts — contracts or locations. **Confirm the rule and which accounts fall into which model.** | `src/services/types.ts` (`SlaCoverageModel`), `mockData.ts` (`MOCK_COVERAGE_MODEL`) |
| 10 | **SLA tier and meeting tag colours.** | Drawn from HPE's base ramps and ordered so the palette carries meaning (SLA rises green → blue → orange → red with criticality). The *mapping* is a design choice, not an HPE standard. | `src/services/types.ts` (`SLA_TIER_COLORS`, `MEETING_TAG_COLORS`) |
| 11 | **Notification rules.** | Only two rules are implemented — overdue workshop and overdue/missing executive sponsor review — because those are the two the brief named. The full rule set needs defining. | `mockAccountService.ts` (`buildNotifications`) |

---

## Placeholder data checklist

Everything below renders invented data today. Each item is marked in the UI with
a **"Sample data"** badge and in code with a `PLACEHOLDER DATA` comment. Clear
this list once the Dataverse/Fabric source is wired up.

| # | Screen / component | Placeholder content | File |
| --- | --- | --- | --- |
| 1 | App-wide banner | "Prototype … invented sample data" bar across every page | `components/shell/AppShell.tsx` |
| 2 | Homepage greeting | Signed-in user's display name ("Sample User") | `pages/HomePage.tsx` → `MOCK_CURRENT_USER` |
| 3 | Account Selection Pane | 8 fictional accounts: names, industries, regions, revenue, contract counts, last-meeting dates | `services/mock/mockData.ts` → `MOCK_ACCOUNTS` |
| 4 | Overview (homepage) | Portfolio scores, statuses, period deltas, explainer copy | `MOCK_PORTFOLIO_SCORES` |
| 5 | Scores (Account Focus) | Per-account score overrides + fallback set | `MOCK_ACCOUNT_SCORES`, `MOCK_DEFAULT_ACCOUNT_SCORES` |
| 6 | Ribbon A — Value Overview | SLA spend %, total contracted spend, last upsell date + description, 48-month hardware spend, 12-month prediction, model confidence | `MOCK_VALUE_OVERVIEW`, `MOCK_DEFAULT_VALUE_OVERVIEW` |
| 7 | Ribbon B — Active Service Contracts | Contract numbers (real 400-prefixed 10-digit *shape*, invented numbers), SLA tiers, values, cities, renewal dates | `MOCK_CONTRACTS`, `MOCK_DEFAULT_CONTRACTS` |
| 7b | Notification pane | Derived from the invented monitoring dates — real rules, fake inputs | `mockAccountService.ts` → `buildNotifications` |
| 8 | Ribbon C — Account Monitoring | Seeded relationship-health dates + audit trail | `MOCK_MONITORING` |
| 9 | Ribbon C — two field **names** | `lastExecutiveEngagement`, `lastServiceReviewWithSponsor` — names **not confirmed**, rendered with a visible "Field name TBC" chip | `services/types.ts`, `components/focus/AccountMonitoringRibbon.tsx` |
| 10 | Recent Meetings | 3 seeded meeting logs | `MOCK_MEETINGS` |
| 11 | Meeting log writes | Saved in memory only; lost on reload | `services/mock/mockAccountService.ts` |
| 12 | Copilot widget | Seeded conversation, suggested prompts and a single canned reply — no bot connected | `components/shell/copilotPlaceholder.ts` |
| 13 | Current user identity | Stands in for the Entra ID identity Power Pages supplies | `MOCK_CURRENT_USER` |

Mock dates are generated **relative to today**, not hardcoded, so the prototype
keeps demonstrating its own edge cases (contracts inside the 90-day window, a
workshop overdue past 12 months) however long it sits before review.

---

## Motion

Every animation is defined through `src/motion/` — components pass a `reduced`
flag into variant factories rather than branching themselves, so the
reduced-motion fallback cannot be forgotten in a new component.

| Type | Behaviour |
| --- | --- |
| Entrance | Staggered reveals throughout — nav items, score cards, account rows, metric tiles, contract rows, form fields, modal fields. Gauges fill from zero while figures count up; the header slides down and the brand mark draws itself in; a one-shot light sweep crosses score cards and metric tiles as they land. |
| Opening | The SAIP wordmark fades in letter by letter, left to right; see "Opening animation" below. |
| Route | Pages animate **in** on a key change. There is deliberately no route *exit* animation — see "Two things not to reintroduce". |
| Tabs | Ribbon panels enter from the side you came from; the active underline is a shared `layoutId` element that slides between tabs and carries a brand glow. |
| Exit | Modal, calendar popover, Copilot panel and tab panels all animate out. Nothing disappears abruptly. |
| Idle | Skeleton shimmer while loading; slow glow pulse on "needs attention" scores and contracts renewing within 90 days; an ambient halo on the collapsed Copilot launcher. Nothing else moves once settled. |
| Hover | Every interactive element responds — account rows slide and grow a brand rail, cards and tiles lift into a coloured glow, chips and tabs lift, the launcher bounces — all on the same `fast` timing. |
| Feedback | Saves play a spring checkmark with an expanding ring burst; tag chips pop on select; the derived "workshop held in the last 12 months" flag re-pops when an edit flips it, so the consequence of a change is visible. |

### Two things not to reintroduce

Both of these caused the same user-visible symptom — **a blank page** — and both
looked completely fine in casual testing. They're recorded here because each is
a natural thing to add back.

**1. `AnimatePresence mode="wait"` around the routes.** It holds the incoming
page until the outgoing one finishes exiting. Navigate again before that exit
completes — faster than ~260ms, i.e. ordinary clicking — and the presence state
stalls: the old page is gone, the new one hasn't been allowed to mount, and
`<main>` is empty. Routes now use a plain keyed `motion.div` with no exit, so
the next page always mounts immediately. Modals, popovers and the assistant
panel keep their exit animations, because nothing is waiting to replace them.

**2. `whileInView` + `viewport={{ once: true }}` for section entrances.** The
element starts at `opacity: 0` and only becomes visible if an
IntersectionObserver callback fires. Anything that stops that happening — a
restored scroll position, a different scrolling ancestor, an iframe whose
viewport isn't what the observer measures against — leaves real content
permanently invisible. `revealOnMount` in `motion/variants.ts` gives the same
movement with no such failure mode. For a portal whose entire job is showing
account data, "sometimes blank" is far worse than "everything arrives at once".

`ScrollToTop` remains, because carrying the previous page's scroll offset into
the next route is wrong regardless.

### Accent green

The app standardises on the **light HPE Brand green `#01a982`** — the token HPE
labels "HPE Brand" — in place of the darker greens the theme reaches for by
default (`foreground-primary` is `#006750`, `background-primary-strong` is
`#068667`). It's defined once as `--saip-accent` in `styles/global.css`.

Text sitting on the accent uses `--saip-on-accent` (dark), not white: white on
`#01a982` measures **3.00:1**, which passes WCAG 1.4.11 for icons but not the
4.5:1 that 1.4.3 requires for text. Dark text reaches **4.57:1**. The one place
white is used on the accent is the Copilot launcher icon, which is a graphic.

### Notification pane

A bell in the top ribbon with a live count, opening an animated pane.

Notifications are **derived, not stored** — an overdue workshop is a fact about
the monitoring record, not a row someone has to remember to create and dismiss.
Update the date and the notification is gone on the next read. There is no
notification table to keep in sync and nothing to mark as read.

Selecting one deep-links to the exact field that caused it:
`/account/:id?ribbon=monitoring&field=mon-workshop`. Account Focus reads those
params, opens the right ribbon, scrolls the field into view and highlights it
for a few seconds. Landing the rep on the page but leaving them to hunt for the
row would waste most of the value of having the alert.

Two rules are implemented, both named in the brief: overdue workshop, and
missing/overdue executive sponsor service review.

### Opening animation

`AppIntro` fades the SAIP wordmark in letter by letter, left to right, each
letter rising slightly into place. The whole overlay then fades away — the
letters don't animate out individually, which keeps the exit quick. The **"i" is
lower-case and set in the accent green**, so the mark carries the brand colour
without needing a separate device.

It runs to about **0.85s** on screen. This sits in front of the app on every
load, so it should register and get out of the way. Letters are eased rather
than sprung: a spring overshoots, and four letters settling at visibly
different moments reads as wobble at this size.

It plays on **every page load, including refreshes**. It does not replay on
client-side navigation — the component mounts once per document, so moving
between routes leaves it alone. Under reduced motion it never mounts; there is
nothing to it but motion.

There is no persisted "already seen" flag, which is deliberate: the previous
version kept one in `sessionStorage`, and `sessionStorage` *throws* rather than
returning null in a sandboxed iframe, in Safari with strict tracking protection,
and in Firefox with third-party storage blocked. That exception escaped during
render and took the whole app down to a blank page over a cosmetic flag. Playing
every time removes the need for storage entirely.

Components whose own entrance would otherwise play *underneath* the overlay
schedule around it via `introRemainingMs()` — that's why the "Log a meeting"
button waits before extending. It returns 0 once the intro is done, so a button
mounted on a later page doesn't wait for an overlay that isn't there.

### Glow

Glow is used to signal **state** — attention, selection, focus, success — never as
ambient decoration on a resting element. Every glow is built from a semantic
colour token, so status colour and glow colour can never disagree. The one place
glow is deliberately *static* is the Account Monitoring overdue flag: an overdue
field can stay overdue for months, and a looping animation there would be a
permanent distraction.

### Copilot Studio widget

Originally scoped as "container only". A working placeholder conversation was
added later at the client's request so the interaction can be demonstrated:
a seeded exchange, suggested prompt chips, a text composer, an animated typing
indicator, and message bubbles that spring in from their own side of the
conversation.

**It is not an assistant.** Every message gets the same canned reply, which
quotes the question back and then says plainly that it isn't connected. That was
deliberate — a plausible-looking fake answer would get screenshotted and
mistaken for a working bot. The panel header carries a permanent
"Placeholder — not connected to Copilot Studio" line that can't be scrolled away.

**To embed the real bot:** replace the `<MessageList>`/`<Composer>` block in
`CopilotWidget.tsx` with the Copilot Studio `<iframe>` and delete
`copilotPlaceholder.ts`. The launcher, panel, open/close animation, focus
handling and layout need no changes.

**Launcher colour and contrast.** The launcher uses `--hpe-color-decorative-brand`
(#01a982, the token HPE labels "HPE Brand") with an explicitly white icon. The
default `icon-onPrimaryStrong` token resolves to near-black (#292d3a) in light
mode, which is why white is set directly rather than via the token.

Measured against white:

| Green | Hex | Contrast with white | Verdict |
| --- | --- | --- | --- |
| green-500 "Landmark Primary" | `#00e0af` | 1.71:1 | Fails — too light for a white icon |
| **green-600 "HPE Brand"** | `#01a982` | **3.00:1** | Passes WCAG 1.4.11 (3:1) for icons — used on the launcher |
| green-700 | `#068667` | 4.55:1 | Passes 1.4.3 (4.5:1) for text — used on the panel header and user bubbles |

The limiest green was ruled out on contrast. The panel header and user message
bubbles use green-700 rather than the brand green because they carry 14px body
text, which needs 4.5:1 — the launcher keeps the brighter brand green because it
carries an icon, not prose.

**Launcher motion.** The `<button>` element itself is a fixed, transparent hit
target and is never transformed; all idle motion lives on an inner disc. An
animated button would mean the click target drifts continuously, which is
materially harder to hit for anyone with a motor impairment. The float also
pauses on hover so the disc settles under the cursor.

### Date picker

`<input type="date">` has been replaced everywhere by `components/common/DatePicker.tsx`.
The native control is drawn by the browser, ignores the HPE palette entirely and
looks like a different product on every OS.

The calendar inside is Grommet's `<Calendar>`, which `grommet-theme-hpe` already
themes from semantic tokens (day hover, selected, in-range and adjacent-month
states all resolve to `--hpe-color-*`) — hand-rolling a month grid would have
meant re-deriving all of that by eye. What is custom is the trigger, the animated
popover, the Today/Clear actions, the drop-up flip when there's no room below,
and the focus and keyboard handling. Dates cross the component boundary as
`YYYY-MM-DD` strings and the day is taken verbatim from Grommet's ISO output
rather than re-parsed through `Date`, which would shift the day for anyone west
of UTC.

**`prefers-reduced-motion: reduce` is honoured two ways:** variants collapse to
zero-duration and zero-travel (so content lands in its final state rather than
being skipped), and a global CSS block neutralises any CSS animation, including
Grommet internals. Under reduced motion the score card explainer switches from
hover-revealed to always-visible, so no information is gated behind an animation.

---

## Accessibility

- Heading levels run `h1` → `h2` (sections/ribbons) → `h3` (form sections) without skipping.
- Every form field in the Meeting Log and Account Monitoring forms has a real
  `<label>` bound via `htmlFor`/`id`.
- Selectable account rows, tabs and tag chips are real `<button>`s with
  `aria-pressed` / `role="tab"` / `aria-selected`, not styled `<div>`s.
- The contracts ribbon is a real `<table>` with `<th scope="col">` and a caption.
- The modal traps focus, restores it to the trigger on close, closes on Escape,
  and is labelled by its own heading.
- Status changes (save confirmations) are announced via `role="status"`.
- Overdue and status states are communicated by icon + text, never colour alone.

---

## Theming

Light or dark, plus a user-selectable accent that replaces the green throughout.
All of it is HPE design tokens — no invented colour anywhere.

### Light / dark

HPE ships this as a first-class pair and the app does not reimplement any of it:

| Sheet | Selector |
| --- | --- |
| `color.light.css` | `:root, [data-mode=auto], [data-mode=light]` |
| `color.dark.css` | `[data-mode=dark]`, plus `[data-mode=auto]` inside `prefers-color-scheme: dark` |

Both are imported in `main.tsx` (dark second — order matters). `SettingsProvider`
writes `data-mode` onto `<html>` and several hundred colour tokens flip. Because
`auto` is a real value in HPE's selectors, "follow my device" needs no extra code
and tracks a system theme change live.

Grommet gets the same mode through `themeMode` on `<Grommet>`, resolved to a
concrete `light` | `dark` — Grommet has no concept of `auto`.

### Accent

`--saip-accent` and `--saip-on-accent` are set on `<html>` by `SettingsProvider`
and consumed everywhere. **No component names an accent colour directly.**

Each accent in `src/settings/accents.ts` carries **two** values — a saturated mid
step for light mode and a lifted step for dark — because a colour that reads well
on white is usually too dark on near-black. `on` is the text/icon colour that sits
ON the accent, and every pair is annotated with its measured contrast ratio
against WCAG 1.4.3 (4.5:1).

Do not add an accent without measuring both modes. Several obvious candidates
fail: plain `blue-500` is 4.49:1 on white and 3.05:1 on ink, so it passes with
neither foreground.

**`--saip-accent-solid` / `--saip-on-solid` are a second, separate pair, used by
every FILLED BUTTON.** They exist because a button label is body text owing
4.5:1, while a decorative fill only owes the 3:1 of a UI component — and no
single colour satisfies both:

- In **light** mode the accent is a mid step, and white on `green-600` is only
  3.00:1, so the solid drops to `green-700` (4.55:1) where a white label clears
  AA.
- In **dark** mode the accent is a *lifted* step, so a dark fill would disappear
  into the page — `purple-700` measures 2.57:1 against the dark background,
  under the 3:1 a control's boundary needs. Dark mode keeps the lifted fill and
  puts ink on it.

So a filled button is white-on-dark in light mode and ink-on-light in dark. That
is not an inconsistency; it is the only pairing readable in both.

**Amber is the documented exception** and it is a property of the ramp, not a
choice: the darkest gold step reaches just 3.41:1 against white, so no amber
fill can carry a white label. Amber's buttons keep ink in both modes.

⚠️ **`--hpe-base-color-white` does not exist.** The token is
`--hpe-base-color-white-100`. The misspelling is silent — CSS drops the
declaration and the element inherits, which is how "Log a meeting" ended up with
black text on a dark purple button, and how the assistant launcher's icon went
invisible on four of the six accents. If a colour ever looks inherited rather
than set, check the token name exists before anything else.

Status colours — ok / warning / critical — deliberately do **not** follow the
accent. They mean something, and recolouring them to match a preference would
make a red gauge stop reading as a problem.

### The rule: decorative follows the accent, semantic never does

If a colour is **decoration** — focus rings, hover glows, selection indicators,
icons, links, left rails on neutral cards — it uses `--saip-accent`.

If a colour **says something** — a score's status, a severity dot, an SLA tier,
an opportunity stage, a warning rail — it stays on its semantic token whatever
accent is chosen.

⚠️ **Do not reach for HPE's `primary` or `selected` tokens for decoration.**
`--hpe-color-foreground-primary`, `--hpe-color-border-selected`,
`icon-primary`, `text-primary` and `background-selected` are all **brand green
by definition and never move**. That is how the app ended up with purple tabs
and a green focus ring, a green hover glow on the Value Overview tiles, and a
green back-link, with Plum selected. Every one of those now uses
`--saip-accent`.

### Where settings live

`localStorage`, under `saip.settings.v1`, validated field by field on read so a
stale or hand-edited value falls back to its default rather than throwing. None of
it is business data. When the Dataverse layer lands, the natural home is a
`saip_userpreference` row keyed on the signed-in contact — `SettingsProvider`
keeps its shape and only `load`/`persist` change.

---

## Navigation

A retractable left rail: 268px expanded, 64px collapsed as an icon-only rail, with
the collapsed state persisted. Home / Executive View / Business Development sit at
the top; **Profile & settings** is pinned to the bottom, separated from the
destinations.

Primary navigation used to live in the top bar. It moved so Profile had a natural
home away from the destinations, and so the app can grow past three sections
without the header running out of room. The top bar now carries only the
notification bell.

**Profile is a hash route, not a second Power Pages page.** A separate page would
mean a second document load, a second parse of the bundle, and a visible flash of
the wrong theme before the settings applied — and it would put the settings
outside the React tree that consumes them. Note the site also has a Power Pages
*Profile* page at `/profile`; there is no collision, because this screen is at
`/#/profile`.

**There is no top bar.** It was a sticky strip carrying one control — the
notification bell — with every page then drawing its own heading row underneath.
Two bands of chrome, roughly 120px, before anything worth reading. The bell now
sits at the end of the heading row it used to float above, in
`components/shell/PageHeader.tsx`.

**Every page must use `<PageHeader>`.** It is the only route to notifications;
a page that rolls its own title row silently has none. It renders a real
`<header>` and takes four slots — `eyebrow` (back link), `title`, `aside`
(compact visuals that belong with the heading, such as the account gauges) and
`actions` (the page's primary button, with the bell appended).

**Below 640px the rail collapses itself**, regardless of the stored preference —
at 390px an expanded rail took 268 of them and left 122 for the page. It does
*not* overwrite the stored value: someone who expanded the rail on a desktop
should still find it expanded there, rather than having a phone silently rewrite
a choice made somewhere else.

### Three layout traps, all the same bug

Every horizontal-overflow bug in this app has been a flex or grid item refusing
to shrink below its **min-content** width. They look unrelated and are not:

1. **Grommet's `flex="grow"` compiles to `flex: 1 0 auto`** — grow yes, shrink
   **no**. The content column beside the rail needs `flex: 1 1 0` and
   `min-width: 0`, or the rail's width is added to a full-width column and the
   page scrolls sideways below ~1440px.
2. **A single-column `display: grid` sizes its column to max-content.** Every
   stacking grid in the app therefore declares
   `gridTemplateColumns: 'minmax(0, 1fr)'`. Without it the column cannot go
   narrower than its widest child, and one long heading widened the whole page.
3. **`text-overflow: ellipsis` never fires on a flex item without
   `min-width: 0`**, because the item's automatic minimum size is the full
   untruncated string. The SAIP.Ai suggestion chips grew to ~400px on a phone
   instead of truncating.

If the page scrolls horizontally, look for an ancestor that cannot shrink before
looking at the thing that appears too wide. `scripts/` has no test for this;
the check is `document.documentElement.scrollWidth > clientWidth` at 390px.

---

## Deploying to Power Pages

### The loop

```bash
npm run build:powerpages
pac pages upload --path ./powerpages --modelVersion 2
```

`build:powerpages` type-checks, builds, and copies the two emitted files into
`powerpages/web-files/`. It refuses to run — rather than producing a half-broken
site — if the build emits anything that has no web file record behind it, or if a
manifest is missing or points at the wrong filename.

The site is on the **enhanced data model** (`--modelVersion 2`). Confirm with
`pac pages list -v` if you ever work against a different environment.

### How the app is mounted

```
web-pages/home              Home        adx_pagetemplateid ─┐
page-templates/SAIP-App                                     ├─> SAIP App
                            adx_usewebsiteheaderandfooter: false
                            adx_webtemplateid ──────────────┐
web-templates/saip-app-host SAIP App Host                   └─> renders <html>
                              <link href="/saip-app.css">
                              <script type="module" src="/saip-app.js">
web-files/                  the two artifacts + their .webfile.yml records
```

Header and footer are switched **off** at the page template, which means the web
template renders the *entire* document — no Bootstrap, no `theme.css`, no
`portalbasictheme.css`. That is deliberate: Bootstrap's global resets bleed into
Grommet. The cost is that the Home page is no longer editable in the Power Pages
design studio, which reports *"Unable to render native controls"*. That message is
expected and harmless. Every other page still uses the studio template.

### Why the filenames are pinned

Each artifact is backed by an `adx_webfile` row whose `adx_partialurl` is fixed.
Content-hashed filenames would need a **new Dataverse record per build**, so
`vite.config.ts` pins the output names and disables hashing, code splitting and
sourcemaps. Don't re-enable code splitting without creating web file records for
every chunk first — `sync-powerpages.mjs` will stop you.

### If the upload is rejected for a blocked extension

`js` is on Dataverse's **default blocked-attachments list**. On an environment
where nobody has changed that, `pac pages upload` aborts with:

> Upload aborted. Your site data contains file(s) with extension(s) .js that are
> blocked in this environment, so no changes were uploaded.

**This environment has `js` unblocked**, which is why the bundle is `saip-app.js`.
If you ever deploy to an environment that has not, the fix is either to remove
`js` from the blocked list (Power Platform admin center → Environments → Settings
→ Privacy + Security), or to rename the artifact to an extension that is not
blocked — `.mjs` works, since the record's `mimetype` stays `text/javascript` and
browsers dispatch on the `Content-Type` header rather than the file extension.

Renaming means changing it in four places: `entryFileNames` in `vite.config.ts`,
`TRACKED` in `scripts/sync-powerpages.mjs`, `adx_name` / `adx_partialurl` /
`filename` in the manifest, and the `<script src>` in the web template. **Keep the
existing GUIDs** so the record is updated rather than duplicated.

### Never hand-write a `.webfile.yml`

The `.yml` files under `powerpages/` contain **real Dataverse GUIDs** identifying
live rows. Inventing one either creates a duplicate record or orphans the existing
one. New site assets must be scaffolded via the Power Pages Actions pane in VS Code
or `pac`, then populated. `sync-powerpages.mjs` fails loudly rather than generating
a manifest for you.

Editing the *content* of an existing tracked file is fine — that is what the sync
script does.

### Stale JS after an upload

Almost always CDN/output caching rather than your browser. In order:

1. Clear the cache from the Power Pages design studio.
2. Re-test in a private window. A hard refresh only proves your own browser is clean.
3. Because filenames are pinned there is no hash-based cache busting. If it becomes
   painful, add a version query string to the `<script src>` in the web template —
   the template is cheap to change, the web file records are not.

### Identity handoff

The web template writes `window.SAIP_CONTEXT` before the app bundle loads:

```js
window.SAIP_CONTEXT = { isAuthenticated, userId, displayName, email, roles }
```

**Nothing reads it yet** — `getCurrentUser()` still answers from
`mockAccountService`. Wiring that up is the first task of the data-layer work; see
[Going live against Dataverse](#going-live-against-dataverse).

`/js/portal-shell.js` is also loaded, which supplies `shell.getTokenDeferred()` for
the `__RequestVerificationToken` header that Web API writes require. Unused today,
included so the data layer doesn't need a template change to get started.

---

## Notes for the Power Pages developer

- **No authentication code exists**, by design. Every screen assumes a signed-in
  user; `getCurrentUser()` is the seam where the Entra ID identity plugs in.
- **`HashRouter`, not `BrowserRouter`** (`src/main.tsx`). The app is mounted on the
  Home page and Power Pages owns server-side routing, so history routing would need
  every deep path rewritten server-side and would break on hard refresh. Hash
  routing needs no server cooperation.
- **The opening animation plays once per document load, not per route change.**
  `AppIntro` mounts once above `<Routes>`. Since the whole app lives on one Power
  Pages page, users see it on arrival and not again while navigating.
- **The app does not pin itself to the viewport.** It flows with the document and
  the header uses `position: sticky`.
- **Fonts load from HPE's CDN** (`https://www.hpe.com`), referenced from the built
  CSS. If the site ever enables a Content-Security-Policy it needs `font-src` for
  that host — and `style-src 'unsafe-inline'`, because Grommet uses
  styled-components and injects CSS at runtime. Without it the app renders unstyled.
- The bundle is ~817 KB raw / ~230 KB gzipped, dominated by Grommet. The CSS is
  ~197 KB / ~19 KB gzipped — it carries both the light and dark HPE token sheets.
  Well inside the Dataverse attachment limit (web files are base64-encoded, so
  budget ~1.06 MB against it).

### Scope note

`MeetingHistory` (the *Recent Meetings* tab) is **not** one of the three ribbons
in the brief. It's the read side of Log a Meeting, added so saving a meeting has
a visible result — without it the demo flow ends with no feedback. It's a single
self-contained component and can be dropped by removing its entry from the
`RIBBONS` array in `pages/AccountFocusPage.tsx`.
