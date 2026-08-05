# SAIP — Services Account Intelligence Portal

Front-end prototype for the HPE Services Account Intelligence Portal, built to be
lifted into **Microsoft Power Pages** as Web Templates / Page Templates or compiled
into a Code Component (PCF).

> **This prototype runs entirely on invented sample data.**
> No account name, score, contract, city, date or spend figure in this repository
> is real. See [Placeholder data checklist](#placeholder-data-checklist) for the
> punch list to clear before release.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle into dist/
npm run typecheck  # types only
```

Requires Node 18+.

---

## What's built

| Area | Status |
| --- | --- |
| Homepage — Account Selection Pane | Built |
| Homepage — Overview (three score gauges) | Built |
| Account Focus — Ribbon A, Value Overview | Built |
| Account Focus — Ribbon B, Active Service Contracts | Built |
| Account Focus — Ribbon C, Account Monitoring (editable) | Built |
| Log a Meeting modal (both entry points) | Built |
| Copilot Studio widget | Container + launcher only, per brief |
| Executive View / Business Development | Nav placeholders only, per brief |
| Entra ID authentication | Deliberately absent — Power Pages handles it |
| Dataverse / Fabric integration | Mock service layer only, built to be swapped |

### Demo flow

Homepage → pick an account → Account Focus (four tabs) → **Log a meeting** →
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
  motion/            motion tokens, Framer variants, reduced-motion hook
  hooks/             useAsync (race-safe loader), useCountUp
  components/
    common/            SampleDataBadge, Skeleton, AnimatedModal
    shell/             AppShell (nav, sample-data banner), CopilotWidget
    accounts/          AccountSelectionPane
    scores/            ScoreCard, ScoresOverview
    focus/             the three Account Focus ribbons
    meetings/          MeetingLogModal, MeetingLogProvider, MeetingHistory
  pages/             HomePage, AccountFocusPage, PlaceholderPage
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
badge and the prototype banner across the app at once.

Reads map to Dataverse table queries; the two write paths are
`saveAccountMonitoring` and `logMeeting`.

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
| 7 | Ribbon B — Active Service Contracts | Contract IDs, SLA tier names, values, cities, renewal dates | `MOCK_CONTRACTS`, `MOCK_DEFAULT_CONTRACTS` |
| 8 | Ribbon C — Account Monitoring | Seeded relationship-health dates + audit trail | `MOCK_MONITORING` |
| 9 | Ribbon C — two field **names** | `lastExecutiveEngagement`, `lastServiceReviewWithSponsor` — names **not confirmed**, rendered with a visible "Field name TBC" chip | `services/types.ts`, `components/focus/AccountMonitoringRibbon.tsx` |
| 10 | Recent Meetings | 3 seeded meeting logs | `MOCK_MEETINGS` |
| 11 | Meeting log writes | Saved in memory only; lost on reload | `services/mock/mockAccountService.ts` |
| 12 | Copilot widget | Empty container — no bot embedded | `components/shell/CopilotWidget.tsx` |
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
| Entrance | Staggered reveals — account rows, score cards, metric tiles, contract rows, form sections. Gauges fill from zero; figures count up. |
| Exit | Modal, Copilot panel and tab panels animate out. Nothing disappears abruptly. |
| Idle | Skeleton shimmer while loading; slow opacity pulse on "needs attention" scores and contracts renewing within 90 days. Nothing else moves once settled. |
| Hover | Every interactive element responds — row slide, card lift, tab lift, chip lift, launcher bounce — all on the same `fast` timing. |

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

## Notes for the Power Pages developer

- **No authentication code exists**, by design. Every screen assumes a signed-in
  user; `getCurrentUser()` is the seam where the Entra ID identity plugs in.
- **`HashRouter`, not `BrowserRouter`** (`src/main.tsx`). SAIP will be mounted at
  a path the front-end doesn't control, inside a site whose server rewrite rules
  aren't ours to configure. History routing would need every deep path rewritten
  server-side and would break on hard refresh. Swap it if the host page provides
  its own routing — `App.tsx`'s `<Routes>` is the only thing to re-point.
- **The app does not pin itself to the viewport.** It flows with the document and
  the header uses `position: sticky`, so it won't fight a Power Pages template's
  own header, footer and scroll.
- **Fonts load from HPE's CDN.** In Power Pages, move the `@font-face` block from
  `src/styles/fonts.css` into the site's base template `<head>` so it loads once
  per site instead of once per component.
- `vite.config.ts` uses a relative `base`, so `dist/` can be served from any
  sub-path.
- The bundle is ~735 KB raw / ~209 KB gzipped, dominated by Grommet. If that
  matters for the PCF route, code-split the Account Focus ribbons — they're
  already isolated components.

### Scope note

`MeetingHistory` (the *Recent Meetings* tab) is **not** one of the three ribbons
in the brief. It's the read side of Log a Meeting, added so saving a meeting has
a visible result — without it the demo flow ends with no feedback. It's a single
self-contained component and can be dropped by removing its entry from the
`RIBBONS` array in `pages/AccountFocusPage.tsx`.
