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
 * Values are HPE base ramp tokens rather than raw hex, so they stay inside the
 * design system and track any upstream change to the ramp.
 */

export type AccentId = 'brand' | 'blue' | 'purple' | 'plum' | 'coral' | 'amber';

export interface AccentDefinition {
  id: AccentId;
  /** Shown in the theme picker. */
  label: string;
  /** One-line description, used as the option's supporting text. */
  description: string;
  light: { accent: string; on: string };
  dark: { accent: string; on: string };
}

/** Text colour tokens used as `on` values. */
const INK = 'var(--hpe-base-color-grey-1000)';
const PAPER = 'var(--hpe-base-color-white)';

export const ACCENTS: AccentDefinition[] = [
  {
    id: 'brand',
    label: 'HPE Green',
    description: 'The HPE brand green. The SAIP default.',
    // green-600 #01a982 on ink = 4.57:1
    light: { accent: 'var(--hpe-base-color-green-600)', on: INK },
    // green-500 #00e0af on ink = 8.02:1
    dark: { accent: 'var(--hpe-base-color-green-500)', on: INK },
  },
  {
    id: 'blue',
    label: 'Blue',
    description: 'Cool and neutral. Reads as calm rather than urgent.',
    // blue-700 #0055da on white = 6.31:1
    light: { accent: 'var(--hpe-base-color-blue-700)', on: PAPER },
    // blue-200 #65aef9 on ink = 5.90:1
    dark: { accent: 'var(--hpe-base-color-blue-200)', on: INK },
  },
  {
    id: 'purple',
    label: 'Purple',
    description: 'High contrast against the greenscale status colours.',
    // purple-700 #5d45d6 on white = 6.39:1
    light: { accent: 'var(--hpe-base-color-purple-700)', on: PAPER },
    // purple-100 #b7a2fc on ink = 6.32:1
    dark: { accent: 'var(--hpe-base-color-purple-100)', on: INK },
  },
  {
    id: 'plum',
    label: 'Plum',
    description: 'Deep magenta. Distinct from every status colour.',
    // plum-600 #873492 on white = 7.15:1
    light: { accent: 'var(--hpe-base-color-plum-600)', on: PAPER },
    // fuschia-100 #fc9ddc on ink = 7.24:1
    dark: { accent: 'var(--hpe-base-color-fuschia-100)', on: INK },
  },
  {
    id: 'coral',
    label: 'Coral',
    description: 'Warm. Sits close to the critical red — use with that in mind.',
    // coral-500 #b4422a on white = 5.59:1
    light: { accent: 'var(--hpe-base-color-coral-500)', on: PAPER },
    // coral-100 #fc988b on ink = 6.53:1
    dark: { accent: 'var(--hpe-base-color-coral-100)', on: INK },
  },
  {
    id: 'amber',
    label: 'Amber',
    description: 'Warm gold. Sits close to the warning colour — use with that in mind.',
    // gold-400 #c89e3a on ink = 5.53:1
    light: { accent: 'var(--hpe-base-color-gold-400)', on: INK },
    // gold-200 #ecbe4f on ink = 7.92:1
    dark: { accent: 'var(--hpe-base-color-gold-200)', on: INK },
  },
];

export const DEFAULT_ACCENT: AccentId = 'brand';

export function getAccent(id: AccentId): AccentDefinition {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}
