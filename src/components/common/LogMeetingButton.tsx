import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { duration, easing, glow, spring } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { introRemainingMs } from '@/components/shell/AppIntro';

/**
 * "Log a meeting" — the app's primary action.
 *
 * Entrance: the button arrives sized to its label alone, then widens as the
 * plus rolls out of the leading edge. The reveal is driven by a width
 * transition on the icon slot rather than by animating the button's own width,
 * so the label never reflows mid-animation.
 *
 * Under reduced motion it renders in its final state immediately — icon
 * present, full width, no roll.
 */
export function LogMeetingButton({
  label = 'Log a meeting',
  onClick,
  disabled,
  delay = 0.45,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Seconds to wait before the plus rolls out, measured from when visible. */
  delay?: number;
}) {
  const { reduced } = useAppMotion();
  const [extended, setExtended] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setExtended(true);
      return;
    }
    /*
      Wait out whatever is left of the opening animation before extending. The
      button mounts underneath the intro overlay, so without this the plus
      rolls out while the overlay is still covering the page and the animation
      is never actually seen. `introRemainingMs()` returns 0 once the intro has
      finished, so a button mounted on a later page doesn't wait for nothing.
    */
    const wait = introRemainingMs() + (250 + delay * 1000);
    const id = window.setTimeout(() => setExtended(true), wait);
    return () => window.clearTimeout(id);
  }, [reduced, delay]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled || reduced ? undefined : { y: -2, boxShadow: glow.primary }}
      whileTap={disabled || reduced ? undefined : { y: 0, scale: 0.98 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        font: 'inherit',
        fontSize: '1rem',
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        padding: '10px 20px',
        borderRadius: 'var(--hpe-radius-medium)',
        border: 'none',
        whiteSpace: 'nowrap',
        background: disabled
          ? 'var(--hpe-color-background-disabled)'
          : 'var(--saip-accent)',
        color: disabled ? 'var(--hpe-color-text-disabled)' : 'var(--saip-on-accent)',
      }}
    >
      {/*
        The icon's slot grows from zero width, so the button extends rather
        than the label jumping sideways.
      */}
      <motion.span
        initial={reduced ? false : { width: 0, opacity: 0, marginRight: 0 }}
        animate={
          extended
            ? { width: 20, opacity: 1, marginRight: 8 }
            : { width: 0, opacity: 0, marginRight: 0 }
        }
        transition={reduced ? { duration: 0 } : spring.snappy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
        aria-hidden
      >
        {/* The plus rolls as it emerges. */}
        <motion.svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          initial={reduced ? false : { rotate: -180, scale: 0.3 }}
          animate={extended ? { rotate: 0, scale: 1 } : { rotate: -180, scale: 0.3 }}
          transition={reduced ? { duration: 0 } : { ...spring.bouncy, delay: 0.05 }}
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </motion.svg>
      </motion.span>

      {label}
    </motion.button>
  );
}
