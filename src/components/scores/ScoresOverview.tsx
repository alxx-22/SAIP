import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonBar } from '@/components/common/Skeleton';
import { ScoreCard } from './ScoreCard';

/**
 * Overview — the three headline scores (brief §7.2).
 *
 * Reused on both the homepage (portfolio roll-up) and Account Focus
 * (single account), which is why the loader is injected rather than assumed.
 */
export function ScoresOverview({
  accountId,
  heading = 'Overview',
  description,
}: {
  /** Omit for the portfolio-level roll-up. */
  accountId?: string;
  heading?: string;
  description?: string;
}) {
  const service = useAccountService();
  const { reduced } = useAppMotion();

  const { data, loading, error } = useAsync(
    () =>
      accountId ? service.getAccountScores(accountId) : service.getPortfolioScores(),
    [accountId, service],
  );

  return (
    <Box gap="small">
      <Box gap="xxsmall">
        <Text as="h2" size="large" weight={600} color="text-strong" margin="none">
          {heading}
        </Text>
        {description && (
          <Text size="small" color="text-weak">
            {description}
          </Text>
        )}
      </Box>

      {loading && <ScoresSkeleton />}

      {error && (
        <Box
          pad="medium"
          round="medium"
          background="background-critical"
          border={{ color: 'border-critical' }}
          role="alert"
        >
          <Text size="small" color="text-strong">
            Couldn’t load scores. {error.message}
          </Text>
        </Box>
      )}

      {!loading && !error && data && (
        <motion.div
          variants={staggerContainer(reduced, stagger.card)}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hpe-spacing-small)' }}
        >
          {data.map((score, i) => (
            <motion.div
              key={score.key}
              variants={staggerItem(reduced)}
              style={{ flex: '1 1 230px', display: 'flex' }}
            >
              <ScoreCard score={score} index={i} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </Box>
  );
}

function ScoresSkeleton() {
  return (
    <Box
      direction="row"
      gap="small"
      wrap
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading scores"
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          pad="small"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak' }}
          gap="small"
          style={{ flex: '1 1 230px', minWidth: 230 }}
        >
          <SkeletonBar height="20px" width="60%" />
          <Box direction="row" align="center" gap="small">
            {/* Matches GAUGE_CSS_SIZE so the skeleton is the same height as the
                card that replaces it and the page does not jump on load. */}
            <SkeletonBar
              height="clamp(76px, 11vh, 116px)"
              width="clamp(76px, 11vh, 116px)"
              round="full"
            />
            <Box gap="xsmall" flex>
              <SkeletonBar height="18px" width="80%" />
              <SkeletonBar height="14px" width="60%" />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
