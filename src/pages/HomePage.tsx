import { Box, Button, Text } from 'grommet';
import { AddCircle } from 'grommet-icons';
import { motion } from 'framer-motion';
import { useAccountService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { AccountSelectionPane } from '@/components/accounts/AccountSelectionPane';
import { ScoresOverview } from '@/components/scores/ScoresOverview';
import { useMeetingLog } from '@/components/meetings/MeetingLogProvider';
import {
  fadeRise,
  scrollRevealProps,
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
        style={{ display: 'grid', gap: 'var(--hpe-spacing-large)' }}
      >
        {/* Greeting + primary action */}
        <motion.div variants={staggerItem(reduced)}>
          <Box direction="row" align="center" justify="between" gap="medium" wrap>
            <Box gap="xxsmall">
              <Text as="h1" size="xxlarge" weight={600} color="text-strong" margin="none">
                {/* PLACEHOLDER — the display name comes from the mock service.
                    In production Power Pages supplies the Entra ID identity. */}
                {user ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Welcome back'}
              </Text>
              <Text color="text-weak">
                Your aligned accounts, relationship health and services spend — in one
                place.
              </Text>
            </Box>

            <Button
              primary
              icon={<AddCircle />}
              label="Log a meeting"
              // No account passed → the modal renders its account picker.
              onClick={() => openMeetingLog()}
            />
          </Box>
        </motion.div>

        <motion.div variants={staggerItem(reduced)}>
          <ScoresOverview
            heading="Overview"
            description="Portfolio-level scores across every account aligned to you."
          />
        </motion.div>

        {/* The account list usually sits at or below the fold, so it reveals
            on scroll rather than having already played by the time it's read. */}
        <motion.div {...scrollRevealProps(reduced)}>
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
