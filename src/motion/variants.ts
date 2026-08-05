import type { Transition, Variants } from 'framer-motion';
import { duration, easing, stagger, travel } from './tokens';

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
export function fadeRise(reduced: boolean, distance = travel.medium): Variants {
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
      transition: reduced
        ? instant
        : { type: 'spring', stiffness: 420, damping: 18 },
    },
    exit: { opacity: 0, transition: reduced ? instant : { duration: duration.exit } },
  };
}
