import { useReducedMotion } from 'framer-motion';

/**
 * Single source of truth for "should this app animate?".
 *
 * Framer's `useReducedMotion()` tracks the `prefers-reduced-motion: reduce`
 * media query live. Components call this hook and pass the result into the
 * variant factories in `variants.ts`, which return zero-duration, zero-travel
 * variants when motion is suppressed.
 *
 * Important: reduced motion means elements appear *instantly in their final
 * state*, never that they fail to appear. Every variant factory keeps the same
 * `hidden`/`visible` keys so `animate="visible"` still resolves correctly.
 */
export function useAppMotion(): { reduced: boolean } {
  const reduced = useReducedMotion();
  return { reduced: Boolean(reduced) };
}
