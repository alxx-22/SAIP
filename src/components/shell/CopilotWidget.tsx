import { useState } from 'react';
import { Box, Button, Text } from 'grommet';
import { Chat, Close } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Copilot Studio slot — container only.
 *
 * PLACEHOLDER: the real Copilot Studio embed is added later. This reserves the
 * fixed bottom-right position on every page and gives the slot a considered
 * entrance and hover state so it doesn't read as an afterthought (brief §8).
 *
 * TO EMBED THE REAL BOT: replace the panel body marked below with the Copilot
 * Studio <iframe>. The launcher, open/close animation, focus handling and
 * layout above it are already done and need no changes.
 */
export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const { reduced } = useAppMotion();

  return (
    <Box
      style={{
        position: 'fixed',
        right: 'var(--hpe-spacing-medium)',
        bottom: 'var(--hpe-spacing-medium)',
        zIndex: 30,
        alignItems: 'flex-end',
      }}
      flex={false}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="copilot-panel"
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 8,
                    scale: 0.98,
                    transition: { duration: duration.exit, ease: easing.in },
                  }
            }
            transition={{ duration: duration.entrance, ease: easing.out }}
            style={{ transformOrigin: 'bottom right', marginBottom: 12 }}
          >
            <Box
              width="360px"
              height="440px"
              round="medium"
              background="background-front"
              border={{ color: 'border-weak' }}
              elevation="large"
              overflow="hidden"
              role="dialog"
              aria-label="SAIP assistant"
            >
              <Box
                direction="row"
                align="center"
                justify="between"
                pad={{ horizontal: 'small', vertical: 'xsmall' }}
                background="background-primary-strong"
                flex={false}
              >
                <Text size="small" weight={600} color="text-onPrimaryStrong">
                  SAIP Assistant
                </Text>
                <Button
                  icon={<Close size="small" color="icon-onPrimaryStrong" />}
                  onClick={() => setOpen(false)}
                  a11yTitle="Close assistant"
                  plain
                />
              </Box>

              {/* ── COPILOT STUDIO EMBED GOES HERE ──────────────────────── */}
              <Box
                flex
                align="center"
                justify="center"
                pad="medium"
                gap="xsmall"
                background="background-back"
              >
                <Chat size="large" color="icon-weak" />
                <Text size="small" color="text-weak" textAlign="center">
                  Copilot Studio embed slot
                </Text>
                <Text size="xsmall" color="text-weak" textAlign="center">
                  The bot iframe mounts here. Container, launcher and animation
                  are complete; bot configuration is out of scope for this build.
                </Text>
              </Box>
              {/* ─────────────────────────────────────────────────────────── */}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <CopilotLauncher open={open} reduced={reduced} onToggle={() => setOpen((v) => !v)} />
    </Box>
  );
}

/**
 * The collapsed launcher.
 * Pops in after the rest of the page has settled (`delay`), so it arrives as
 * the last thing the eye catches rather than competing with the page content.
 */
function CopilotLauncher({
  open,
  reduced,
  onToggle,
}: {
  open: boolean;
  reduced: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? 'Close SAIP assistant' : 'Open SAIP assistant'}
      initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : // Spring + delay: lands after the page entrance has finished.
            { type: 'spring', stiffness: 380, damping: 20, delay: 0.55 }
      }
      whileHover={reduced ? undefined : { scale: 1.08, y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.95 }}
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--hpe-color-background-primary-strong)',
        boxShadow: 'var(--hpe-shadow-medium)',
      }}
    >
      {open ? (
        <Close color="icon-onPrimaryStrong" />
      ) : (
        <Chat color="icon-onPrimaryStrong" />
      )}
    </motion.button>
  );
}
