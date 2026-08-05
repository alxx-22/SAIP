import { Route, Routes } from 'react-router-dom';
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
  return (
    <MeetingLogProvider>
      <AppShell>
        <Routes>
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
      </AppShell>
    </MeetingLogProvider>
  );
}
