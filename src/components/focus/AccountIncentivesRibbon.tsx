import { useMemo } from 'react';
import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAccountService, type Incentive } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import {
  formatCurrencyCompact,
  formatDate,
  incentivePipelineValue,
  incentiveStatus,
} from '@/services/derive';
import { IncentiveTypeChip } from '@/components/common/ColorChip';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { SkeletonRows } from '@/components/common/Skeleton';
import { duration, easing, stagger } from '@/motion/tokens';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Incentives this account has been nominated for.
 *
 * The rep opens Account Focus to answer "what is going on with this customer",
 * and a live campaign targeting them is part of that answer — but it lived only
 * in Business Development, which an account manager has little reason to visit.
 *
 * ONLY THE OPPORTUNITIES RAISED AGAINST THIS ACCOUNT are shown, not the
 * incentive's whole pipeline. On this page the account is the subject; another
 * customer's deal under the same campaign is noise.
 */
export function AccountIncentivesRibbon({ accountId }: { accountId: string }) {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();

  const { data, loading } = useAsync(() => service.getIncentives(), [service]);

  const nominated = useMemo(
    () => (data ?? []).filter((i) => i.nominatedAccountIds.includes(accountId)),
    [data, accountId],
  );

  const active = nominated.filter((i) => incentiveStatus(i.endDate) === 'active');
  const past = nominated.filter((i) => incentiveStatus(i.endDate) === 'historical');

  if (loading) {
    return <SkeletonRows rows={2} height="112px" label="Loading incentives" />;
  }

  if (nominated.length === 0) {
    return (
      <Box
        pad="large"
        round="medium"
        background="background-front"
        border={{ color: 'border-weak' }}
        align="center"
        gap="xxsmall"
      >
        <Text size="small" color="text-weak">
          This account isn’t nominated for any incentives.
        </Text>
        <Text size="xsmall" color="text-weak" textAlign="center">
          Nominations are made on the incentive itself, under Business Development.
        </Text>
      </Box>
    );
  }

  return (
    <Box gap="medium">
      {active.length > 0 && (
        <Section
          heading="Active"
          incentives={active}
          accountId={accountId}
          reduced={reduced}
          onOpen={(id) => navigate(`/business-development/${id}`)}
        />
      )}
      {past.length > 0 && (
        <Section
          heading="Finished"
          incentives={past}
          accountId={accountId}
          reduced={reduced}
          onOpen={(id) => navigate(`/business-development/${id}`)}
        />
      )}
    </Box>
  );
}

function Section({
  heading,
  incentives,
  accountId,
  reduced,
  onOpen,
}: {
  heading: string;
  incentives: Incentive[];
  accountId: string;
  reduced: boolean;
  onOpen: (incentiveId: string) => void;
}) {
  return (
    <Box gap="small">
      <Box direction="row" align="center" gap="small">
        <Text as="h3" size="medium" weight={600} color="text-strong" margin="none">
          {heading}
        </Text>
        <Text size="small" color="text-weak">
          {incentives.length}
        </Text>
      </Box>

      <motion.div
        variants={staggerContainer(reduced, stagger.card)}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gap: 'var(--hpe-spacing-small)' }}
      >
        {incentives.map((incentive) => (
          <motion.div key={incentive.incentiveId} variants={staggerItem(reduced)}>
            <IncentiveRow
              incentive={incentive}
              accountId={accountId}
              reduced={reduced}
              onOpen={() => onOpen(incentive.incentiveId)}
            />
          </motion.div>
        ))}
      </motion.div>
    </Box>
  );
}

function IncentiveRow({
  incentive,
  accountId,
  reduced,
  onOpen,
}: {
  incentive: Incentive;
  accountId: string;
  reduced: boolean;
  onOpen: () => void;
}) {
  // This account's slice of the campaign, not the campaign's whole pipeline.
  const own = incentive.opportunities.filter((o) => o.accountId === accountId);
  const value = incentivePipelineValue(own);
  const currency = own[0]?.currency ?? 'GBP';

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
            gap: 'var(--hpe-spacing-medium)',
          }}
        >
          <Text size="xsmall" color="text-weak">
            {formatDate(incentive.startDate)} —{' '}
            {incentive.endDate ? formatDate(incentive.endDate) : 'open-ended'}
          </Text>
          {incentive.campaignCode && (
            <Text
              size="xsmall"
              weight={600}
              color="text-strong"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {incentive.campaignCode}
            </Text>
          )}
          <Text size="xsmall" color="text-weak">
            {own.length === 0
              ? 'No opportunities raised for this account'
              : `${own.length} opportunit${own.length === 1 ? 'y' : 'ies'} · ${formatCurrencyCompact(value, currency)}`}
          </Text>
        </div>
      </Box>
    </motion.div>
  );
}
