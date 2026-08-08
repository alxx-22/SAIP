import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService } from '@/services';
import { formatDate, formatRelative } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonRows } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { TagChip } from '@/components/common/ColorChip';

/**
 * Recent meetings for an account.
 *
 * SCOPE NOTE: not one of the three ribbons named in the brief. It is the read
 * side of the Log a Meeting feature, added so that saving a meeting has a
 * visible result — without it the demo flow the deliverable asks for
 * (Homepage → Account Focus → Meeting Log) ends with no feedback. Flagged in
 * the README as an addition, and trivially removable if unwanted.
 *
 * `refreshKey` changes after each successful save so the list reloads.
 */
export function MeetingHistory({
  accountId,
  refreshKey,
}: {
  accountId: string;
  refreshKey: number;
}) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { data, loading, error } = useAsync(
    () => service.getMeetings(accountId),
    [accountId, service, refreshKey],
  );

  if (loading) return <SkeletonRows rows={3} height="72px" label="Loading meetings" />;

  if (error) {
    return (
      <Box pad="medium" round="medium" background="background-critical" role="alert">
        <Text size="small" color="text-strong">
          Couldn’t load meetings. {error.message}
        </Text>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box
        pad="large"
        round="medium"
        background="background-front"
        border={{ color: 'border-weak' }}
        align="center"
        gap="xsmall"
      >
        <Text color="text-weak">No meetings logged for this account yet.</Text>
        <Text size="small" color="text-weak">
          Use “Log a meeting” above to record one.
        </Text>
      </Box>
    );
  }

  return (
    <Box gap="small">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Text size="small" color="text-weak">
          {data.length} meeting{data.length === 1 ? '' : 's'} logged
        </Text>
        {/* PLACEHOLDER DATA — seeded meetings are invented. */}
        <SampleDataBadge />
      </Box>

      <motion.ul
        variants={staggerContainer(reduced)}
        initial="hidden"
        animate="visible"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}
      >
        {data.map((meeting) => (
          <motion.li key={meeting.meetingId} variants={staggerItem(reduced)}>
            <Box
              pad="medium"
              round="medium"
              background="background-front"
              border={{ color: 'border-weak' }}
              gap="xsmall"
            >
              <Box direction="row" align="center" justify="between" gap="small" wrap>
                <Text weight={600} color="text-strong">
                  {meeting.subject}
                </Text>
                <Text size="xsmall" color="text-weak">
                  {formatDate(meeting.meetingDate)} · {formatRelative(meeting.meetingDate)}
                </Text>
              </Box>

              <Text size="small" color="text-weak">
                {meeting.place} · logged by {meeting.loggedBy}
              </Text>

              {meeting.comments && (
                <Text size="small" color="text-default">
                  {meeting.comments}
                </Text>
              )}

              {meeting.tags.length > 0 && (
                <Box direction="row" gap="4px" wrap margin={{ top: '4px' }}>
                  {meeting.tags.map((tag) => (
                    <Box key={tag} flex={false} margin={{ bottom: '2px' }}>
                      <TagChip tag={tag} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </motion.li>
        ))}
      </motion.ul>
    </Box>
  );
}
