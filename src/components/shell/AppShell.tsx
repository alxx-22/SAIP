import type { ReactNode } from 'react';
import { Box } from 'grommet';
import { CopilotWidget } from './CopilotWidget';
import { SideNav } from './SideNav';

/**
 * Persistent app chrome: retractable left navigation and the Copilot Studio
 * slot. There is no top bar — see the note where it used to be.
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
          {/*
            NO TOP BAR.

            There used to be a sticky strip here carrying one control, the
            notification bell, with every page then drawing its own heading row
            underneath. Two bands of chrome — roughly 120px — before anything
            worth reading, which on a laptop put the first actionable thing
            below the fold.

            The bell moved into `PageHeader`, at the end of the heading row it
            used to float above. Same controls, one band. Any new page should
            use `<PageHeader>` rather than rolling its own title row, or it will
            have no way to reach notifications.
          */}

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
