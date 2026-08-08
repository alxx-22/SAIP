import type { ReactNode } from 'react';
import { Box } from 'grommet';
import { motion } from 'framer-motion';
import { duration, easing, spring } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { CopilotWidget } from './CopilotWidget';
import { NotificationPane } from './NotificationPane';
import { SideNav } from './SideNav';

/**
 * Persistent app chrome: retractable left navigation, a slim top bar for
 * notifications, and the Copilot Studio slot.
 *
 * LAYOUT
 *
 * A flex row: the nav rail is a real column that occupies width, and the content
 * column takes the rest. The rail handles its own sticky positioning. Nothing
 * here is absolutely positioned, so there are no magic offsets to keep in sync
 * when the rail expands and collapses.
 *
 * Primary navigation used to live in the top bar. It moved into the rail so that
 * Profile could sit at the bottom, away from the destinations, and so the app has
 * room to grow past three sections without the header running out of width.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { reduced } = useAppMotion();

  return (
    <Box background="background-back" style={{ minHeight: '100vh' }}>
      <Box direction="row" align="start">
        <SideNav />

        {/*
          `flex: 1 1 0`, spelled out deliberately.

          Grommet's `flex="grow"` compiles to `flex: 1 0 auto` — grow yes, SHRINK
          NO. With an `auto` basis the column sizes to its content and then
          refuses to give any of it back, so the rail's width was added on top of
          a full-viewport column and pushed the page into horizontal scroll at
          anything under ~1440px.

          Basis 0 makes the column size purely from the space left over after the
          rail, and `min-width: 0` lets it shrink past the intrinsic width of wide
          children (the contracts table) instead of forcing the row wider.
        */}
        <Box
          flex={{ grow: 1, shrink: 1 }}
          style={{ minWidth: 0, flexBasis: 0 }}
        >
          <motion.header
            initial={reduced ? false : { y: -18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: duration.entrance, ease: easing.out }}
            style={{ position: 'sticky', top: 0, zIndex: 20 }}
          >
            <Box
              direction="row"
              align="center"
              justify="end"
              pad={{ horizontal: 'medium', vertical: 'small' }}
              background="background-front"
              border={{ side: 'bottom', color: 'border-weak' }}
              flex={false}
            >
              <motion.div
                initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduced ? { duration: 0 } : { ...spring.bouncy, delay: 0.25 }}
              >
                <NotificationPane />
              </motion.div>
            </Box>
          </motion.header>

          {/* Route content scrolls with the document, not in its own container. */}
          <Box as="main">{children}</Box>
        </Box>
      </Box>

      <CopilotWidget />
    </Box>
  );
}

/*
  The whole-app "Prototype" banner was removed at the client's request.

  Per-card `<SampleDataBadge>` markers are deliberately kept: they travel with
  the figure they qualify, so a screenshot of one ribbon still carries its own
  caveat. The banner only said the same thing once, at the top, where it was
  scrolled past and then forgotten.
*/
