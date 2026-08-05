import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Opening animation: the SAIP wordmark flickers on across the middle of the
 * screen, holds, then flickers off — both sweeping left to right.
 *
 * The "i" is deliberately lower-case and set in the HPE accent green, so the
 * mark carries the brand colour rather than needing a separate device.
 *
 * Plays once per browser tab (`sessionStorage`), not per route change — a rep
 * navigating around all day should see this once, not on every trip Home.
 * Under reduced motion it never mounts: there is nothing here but motion, so
 * the correct fallback is to go straight to the app.
 */
const SEEN_KEY = 'saip.intro.seen';

const LETTERS = [
  { char: 'S', accent: false },
  { char: 'A', accent: false },
  { char: 'i', accent: true },
  { char: 'P', accent: false },
];

/** Per-letter stagger for the flicker sweep, in seconds. */
const FLICKER_STEP = 0.13;
/** How long the wordmark holds fully lit before flickering out. */
const HOLD_S = 0.5;

/**
 * Total time the intro occupies the screen.
 * in-sweep + hold + out-sweep, plus a little slack for the final fade.
 */
export const INTRO_DURATION_S =
  LETTERS.length * FLICKER_STEP + 0.45 + HOLD_S + LETTERS.length * FLICKER_STEP + 0.35;

/**
 * Whether the intro will play on this mount.
 *
 * Other components use this to schedule their own entrance for *after* the
 * overlay lifts — otherwise their animation plays behind it and is never seen.
 */
export function introWillPlay(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SEEN_KEY) !== 'true';
}

export function AppIntro() {
  const { reduced } = useAppMotion();
  const [visible, setVisible] = useState(() => introWillPlay());
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      sessionStorage.setItem(SEEN_KEY, 'true');
      setVisible(false);
      return;
    }

    // Flicker in, hold, then flicker out.
    const outAt = (LETTERS.length * FLICKER_STEP + 0.45 + HOLD_S) * 1000;
    const doneAt = INTRO_DURATION_S * 1000;

    const toOut = window.setTimeout(() => setPhase('out'), outAt);
    const toDone = window.setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, 'true');
      setVisible(false);
    }, doneAt);

    return () => {
      window.clearTimeout(toOut);
      window.clearTimeout(toDone);
    };
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
          exit={{ opacity: 0, transition: { duration: 0.28, ease: 'easeIn' } }}
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
              <FlickerLetter
                key={i}
                char={letter.char}
                accent={letter.accent}
                // Left-to-right on the way in AND on the way out, so the sweep
                // always travels the same direction.
                delay={i * FLICKER_STEP}
                phase={phase}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * One letter of the wordmark.
 *
 * The flicker is an opacity keyframe sequence rather than a smooth fade —
 * uneven steps with a couple of stutters, like a tube light striking. Framer
 * interpolates between keyframes, so the `times` array is what keeps the
 * stutters sharp instead of turning the whole thing into a slow pulse.
 */
function FlickerLetter({
  char,
  accent,
  delay,
  phase,
}: {
  char: string;
  accent: boolean;
  delay: number;
  phase: 'in' | 'out';
}) {
  const flickerIn = {
    opacity: [0, 0.9, 0.15, 1, 0.35, 1],
    times: [0, 0.15, 0.3, 0.5, 0.65, 1],
  };
  const flickerOut = {
    opacity: [1, 0.25, 0.85, 0.1, 0.4, 0],
    times: [0, 0.2, 0.35, 0.6, 0.75, 1],
  };
  const active = phase === 'in' ? flickerIn : flickerOut;

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: active.opacity }}
      transition={{
        duration: phase === 'in' ? 0.45 : 0.4,
        times: active.times,
        delay,
        ease: 'linear',
      }}
      style={{
        color: accent ? 'var(--saip-accent)' : 'var(--hpe-color-text-strong)',
        // Only the accent letter glows, so the eye lands on it.
        textShadow: accent ? '0 0 28px var(--saip-accent)' : 'none',
      }}
    >
      {char}
    </motion.span>
  );
}
