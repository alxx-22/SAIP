import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { duration, easing, spring } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Opening animation for the whole app, centred on the SAIP mark.
 *
 * The brand rail draws itself, the wordmark and subtitle rise in behind it,
 * then the whole overlay lifts away to reveal the portal underneath.
 *
 * Plays once per browser tab, not once per route change — `sessionStorage`
 * keeps it from replaying every time the user comes back to Home, which would
 * be exhausting for someone using this all day.
 *
 * Under reduced motion it never mounts at all: there is nothing here but
 * motion, so the right fallback is to skip straight to the app.
 */
const SEEN_KEY = 'saip.intro.seen';

/** How long the intro occupies the screen, in seconds. */
export const INTRO_DURATION_S = 1.75;

/**
 * Whether the intro will play on this mount.
 *
 * Other components use this to schedule their own entrance for *after* the
 * overlay lifts — otherwise their animation plays behind it and is never seen.
 * Read once at module scope per mount rather than watched, because the intro
 * only ever plays on the first render of a tab.
 */
export function introWillPlay(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SEEN_KEY) !== 'true';
}

export function AppIntro() {
  const { reduced } = useAppMotion();
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SEEN_KEY) !== 'true';
  });

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      sessionStorage.setItem(SEEN_KEY, 'true');
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, 'true');
      setVisible(false);
    }, INTRO_DURATION_S * 1000);
    return () => window.clearTimeout(id);
  }, [visible, reduced]);

  // Hide the intro from assistive tech — it carries no information the app
  // doesn't already present, and announcing it would just delay the content.
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="saip-intro"
          aria-hidden
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.04,
            transition: { duration: duration.entrance, ease: easing.in },
          }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Brand rail draws itself vertically. */}
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: easing.out }}
              style={{
                width: 10,
                height: 64,
                borderRadius: 5,
                transformOrigin: 'center',
                background: 'var(--saip-accent)',
                boxShadow: '0 0 24px -2px var(--saip-accent)',
              }}
            />

            <div style={{ overflow: 'hidden' }}>
              <motion.div
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...spring.soft, delay: 0.22 }}
                style={{
                  fontSize: '3rem',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                  color: 'var(--hpe-color-text-strong)',
                }}
              >
                SAIP
              </motion.div>
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: duration.entrance, ease: easing.out, delay: 0.42 }}
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--hpe-color-text-weak)',
                }}
              >
                Services Account Intelligence Portal
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
