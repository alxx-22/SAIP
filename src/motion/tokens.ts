/**
 * SAIP motion scale.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER TOKENS — NOT SOURCED FROM HPE
 * ─────────────────────────────────────────────────────────────────────────────
 * The brief asked for durations/easing to come from HPE's motion tokens.
 * They do not exist yet: `hpe-design-tokens@2.2.3` publishes color, dimension,
 * global, primitives and components only — a search of every file in the
 * package for `motion|duration|easing|transition|cubic-bezier` returns nothing.
 *
 * So the values below are the explicitly-labelled fallback scale from the build
 * brief, kept in ONE place so that reconciling them later is a single-file edit
 * rather than a hunt through components. No component may hardcode a duration.
 *
 * When HPE ships motion tokens: replace the numbers here with the token
 * references and delete this banner. Nothing else should need to change.
 */

/** Durations in seconds (Framer Motion's unit), grouped by intent. */
export const duration = {
  /** Hover / fast affordance feedback. Brief: 120–150ms. */
  fast: 0.14,
  /** Standard UI state transitions. Brief: 200–250ms. */
  standard: 0.22,
  /** Entrance and exit of major elements. Brief: 250–400ms. */
  entrance: 0.34,
  exit: 0.26,
  /** Long-running ambient loops (breathing, shimmer). Not from the brief. */
  ambient: 2.6,
} as const;

/**
 * Easing curves as cubic-bezier control points.
 * Brief: ease-out for entrances, ease-in for exits, ease-in-out for state changes.
 */
export const easing = {
  /** Entrances — decelerate into place. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Exits — accelerate away. */
  in: [0.7, 0, 0.84, 0] as const,
  /** State changes — symmetric. */
  inOut: [0.65, 0, 0.35, 1] as const,
} as const;

/**
 * Spring presets. Springs are used where an element should feel physical —
 * something popping into place, a control responding to a press — while the
 * duration/easing pairs above drive everything that should feel composed.
 */
export const spring = {
  /** Crisp, minimal overshoot. Popovers, chips. */
  snappy: { type: 'spring', stiffness: 420, damping: 26 } as const,
  /** Noticeable bounce. Confirmations, the Copilot launcher. */
  bouncy: { type: 'spring', stiffness: 380, damping: 17 } as const,
  /** Heavier, settled. Panels and modals. */
  soft: { type: 'spring', stiffness: 260, damping: 28 } as const,
} as const;

/** Per-item delay for staggered list/grid reveals. */
export const stagger = {
  list: 0.055,
  card: 0.075,
  /** Tight stagger for dense groups — form fields, chips, nav items. */
  tight: 0.035,
  /** Delay before a stagger group begins, letting the container settle first. */
  groupDelay: 0.08,
} as const;

/**
 * Distance (px) elements travel on entrance. Kept small on purpose — long
 * travel reads as sluggish in a data-dense portal.
 */
export const travel = {
  small: 8,
  medium: 14,
  large: 24,
} as const;

/**
 * Glow treatments.
 *
 * PLACEHOLDER — HPE publishes shadow tokens (`--hpe-shadow-*`) but nothing for
 * coloured glow, so these are composed from the semantic *colour* tokens rather
 * than invented hex. Each entry is a `box-shadow` string built from a token, so
 * a glow can never drift away from the palette it belongs to.
 *
 * Glow is used to mark state (attention, selection, focus), never as ambient
 * decoration on a resting element.
 */
export const glow = {
  ok: '0 0 0 1px var(--hpe-color-border-ok), 0 0 18px -4px var(--hpe-color-foreground-ok)',
  warning:
    '0 0 0 1px var(--hpe-color-border-warning), 0 0 18px -4px var(--hpe-color-foreground-warning)',
  critical:
    '0 0 0 1px var(--hpe-color-border-critical), 0 0 20px -4px var(--hpe-color-foreground-critical)',
  /**
   * Brand accent glow. Uses `--saip-accent` (the light HPE Brand green,
   * #01a982) rather than `foreground-primary`, which is the much darker
   * #006750 — see the accent note in styles/global.css.
   */
  primary: '0 0 0 1px var(--saip-accent), 0 0 20px -4px var(--saip-accent)',
  /** Soft neutral lift used on card hover, so hover reads as depth not colour. */
  neutral: '0 0 24px -6px var(--hpe-color-border-strong)',
} as const;

/** Drop-shadow filters for SVG strokes, where box-shadow does not apply. */
export const svgGlow = {
  ok: 'drop-shadow(0 0 6px var(--hpe-color-foreground-ok))',
  warning: 'drop-shadow(0 0 6px var(--hpe-color-foreground-warning))',
  critical: 'drop-shadow(0 0 8px var(--hpe-color-foreground-critical))',
} as const;

/**
 * Scroll-reveal configuration. `amount` is how much of the element must be in
 * view before it animates; `margin` pulls the trigger point up so content is
 * already settled by the time it is read.
 */
export const scrollReveal = {
  once: true,
  amount: 0.15,
  margin: '0px 0px -80px 0px',
} as const;

/** CSS-consumable equivalents, for the few places that use CSS not Framer. */
export const cssDuration = {
  fast: `${duration.fast * 1000}ms`,
  standard: `${duration.standard * 1000}ms`,
} as const;

export const cssEasing = {
  out: `cubic-bezier(${easing.out.join(', ')})`,
  inOut: `cubic-bezier(${easing.inOut.join(', ')})`,
} as const;
