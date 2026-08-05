import type { Transition, Variants } from 'framer-motion';
import { duration, easing, glow, spring, stagger, travel } from './tokens';

/**
 * Shared Framer Motion variants.
 *
 * Every factory takes `reduced` (from `useAppMotion()`) and returns variants
 * that resolve to the same final visual state with no movement and no duration
 * when the user prefers reduced motion. Components never branch on `reduced`
 * themselves — they just pass it through, so the fallback can't be forgotten.
 */

const instant: Transition = { duration: 0 };

/** Fade + rise. The default entrance for cards, panels and sections. */
export function fadeRise(reduced: boolean, distance: number = travel.medium): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? instant
        : { duration: duration.entrance, ease: easing.out },
    },
    exit: {
      opacity: 0,
      y: reduced ? 0 : distance / 2,
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/**
 * Container that staggers its children in.
 * Pair with `staggerItem` on each child.
 */
export function staggerContainer(
  reduced: boolean,
  step: number = stagger.list,
): Variants {
  return {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: reduced
        ? instant
        : {
            staggerChildren: step,
            delayChildren: stagger.groupDelay,
          },
    },
    exit: {
      opacity: 1,
      transition: reduced
        ? instant
        : { staggerChildren: step / 2, staggerDirection: -1 },
    },
  };
}

