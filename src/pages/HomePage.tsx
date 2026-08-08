import { Box } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { AccountSelectionPane } from '@/components/accounts/AccountSelectionPane';
import { LogMeetingButton } from '@/components/common/LogMeetingButton';
import { SaipAiPrompt } from '@/components/shell/SaipAiPrompt';
import { PageHeader } from '@/components/shell/PageHeader';
import { useMeetingLog } from '@/components/meetings/MeetingLogProvider';
import {
  fadeRise,
  revealOnMount,
  staggerContainer,
  staggerItem,
} from '@/motion/variants';
import { stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Homepage (brief §6).
 *
 * Sections: greeting, Overview scores, Account Selection Pane, and the
 * Log a Meeting entry point — opened WITHOUT a locked account, so the modal
 * shows its account picker.
 */
export function HomePage() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { openMeetingLog } = useMeetingLog();
  const { data: user } = useAsync(() => service.getCurrentUser(), [service]);

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="large">
      <motion.div
        variants={staggerContainer(reduced, stagger.card)}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--hpe-spacing-large)' }}
      >
        {/* Greeting + primary action. PageHeader also carries the notification
            bell, which is why every page uses it — there is no top bar. */}
        <motion.div variants={staggerItem(reduced)}>
          <PageHeader
            /* PLACEHOLDER — the display name comes from the mock service.
               In production Power Pages supplies the Entra ID identity. */
            title={
              user ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Welcome back'
            }
            subtitle="Your aligned accounts, relationship health and services spend — in one place."
            /* No account passed → the modal renders its account picker. */
            actions={<LogMeetingButton onClick={() => openMeetingLog()} />}
          />
        </motion.div>

        {/* Assistant entry point sits directly under the greeting: it is the
            fastest route to an answer, so it comes before the dashboards a rep
            would otherwise have to read. Placeholder for now — see the note in
            SaipAiPrompt. */}
        <motion.div variants={staggerItem(reduced)}>
          <SaipAiPrompt />
        </motion.div>

        {/*
          NO GAUGES HERE.

          The portfolio roll-up used to sit at this point. It was removed
          because a single averaged score across every aligned account is a
          number nobody can act on — the accounts that need attention are
          exactly the ones the average hides. The gauges now appear only on
          Account Focus, where a score names something a rep can do
          something about.

          `ScoresOverview` still supports the portfolio mode (call it with no
          `accountId`) if that roll-up is ever wanted again.
        */}

        {/* Mount-based, not scroll-triggered — see revealOnMount for why. */}
        <motion.div {...revealOnMount(reduced, 0.12)}>
          <AccountSelectionPane />
        </motion.div>
      </motion.div>

      {/* Bottom spacer so the Copilot launcher never covers the last row. */}
      <motion.div variants={fadeRise(reduced)} initial="hidden" animate="visible">
        <Box height="48px" flex={false} />
      </motion.div>
    </Box>
  );
}
