import { useMemo } from 'react';
import { Box, Text } from 'grommet';
import { Achievement, Group, User } from 'grommet-icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAccountService, type Incentive, type WebRole } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, incentiveStatus } from '@/services/derive';
import { IncentiveTypeChip } from '@/components/common/ColorChip';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { SkeletonRows } from '@/components/common/Skeleton';
import { duration, easing, stagger } from '@/motion/tokens';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * My Incentives — what the signed-in person is expected to act on.
 *
 * TWO WAYS TO BE ASSIGNED, and the page says which applies. Being named
 * directly is an exception; holding a role that was assigned is the normal
 * path, and someone joining that role picks the incentive up without anyone
 * editing a list. Showing the reason matters because "why am I seeing this?"
 * is otherwise unanswerable from the UI.
 *
 * Nominated ACCOUNTS are deliberately not what drives this page — an account
 * being targeted by a campaign does not make any particular person responsible
 * for it. Those surface on the account's own page instead.
 */
export function MyIncentivesPage() {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();

  const { data: user } = useAsync(() => service.getCurrentUser(), [service]);
  const { data: roles } = useAsync(() => service.getWebRoles(), [service]);
  const { data: incentives, loading } = useAsync(
    () => service.getIncentives(),
    [service],
  );

  const mine = useMemo(() => {
    if (!user || !incentives) return [];
    return incentives
      .map((incentive) => {
        const direct = incentive.assignedUserIds.includes(user.userId);
        const viaRoles = incentive.assignedRoleIds.filter((r) =>
          user.roleIds.includes(r),
        );
        return { incentive, direct, viaRoles };
      })
      .filter((row) => row.direct || row.viaRoles.length > 0);
  }, [user, incentives]);

  const active = mine.filter((r) => incentiveStatus(r.incentive.endDate) === 'active');
  const past = mine.filter((r) => incentiveStatus(r.incentive.endDate) === 'historical');

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="medium">
      <Box gap="xxsmall">
        <Box direction="row" align="center" gap="small">
          <Achievement color="var(--saip-accent)" />
          <Text as="h1" size="xxlarge" weight={600} color="text-strong" margin="none">
            My Incentives
          </Text>
        </Box>
        <Text color="text-weak" style={{ maxWidth: '72ch' }}>
          Training, sales plays and campaigns assigned to you — directly or
          through a role you hold.
        </Text>
      </Box>

      {loading && <SkeletonRows rows={3} height="120px" label="Loading your incentives" />}

      {!loading && mine.length === 0 && (
        <Box
          pad="large"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak' }}
          align="center"
          gap="xxsmall"
        >
          <Text size="small" color="text-weak">
            Nothing is assigned to you right now.
          </Text>
          <Text size="xsmall" color="text-weak" textAlign="center">
            Incentives appear here when someone assigns them to you or to a role
            you hold.
          </Text>
        </Box>
      )}

      {!loading && active.length > 0 && (
        <Group2
          heading="Active"
          rows={active}
          roles={roles ?? []}
          reduced={reduced}
          onOpen={(id) => navigate(`/business-development/${id}`)}
        />
      )}

      {!loading && past.length > 0 && (
        <Group2
          heading="Finished"
          rows={past}
          roles={roles ?? []}
          reduced={reduced}
          onOpen={(id) => navigate(`/business-development/${id}`)}
        />
      )}

      <Box height="48px" flex={false} />
    </Box>
  );
}

interface AssignedRow {
  incentive: Incentive;
  direct: boolean;
  viaRoles: string[];
}

function Group2({
  heading,
  rows,
  roles,
  reduced,
  onOpen,
}: {
  heading: string;
  rows: AssignedRow[];
  roles: WebRole[];
  reduced: boolean;
  onOpen: (incentiveId: string) => void;
}) {
  return (
    <Box gap="small">
      <Box direction="row" align="center" gap="small">
        <Text as="h2" size="large" weight={600} color="text-strong" margin="none">
          {heading}
        </Text>
        <Text size="small" color="text-weak">
          {rows.length}
        </Text>
      </Box>

      <motion.div
        variants={staggerContainer(reduced, stagger.card)}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--hpe-spacing-small)' }}
      >
        {rows.map((row) => (
          <motion.div key={row.incentive.incentiveId} variants={staggerItem(reduced)}>
            <AssignedCard
              row={row}
              roles={roles}
              reduced={reduced}
              onOpen={() => onOpen(row.incentive.incentiveId)}
            />
          </motion.div>
        ))}
      </motion.div>
    </Box>
  );
}

function AssignedCard({
  row,
  roles,
  reduced,
  onOpen,
}: {
  row: AssignedRow;
  roles: WebRole[];
  reduced: boolean;
  onOpen: () => void;
}) {
  const { incentive, direct, viaRoles } = row;
  const roleNames = viaRoles.map(
    (id) => roles.find((r) => r.roleId === id)?.name ?? id,
  );

  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -3 }}
      transition={{ duration: duration.fast, ease: easing.out }}
    >
      <Box
        as="button"
        onClick={onOpen}
        pad="medium"
        round="medium"
        background="background-front"
        border={{ color: 'border-weak' }}
        gap="small"
        style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
      >
        <Box direction="row" align="center" gap="small" wrap>
          <Text size="medium" weight={600} color="text-strong">
            {incentive.title}
          </Text>
          <IncentiveTypeChip type={incentive.type} />
          <SampleDataBadge />
        </Box>

        <Text size="small" color="text-weak" style={{ maxWidth: '68ch' }}>
          {incentive.overview}
        </Text>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--hpe-spacing-small)',
          }}
        >
          {/* Why this is on your list. Direct assignment is the exception, so it
              is worth distinguishing from "everyone in your role got this". */}
          {direct && (
            <Reason icon={<User size="small" color="icon-default" />}>
              Assigned to you
            </Reason>
          )}
          {roleNames.length > 0 && (
            <Reason icon={<Group size="small" color="icon-default" />}>
              Via {roleNames.join(', ')}
            </Reason>
          )}
          <Text size="xsmall" color="text-weak">
            {formatDate(incentive.startDate)} —{' '}
            {incentive.endDate ? formatDate(incentive.endDate) : 'open-ended'}
          </Text>
          {incentive.resources.length > 0 && (
            <Text size="xsmall" color="text-weak">
              {incentive.resources.length} document
              {incentive.resources.length === 1 ? '' : 's'}
            </Text>
          )}
        </div>
      </Box>
    </motion.div>
  );
}

function Reason({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.75rem',
        background: 'var(--hpe-color-background-back)',
        border: '1px solid var(--hpe-color-border-weak)',
        color: 'var(--hpe-color-text-strong)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </span>
  );
}