/** Child of a `staggerContainer`. Slides in from the leading edge. */
export function staggerItem(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : travel.small, x: reduced ? 0 : -travel.small },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: reduced
        ? instant
        : { duration: duration.entrance, ease: easing.out },
    },
    exit: {
      opacity: 0,
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/** Modal panel: scales and fades in over a dimmed backdrop. */
export function modalPanel(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : travel.medium },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: reduced
        ? instant
        : { duration: duration.entrance, ease: easing.out },
    },
    exit: {
      opacity: 0,
      scale: reduced ? 1 : 0.97,
      y: reduced ? 0 : travel.small,
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/** Dimmed + blurred backdrop behind a modal. */
export function modalBackdrop(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
    visible: {
      opacity: 1,
      backdropFilter: reduced ? 'blur(0px)' : 'blur(3px)',
      transition: reduced ? instant : { duration: duration.standard, ease: easing.out },
    },
    exit: {
      opacity: 0,
      backdropFilter: 'blur(0px)',
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/**
 * Hover response for cards and rows.
 * Returns props to spread onto a `motion.*` element rather than variants,
 * because hover/tap live outside the variant lifecycle.
 */
export function hoverLift(reduced: boolean, lift = 3) {
  if (reduced) return {};
  return {
    whileHover: {
      y: -lift,
      transition: { duration: duration.fast, ease: easing.out },
    },
    whileTap: { y: -lift / 2, transition: { duration: duration.fast } },
  };
}

/** Hover response for elements that shouldn't move — scale only. */
export function hoverScale(reduced: boolean, scale = 1.04) {
  if (reduced) return {};
  return {
    whileHover: { scale, transition: { duration: duration.fast, ease: easing.out } },
    whileTap: { scale: 0.98, transition: { duration: duration.fast } },
  };
}

/**
 * Ambient "needs attention" breathing.
 * Deliberately slow and low-amplitude — a flag, not a distraction.
 * Returns nothing under reduced motion; callers keep the static colour flag.
 */
export function attentionBreathe(reduced: boolean) {
  if (reduced) return {};
  return {
    animate: { opacity: [1, 0.68, 1] },
    transition: {
      duration: duration.ambient,
      ease: easing.inOut,
      repeat: Infinity,
    },
  };
}

/** Modal save-confirmation checkmark. */
export function confirmPop(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: reduced ? instant : spring.bouncy,
    },
    exit: { opacity: 0, transition: reduced ? instant : { duration: duration.exit } },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Expanded motion set
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Section entrance driven by scroll position rather than mount.
 *
 * Spread onto a `motion` element: `{...scrollReveal(reduced)}`. Content below
 * the fold animates as it is reached instead of having already played by the
 * time the user scrolls to it.
 */
export function scrollRevealProps(reduced: boolean, distance: number = travel.large) {
  if (reduced) {
    return { initial: false as const, animate: { opacity: 1, y: 0 } };
  }
  return {
    initial: { opacity: 0, y: distance },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15, margin: '0px 0px -80px 0px' },
    transition: { duration: duration.entrance, ease: easing.out },
  };
}

/**
 * Route-level transition. Pages leave upward and arrive from below, so
 * navigation has a consistent direction of travel.
 */
export function pageTransition(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : travel.medium },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? instant
        : { duration: duration.entrance, ease: easing.out, staggerChildren: stagger.card },
    },
    exit: {
      opacity: 0,
      y: reduced ? 0 : -travel.small,
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/**
 * Popover anchored to a trigger — scales up from the edge it is attached to.
 * `origin` should match the CSS `transform-origin` set on the element.
 */
export function popover(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.94, y: reduced ? 0 : -6 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: reduced ? instant : spring.snappy,
    },
    exit: {
      opacity: 0,
      scale: reduced ? 1 : 0.97,
      y: reduced ? 0 : -4,
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/**
 * Tab panel that enters from the direction of travel.
 * `direction` is +1 when moving to a later tab, -1 when moving back.
 */
export function directionalPanel(reduced: boolean, direction: number): Variants {
  const offset = reduced ? 0 : 28 * (direction >= 0 ? 1 : -1);
  return {
    hidden: { opacity: 0, x: offset },
    visible: {
      opacity: 1,
      x: 0,
      transition: reduced
        ? instant
        : { duration: duration.entrance, ease: easing.out, staggerChildren: stagger.tight },
    },
    exit: {
      opacity: 0,
      x: -offset,
      transition: reduced ? instant : { duration: duration.exit, ease: easing.in },
    },
  };
}

/**
 * Hover treatment that lifts AND glows.
 * The glow colour comes from the token-built strings in `tokens.ts`, so a
 * hover state can never introduce an off-palette colour.
 */
export function hoverGlow(
  reduced: boolean,
  tone: keyof typeof glow = 'neutral',
  lift = 4,
) {
  if (reduced) return {};
  return {
    whileHover: {
      y: -lift,
      boxShadow: glow[tone],
      transition: { duration: duration.fast, ease: easing.out },
    },
    whileTap: { y: -lift / 2, transition: { duration: duration.fast } },
  };
}

/**
 * Ambient glow pulse for elements that need standing attention — an overdue
 * contract badge, a score in trouble, the Copilot launcher at rest.
 *
 * Returns `{}` under reduced motion; callers keep the static colour treatment,
 * which carries the same meaning without movement.
 */
export function glowPulse(reduced: boolean, tone: keyof typeof glow = 'warning') {
  if (reduced) return {};
  return {
    animate: { boxShadow: ['0 0 0 0 transparent', glow[tone], '0 0 0 0 transparent'] },
    transition: {
      duration: duration.ambient,
      ease: easing.inOut,
      repeat: Infinity,
    },
  };
}

/**
 * One-shot light sweep across a surface on entrance.
 * Used sparingly — the metric tiles and score cards — to make figures feel
 * freshly delivered rather than already sitting there.
 */
export function sweep(reduced: boolean, delay = 0) {
  if (reduced) return null;
  return {
    initial: { x: '-120%' },
    animate: { x: '120%' },
    transition: {
      duration: duration.entrance * 2.4,
      ease: easing.inOut,
      delay: delay + 0.2,
    },
  };
}

/** Press/hover treatment for chips and small toggles. */
export function chipInteraction(reduced: boolean, active: boolean) {
  if (reduced) return {};
  return {
    whileHover: { y: -2, transition: { duration: duration.fast, ease: easing.out } },
    whileTap: { scale: 0.94, transition: { duration: duration.fast } },
    animate: active ? { scale: [1, 1.06, 1] } : { scale: 1 },
    transition: active ? spring.bouncy : { duration: duration.fast },
  };
}
