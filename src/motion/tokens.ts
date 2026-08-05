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

/** Per-item delay for staggered list/grid reveals. */
export const stagger = {
  list: 0.055,
  card: 0.075,
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
