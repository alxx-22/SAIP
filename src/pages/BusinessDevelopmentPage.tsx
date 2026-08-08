import { useMemo, useState } from 'react';
import { Box, Text } from 'grommet';
import { Add, Currency, Document as DocIcon, Group, Target } from 'grommet-icons';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAccountService,
  type Account,
  type Incentive,
  type IncentiveStatus,
} from '@/services';
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
import { IncentiveResources } from '@/components/bizdev/IncentiveResources';
import { IncentiveOpportunities } from '@/components/bizdev/IncentiveOpportunities';
import { IncentiveFormModal } from '@/components/bizdev/IncentiveFormModal';
import { IncentiveAssignment } from '@/components/bizdev/IncentiveAssignment';
import { duration, easing, glow } from '@/motion/tokens';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Business Development.
 *
 * Two screens behind one route: the incentive list, and one incentive's detail.
 * `incentiveId` in the URL decides which — so a detail view is linkable and
 * survives a refresh, which a piece of component state would not.
 */
export function BusinessDevelopmentPage() {
  const { incentiveId } = useParams<{ incentiveId: string }>();
  return incentiveId ? (
    <IncentiveDetail incentiveId={incentiveId} />
  ) : (
    <IncentiveList />
  );
}

/* ─── List ──────────────────────────────────────────────────────────────── */

function IncentiveList() {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();
  const [filter, setFilter] = useState<IncentiveStatus>('active');
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading, error } = useAsync(
    () => service.getIncentives(),
    [service, refreshKey],
  );

  const { active, historical } = useMemo(() => {
    const groups = { active: [] as Incentive[], historical: [] as Incentive[] };
    for (const incentive of data ?? []) {
      groups[incentiveStatus(incentive.endDate)].push(incentive);
    }
    return groups;
  }, [data]);

  const shown = filter === 'active' ? active : historical;

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="medium">
      <Box direction="row" align="center" justify="between" gap="medium" wrap>
        <Box gap="xxsmall">
          <Box direction="row" align="center" gap="small">
            <Target color="var(--saip-accent)" />
            <Text as="h1" size="xxlarge" weight={600} color="text-strong" margin="none">
              Business Development
            </Text>
          </Box>
          <Text color="text-weak">
            Incentives, the accounts nominated for them, and the opportunities
            raised against their campaign codes.
          </Text>
        </Box>

        <motion.button
          type="button"
          onClick={() => setCreating(true)}
          whileHover={reduced ? undefined : { y: -2, boxShadow: glow.primary }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          transition={{ duration: duration.fast, ease: easing.out }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            font: 'inherit',
            fontSize: '1rem',
            fontWeight: 500,
            padding: '10px 20px',
            borderRadius: 'var(--hpe-radius-medium)',
            border: 'none',
            whiteSpace: 'nowrap',
            background: 'var(--saip-accent-solid)',
            color: 'var(--saip-on-solid)',
            cursor: 'pointer',
          }}
        >
          <Add size="small" />
          New incentive
        </motion.button>
      </Box>

      {/* Active / Historical. A segmented control rather than tabs: these are two
          filters over one list, not two different kinds of content. */}
      {/* CSS gap — see the note in IncentiveFormModal. */}
      <div
        role="tablist"
        aria-label="Incentive status"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hpe-spacing-xsmall)' }}
      >
        <FilterTab
          label="Active"
          count={active.length}
          selected={filter === 'active'}
          onSelect={() => setFilter('active')}
          reduced={reduced}
        />
        <FilterTab
          label="Historical"
          count={historical.length}
          selected={filter === 'historical'}
          onSelect={() => setFilter('historical')}
          reduced={reduced}
        />
      </div>

      {loading && <SkeletonRows rows={3} height="132px" label="Loading incentives" />}

      {error && (
        <Box
          pad="medium"
          round="medium"
          background="background-critical"
          border={{ color: 'border-critical' }}
          role="alert"
        >
          <Text size="small" color="text-strong">
            Couldn’t load incentives. {error.message}
          </Text>
        </Box>
      )}

      {!loading && !error && shown.length === 0 && (
        <Box
          pad="large"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak' }}
          align="center"
          gap="xxsmall"
        >
          <Text size="small" color="text-weak">
            {filter === 'active'
              ? 'No incentives are running right now.'
              : 'No incentives have finished yet.'}
          </Text>
        </Box>
      )}

      {!loading && !error && shown.length > 0 && (
        <motion.div
          key={filter}
          variants={staggerContainer(reduced, stagger.card)}
          initial="hidden"
          animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--hpe-spacing-small)' }}
        >
          {shown.map((incentive) => (
            <motion.div key={incentive.incentiveId} variants={staggerItem(reduced)}>
              <IncentiveCard
                incentive={incentive}
                reduced={reduced}
                onOpen={() =>
                  navigate(`/business-development/${incentive.incentiveId}`)
                }
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <IncentiveFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setRefreshKey((k) => k + 1);
          // A new incentive starts today, so it lands in Active — switch there
          // rather than leaving the user staring at an unchanged Historical list.
          setFilter('active');
        }}
      />

      <Box height="48px" flex={false} />
    </Box>
  );
}

