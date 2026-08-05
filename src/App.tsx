import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageTransition } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';
import { AppShell } from '@/components/shell/AppShell';
import { MeetingLogProvider } from '@/components/meetings/MeetingLogProvider';
import { HomePage } from '@/pages/HomePage';
import { AccountFocusPage } from '@/pages/AccountFocusPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

/**
 * SAIP routes.
 *
 * Authentication is deliberately absent — Power Pages resolves the Entra ID
 * identity before this renders, so every screen assumes a signed-in user
 * (brief §2).
 *
 * `MeetingLogProvider` sits above the routes so the meeting modal is a single
 * shared instance reachable from both the Homepage and Account Focus.
 */
export default function App() {
  const location = useLocation();
  const { reduced } = useAppMotion();

  return (
    <MeetingLogProvider>
      <AppShell>
        {/*
          Route-level transition. `mode="wait"` lets the outgoing page finish
          leaving before the next arrives, so the two never overlap mid-scroll.
          Keying on `pathname` (not the full location) means the same page with
          different search params doesn't re-animate.
        */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageTransition(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/account/:accountId" element={<AccountFocusPage />} />
          <Route
            path="/executive-view"
            element={
              <PlaceholderPage
                title="Executive View"
                description="Reserved in the navigation only. Out of scope for this build — no content has been designed or built yet."
              />
            }
          />
          <Route
            path="/business-development"
            element={
              <PlaceholderPage
                title="Business Development"
                description="Reserved in the navigation only. Out of scope for this build — no content has been designed or built yet."
              />
            }
          />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page not found"
                description="That route doesn’t exist in SAIP."
              />
            }
          />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </MeetingLogProvider>
  );
}
