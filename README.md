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
| Opening | The SAIP wordmark flickers on and off across the middle of the screen; see "Opening animation" below. |
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

`AppIntro` flickers the SAIP wordmark on across the middle of the screen, holds,
then flickers it off — both sweeps travelling left to right. The **"i" is
lower-case and set in the accent green**, so the mark carries the brand colour
without needing a separate device.

The flicker is an opacity keyframe sequence with uneven steps and a couple of
stutters — like a tube light striking — rather than a fade. The `times` array on
each letter is what keeps the stutters sharp; without it Framer smooths the
whole thing into a slow pulse.

It plays **once per browser tab** (`sessionStorage`), not on every route change,
which would be exhausting for someone in this all day. Under reduced motion it
never mounts — there is nothing to it but motion.

Components whose own entrance would otherwise play *underneath* the overlay
schedule around it via `introWillPlay()` / `INTRO_DURATION_S` — that's why the
"Log a meeting" button waits before extending. Without it the plus rolled out
behind the intro and was never actually seen.

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
