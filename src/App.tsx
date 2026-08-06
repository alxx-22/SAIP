import { Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';
import { AppShell } from '@/components/shell/AppShell';
import { AppIntro } from '@/components/shell/AppIntro';
import { ScrollToTop } from '@/components/shell/ScrollToTop';
import { MeetingLogProvider } from '@/components/meetings/MeetingLogProvider';
import { HomePage } from '@/pages/HomePage';
import { AccountFocusPage } from '@/pages/AccountFocusPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { BusinessDevelopmentPage } from '@/pages/BusinessDevelopmentPage';
import { AdminPage } from '@/pages/AdminPage';

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
      <AppIntro />
      {/* Resets scroll on navigation — without it, scroll-triggered reveals
          leave the top of the next page invisible and it reads as blank. */}
      <ScrollToTop />
      <AppShell>
        {/*
          Route-level entrance — deliberately WITHOUT AnimatePresence.

          This used to be `<AnimatePresence mode="wait">`, which holds the
          incoming page until the outgoing one has finished its exit animation.
          Navigate again before that exit completes and the presence state
          stalls: the old page is gone, the new one has not been allowed to
          mount, and the user is looking at an empty <main>. That is the blank
          page — it needed navigation faster than the ~260ms exit to show up,
          which is entirely normal clicking.

          A keyed motion.div with no exit cannot get into that state: the new
          route mounts immediately and animates in. Route exits are the one
          animation worth losing here. Modals, popovers and the assistant
          panel keep theirs, because those unmount without a replacement
          waiting behind them.
        */}
        <motion.div
          key={location.pathname}
          variants={pageTransition(reduced)}
          initial="hidden"
          animate="visible"
        >
          <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/account/:accountId" element={<AccountFocusPage />} />
          {/* Settings live in the app rather than on a second Power Pages page —
              see the note at the top of ProfilePage. */}
          <Route path="/profile" element={<ProfilePage />} />
          {/* Administrators only in production — enforced by web role and table
              permissions, never by hiding the nav entry. */}
          <Route path="/admin" element={<AdminPage />} />
          <Route
            path="/executive-view"
            element={
              <PlaceholderPage
                title="Executive View"
                description="Reserved in the navigation only. Out of scope for this build — no content has been designed or built yet."
              />
            }
          />
          <Route path="/business-development" element={<BusinessDevelopmentPage />} />
          {/* Detail is a route, not component state, so an incentive is
              linkable and survives a refresh. */}
          <Route
            path="/business-development/:incentiveId"
            element={<BusinessDevelopmentPage />}
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
      </AppShell>
    </MeetingLogProvider>
  );
}