function FilterTab({
  label,
  count,
  selected,
  onSelect,
  reduced,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
  reduced: boolean;
}) {
  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      whileHover={reduced ? undefined : { y: -1 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        font: 'inherit',
        fontSize: '0.875rem',
        fontWeight: selected ? 600 : 400,
        padding: '8px 14px',
        borderRadius: 'var(--hpe-radius-small)',
        cursor: 'pointer',
        color: 'var(--hpe-color-text-strong)',
        background: selected
          ? 'var(--hpe-color-background-active)'
          : 'transparent',
        border: selected
          ? '1px solid var(--saip-accent)'
          : '1px solid var(--hpe-color-border-weak)',
      }}
    >
      {label}
      <span
        style={{
          fontSize: '0.75rem',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--hpe-color-text-weak)',
        }}
      >
        {count}
      </span>
    </motion.button>
  );
}

function IncentiveCard({
  incentive,
  onOpen,
  reduced,
}: {
  incentive: Incentive;
  onOpen: () => void;
  reduced: boolean;
}) {
  const pipeline = incentivePipelineValue(incentive.opportunities);
  const currency = incentive.opportunities[0]?.currency ?? 'GBP';

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
        style={{
          width: '100%',
          textAlign: 'left',
          font: 'inherit',
          cursor: 'pointer',
          borderWidth: 1,
        }}
      >
        <Box direction="row" align="start" justify="between" gap="small" wrap>
          <Box gap="xxsmall" style={{ minWidth: 0 }}>
            <Box direction="row" align="center" gap="small" wrap>
              <Text size="medium" weight={600} color="text-strong">
                {incentive.title}
              </Text>
              <IncentiveTypeChip type={incentive.type} />
              <SampleDataBadge />
            </Box>
            <Text size="xsmall" color="text-weak">
              {formatDate(incentive.startDate)} —{' '}
              {incentive.endDate ? formatDate(incentive.endDate) : 'open-ended'}
              {incentive.campaignCode && (
                <>
                  {' · '}
                  <Text
                    size="xsmall"
                    weight={600}
                    color="text-strong"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {incentive.campaignCode}
                  </Text>
                </>
              )}
            </Text>
          </Box>
        </Box>

        <Text size="small" color="text-weak" style={{ maxWidth: '68ch' }}>
          {incentive.overview}
        </Text>

        {/* Countable facts, so the card answers "is this worth opening?". */}
        <Box direction="row" gap="medium" wrap>
          <Metric
            icon={<Group size="small" color="icon-default" />}
            value={String(incentive.nominatedAccountIds.length)}
            label="nominated"
          />
          <Metric
            icon={<Target size="small" color="icon-default" />}
            value={String(incentive.opportunities.length)}
            label="opportunities"
          />
          <Metric
            icon={<DocIcon size="small" color="icon-default" />}
            value={String(incentive.resources.length)}
            label="documents"
          />
          {pipeline > 0 && (
            <Metric
              icon={<Currency size="small" color="icon-default" />}
              value={formatCurrencyCompact(pipeline, currency)}
              label="pipeline"
            />
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Box direction="row" align="center" gap="xsmall">
      {icon}
      <Text
        size="small"
        weight={600}
        color="text-strong"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Text>
      <Text size="xsmall" color="text-weak">
        {label}
      </Text>
    </Box>
  );
}

/* ─── Detail ────────────────────────────────────────────────────────────── */

function IncentiveDetail({ incentiveId }: { incentiveId: string }) {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: incentive, loading } = useAsync(
    () => service.getIncentive(incentiveId),
    [service, incentiveId, refreshKey],
  );
  const { data: accounts } = useAsync(() => service.getAccounts(), [service]);

  // Skeleton only on the FIRST load. Saving the assignment refetches, and
  // blanking the whole page to a skeleton for that round trip unmounted the
  // panel mid-save — which threw away its "Saved" confirmation and made a
  // successful write look like nothing had happened.
  if (loading && !incentive) {
    return (
      <Box pad="medium">
        <SkeletonRows rows={4} height="96px" label="Loading incentive" />
      </Box>
    );
  }

  if (!incentive) {
    return (
      <Box pad="medium" gap="small">
        <Text size="large" weight={600} color="text-strong">
          Incentive not found
        </Text>
        <Text size="small" color="text-weak">
          That incentive doesn’t exist, or it was created in a previous session —
          incentives created in this prototype are held in memory only.
        </Text>
        <BackLink onClick={() => navigate('/business-development')} />
      </Box>
    );
  }

  const status = incentiveStatus(incentive.endDate);
  const nominated = (accounts ?? []).filter((a) =>
    incentive.nominatedAccountIds.includes(a.accountId),
  );

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="medium">
      <BackLink onClick={() => navigate('/business-development')} />

      <Box gap="xsmall">
        <Box direction="row" align="center" gap="small" wrap>
          <Text as="h1" size="xxlarge" weight={600} color="text-strong" margin="none">
            {incentive.title}
          </Text>
          <IncentiveTypeChip type={incentive.type} />
          <StatusChip status={status} />
          <SampleDataBadge />
        </Box>
        <Text size="small" color="text-weak">
          {formatDate(incentive.startDate)} —{' '}
          {incentive.endDate ? formatDate(incentive.endDate) : 'open-ended'} · created
          by {incentive.createdBy}
          {incentive.campaignCode && (
            <>
              {' · campaign code '}
              <Text
                size="small"
                weight={600}
                color="text-strong"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {incentive.campaignCode}
              </Text>
            </>
          )}
        </Text>
      </Box>

      <Panel>
        <Text as="h2" size="medium" weight={600} color="text-strong" margin="none">
          Overview
        </Text>
        <Text size="small" color="text-default" style={{ maxWidth: '72ch' }}>
          {incentive.overview}
        </Text>
      </Panel>

      <Panel>
        <IncentiveResources
          resources={incentive.resources}
          readOnly={status === 'historical'}
        />
      </Panel>

      <Panel>
        <Box direction="row" align="center" justify="between" gap="small" wrap>
          <Text as="h2" size="medium" weight={600} color="text-strong" margin="none">
            Nominated accounts
          </Text>
          <Text size="xsmall" color="text-weak">
            {nominated.length} account{nominated.length === 1 ? '' : 's'}
          </Text>
        </Box>

        {nominated.length === 0 ? (
          <Text size="small" color="text-weak">
            No accounts have been nominated for this incentive.
          </Text>
        ) : (
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hpe-spacing-small)' }}
          >
            {nominated.map((account) => (
              <NominatedAccount
                key={account.accountId}
                account={account}
                reduced={reduced}
                onOpen={() => navigate(`/account/${account.accountId}`)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <IncentiveAssignment
          incentive={incentive}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      </Panel>

      <Panel>
        <IncentiveOpportunities
          opportunities={incentive.opportunities}
          campaignCode={incentive.campaignCode}
        />
      </Panel>

      <Box height="48px" flex={false} />
    </Box>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      background="background-front"
      round="medium"
      pad="medium"
      gap="small"
      border={{ color: 'border-weak' }}
    >
      {children}
    </Box>
  );
}

function NominatedAccount({
  account,
  onOpen,
  reduced,
}: {
  account: Account;
  onOpen: () => void;
  reduced: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        flex: '1 1 240px',
        textAlign: 'left',
        font: 'inherit',
        padding: 'var(--hpe-spacing-small)',
        borderRadius: 'var(--hpe-radius-small)',
        background: 'var(--hpe-color-background-back)',
        border: '1px solid var(--hpe-color-border-weak)',
        cursor: 'pointer',
      }}
    >
      <Text size="small" weight={600} color="text-strong" as="div">
        {account.accountName}
      </Text>
      <Text size="xsmall" color="text-weak" as="div">
        {account.industry} · {account.region}
      </Text>
    </motion.button>
  );
}

function StatusChip({ status }: { status: IncentiveStatus }) {
  const active = status === 'active';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.5,
        background: active
          ? 'var(--hpe-color-background-ok)'
          : 'var(--hpe-color-background-back)',
        color: 'var(--hpe-color-text-strong)',
        border: `1px solid var(--hpe-color-border-${active ? 'ok' : 'weak'})`,
      }}
    >
      {active ? 'Active' : 'Historical'}
    </span>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        alignSelf: 'flex-start',
        font: 'inherit',
        fontSize: '0.875rem',
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--saip-accent)',
        cursor: 'pointer',
      }}
    >
      ← All incentives
    </button>
  );
}
