import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Opening animation: the SAIP wordmark fades in letter by letter, left to
 * right, each letter rising slightly into place. The whole overlay then fades
 * away.
 *
 * The "i" is deliberately lower-case and set in the HPE accent green, so the
 * mark carries the brand colour rather than needing a separate device.
 *
 * Plays on every page load, including refreshes. It does NOT replay on
 * client-side navigation — this component mounts once per document, so moving
 * between routes leaves it alone.
 *
 * Under reduced motion it never mounts: there is nothing here but motion, so
 * the correct fallback is to go straight to the app.
 */
const LETTERS = [
  { char: 'S', accent: false },
  { char: 'A', accent: false },
  { char: 'i', accent: true },
  { char: 'P', accent: false },
];

/** Per-letter delay for the left-to-right sweep, in seconds. */
const LETTER_STEP = 0.07;
/** How long a single letter takes to fade and rise into place. */
const LETTER_DURATION = 0.32;
/** How long the finished wordmark holds before the overlay leaves. */
const HOLD_S = 0.26;
/** How far each letter travels upward as it fades in, in px. */
const RISE_PX = 14;

/**
 * How long the intro occupies the screen before it starts leaving.
 * Kept deliberately short — this sits in front of the app on every fresh tab,
 * so it should register and get out of the way.
 */
export const INTRO_DURATION_S =
  (LETTERS.length - 1) * LETTER_STEP + LETTER_DURATION + HOLD_S;

/**
 * When this module was first evaluated — i.e. when the document loaded.
 *
 * There is no persisted "have we shown it?" flag any more: the intro plays on
 * every page load by design, so the only question other components need
 * answered is "how much of it is left?".
 */
const APP_LOADED_AT = Date.now();

/**
 * Milliseconds of intro still to run, from now.
 *
 * Components whose own entrance would otherwise play *underneath* the overlay
 * use this to schedule around it — that's why the "Log a meeting" button waits
 * before extending. Returns 0 once the intro is done, so a component mounting
 * later (navigating to another page, say) doesn't wait for an overlay that
 * isn't there.
 */
export function introRemainingMs(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, INTRO_DURATION_S * 1000 - (Date.now() - APP_LOADED_AT));
}

export function AppIntro() {
  const { reduced } = useAppMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(false), INTRO_DURATION_S * 1000);
    return () => window.clearTimeout(id);
  }, [visible, reduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="saip-intro"
          // Purely decorative — the app announces itself perfectly well without
          // this being read out, and announcing it would only delay content.
          aria-hidden
          initial={{ opacity: 1 }}
          // The whole overlay leaves together; the letters don't animate out
          // individually, which keeps the exit quick and clean.
          exit={{ opacity: 0, transition: { duration: 0.24, ease: 'easeIn' } }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--hpe-color-background-back)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              // Tight tracking so the four letters read as one mark.
              letterSpacing: '-0.03em',
              fontSize: 'clamp(3.5rem, 12vw, 8rem)',
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {LETTERS.map((letter, i) => (
              <RiseLetter
                key={i}
                char={letter.char}
                accent={letter.accent}
                delay={i * LETTER_STEP}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * One letter of the wordmark: fades in while rising a little into place.
 *
 * Eased out rather than sprung — a spring would overshoot and the four letters
 * would settle at visibly different moments, which reads as wobble on
 * something this large.
 */
function RiseLetter({
  char,
  accent,
  delay,
}: {
  char: string;
  accent: boolean;
  delay: number;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: RISE_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: LETTER_DURATION,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        display: 'inline-block',
        color: accent ? 'var(--saip-accent)' : 'var(--hpe-color-text-strong)',
        // Only the accent letter glows, so the eye lands on it.
        textShadow: accent ? '0 0 28px var(--saip-accent)' : 'none',
      }}
    >
      {char}
    </motion.span>
  );
}
