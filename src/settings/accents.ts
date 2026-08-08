/**
 * SAIP accent catalogue.
 *
 * The app used to hard-code the HPE Brand green as its single accent. It is now
 * user-selectable, so the accent is defined here once and applied as CSS custom
 * properties by `SettingsProvider` — no component picks an accent colour itself.
 *
 * WHY EACH ACCENT HAS TWO VALUES
 *
 * A colour that reads well on a light background is usually too dark on a dark
 * one, which is why HPE's own decorative tokens differ between modes (cyan is
 * base-200 in light and base-400 in dark). Each accent below therefore carries a
 * `light` and a `dark` step from the same ramp: a saturated mid step for light
 * mode, a lifted step for dark.
 *
 * CONTRAST
 *
 * `on` is the text colour that sits ON the accent — button labels, chips, the
 * assistant's own message bubbles. Every pair below was measured against
 * WCAG 1.4.3 (4.5:1 for body text) and the ratio is recorded on each entry. Do
 * not add an accent without checking both modes; several obvious candidates fail
 * — plain `blue-500` is 4.49:1 on white and 3.05:1 on ink, so it passes neither.
 *
 * SOLID vs ACCENT — WHY THERE ARE TWO FILLS
 *
 * `accent` is the decorative fill: gauge arcs, the assistant's bubbles, the
 * launcher disc. `solid` is the fill used by FILLED BUTTONS carrying a label,
 * and the two differ because a button label is body text and has to clear
 * 4.5:1, while a decorative fill only has to clear 3:1 as a UI component.
 *
 * The obvious shortcut — "make every button white-on-accent" — does not work,
 * and the numbers are why:
 *
 *   - In LIGHT mode the accent is a mid ramp step. White on `green-600` is
 *     3.00:1 and on `gold-400` 2.50:1, so `solid` drops to a darker step where
 *     white clears the bar (`green-700` = 4.55:1).
 *   - In DARK mode the accent is a LIFTED step, so a dark fill would disappear
 *     into the page: `purple-700` on the dark background measures 2.57:1,
 *     below the 3:1 that WCAG 1.4.11 wants for a control's boundary. Dark mode
 *     therefore keeps the lifted fill and puts INK on it.
 *
 * So a filled button is white-on-dark in light mode and ink-on-light in dark
 * mode. That is not an inconsistency — it is the only pairing that stays
 * readable in both, which is why `onSolid` is stored per mode rather than
 * assumed.
 *
 * AMBER IS THE EXCEPTION, and it is a property of the ramp rather than a
 * choice: the darkest gold step reaches only 3.41:1 against white. There is no
 * amber fill that can carry a white label, so amber's solid keeps ink in both
 * modes.
 *
 * Values are HPE base ramp tokens rather than raw hex, so they stay inside the
 * design system and track any upstream change to the ramp.
 */

export type AccentId = 'brand' | 'blue' | 'purple' | 'plum' | 'coral' | 'amber';

/** One mode's worth of a single accent. */
export interface AccentPalette {
  /** Decorative fill — arcs, discs, bubbles, borders. */
  accent: string;
  /** Text/icon colour that sits on `accent`. */
  on: string;
  /** Fill for filled buttons carrying a label. */
  solid: string;
  /** Text colour that sits on `solid`. */
  onSolid: string;
}

export interface AccentDefinition {
  id: AccentId;
  /** Shown in the theme picker. */
  label: string;
  /** One-line description, used as the option's supporting text. */
  description: string;
  light: AccentPalette;
  dark: AccentPalette;
}

/** Text colour tokens used as `on` values. */
const INK = 'var(--hpe-base-color-grey-1000)';
const PAPER = 'var(--hpe-base-color-white-100)';

export const ACCENTS: AccentDefinition[] = [
  {
    id: 'brand',
    label: 'HPE Green',
    description: 'The HPE brand green. The SAIP default.',
    light: {
      // green-600 #01a982 on ink = 4.57:1
      accent: 'var(--hpe-base-color-green-600)',
      on: INK,
      /*
        The one accent whose solid step differs from its decorative one.
        White on green-600 is 3.00:1 — the brand green is simply too light to
        carry a white label — so buttons drop to green-700 at 4.55:1, which
        still reads as HPE green and holds 4.25:1 against the page.
      */
      solid: 'var(--hpe-base-color-green-700)',
      onSolid: PAPER,
    },
    dark: {
      // green-500 #00e0af on ink = 8.02:1
      accent: 'var(--hpe-base-color-green-500)',
      on: INK,
      solid: 'var(--hpe-base-color-green-500)',
      onSolid: INK,
    },
  },
  {
    id: 'blue',
    label: 'Blue',
    description: 'Cool and neutral. Reads as calm rather than urgent.',
    light: {
      // blue-700 #0055da on white = 6.34:1
      accent: 'var(--hpe-base-color-blue-700)',
      on: PAPER,
      solid: 'var(--hpe-base-color-blue-700)',
      onSolid: PAPER,
    },
    dark: {
      // blue-200 #65aef9 on ink = 5.90:1
      accent: 'var(--hpe-base-color-blue-200)',
      on: INK,
      solid: 'var(--hpe-base-color-blue-200)',
      onSolid: INK,
    },
  },
  {
    id: 'purple',
    label: 'Purple',
    description: 'High contrast against the greenscale status colours.',
    light: {
      // purple-700 #5d45d6 on white = 6.39:1
      accent: 'var(--hpe-base-color-purple-700)',
      on: PAPER,
      solid: 'var(--hpe-base-color-purple-700)',
      onSolid: PAPER,
    },
    dark: {
      // purple-100 #b7a2fc on ink = 6.32:1
      accent: 'var(--hpe-base-color-purple-100)',
      on: INK,
      solid: 'var(--hpe-base-color-purple-100)',
      onSolid: INK,
    },
  },
  {
    id: 'plum',
    label: 'Plum',
    description: 'Deep magenta. Distinct from every status colour.',
    light: {
      // plum-600 #873492 on white = 7.15:1
      accent: 'var(--hpe-base-color-plum-600)',
      on: PAPER,
      solid: 'var(--hpe-base-color-plum-600)',
      onSolid: PAPER,
    },
    dark: {
      // fuschia-100 #fc9ddc on ink = 7.24:1
      accent: 'var(--hpe-base-color-fuschia-100)',
      on: INK,
      solid: 'var(--hpe-base-color-fuschia-100)',
      onSolid: INK,
    },
  },
  {
    id: 'coral',
    label: 'Coral',
    description: 'Warm. Sits close to the critical red — use with that in mind.',
    light: {
      // coral-500 #b4422a on white = 5.59:1
      accent: 'var(--hpe-base-color-coral-500)',
      on: PAPER,
      solid: 'var(--hpe-base-color-coral-500)',
      onSolid: PAPER,
    },
    dark: {
      // coral-100 #fc988b on ink = 6.53:1
      accent: 'var(--hpe-base-color-coral-100)',
      on: INK,
      solid: 'var(--hpe-base-color-coral-100)',
      onSolid: INK,
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    description: 'Warm gold. Sits close to the warning colour — use with that in mind.',
    light: {
      // gold-400 #c89e3a on ink = 5.49:1
      accent: 'var(--hpe-base-color-gold-400)',
      on: INK,
      /*
        No white label is possible on this ramp — gold-550, the darkest step,
        still only reaches 3.41:1 against white. Ink at 5.49:1 is the readable
        pairing, so amber's buttons keep dark text in both modes.
      */
      solid: 'var(--hpe-base-color-gold-400)',
      onSolid: INK,
    },
    dark: {
      // gold-200 #ecbe4f on ink = 7.92:1
      accent: 'var(--hpe-base-color-gold-200)',
      on: INK,
      solid: 'var(--hpe-base-color-gold-200)',
      onSolid: INK,
    },
  },
];

export const DEFAULT_ACCENT: AccentId = 'brand';

export function getAccent(id: AccentId): AccentDefinition {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}
