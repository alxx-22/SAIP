import { useMemo } from 'react';
import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Achievement,
  Alert,
  Currency,
  Document as DocIcon,
  FormNextLink,
} from 'grommet-icons';
import {
  OPEN_OPPORTUNITY_STAGES,
  useAccountService,
  type AppNotification,
} from '@/services';
import {
  RENEWAL_SOON_DAYS,
  daysUntil,
  formatCurrencyCompact,
  formatDate,
  incentiveStatus,
} from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/settings/SettingsProvider';
import { SkeletonRows } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { duration, easing } from '@/motion/tokens';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';

/** Opportunities closing inside this window count as "closing soon". */
const CLOSING_SOON_DAYS = 90;

/**
 * Home — the first thing anyone sees on an account.
 *
 * Every other tab answers a question you have to already have. This one answers
 * the question a rep actually arrives with: **what needs me, on this account,
 * today.**
 *
 * It stores nothing and adds no data of its own. Each card is a count and a
 * figure derived from the tab behind it, and clicking one goes there. That is
 * the whole design: the summary is a router, not a report, so nothing here can
 * disagree with the detail it points at.
 *
 * A card that has nothing to say is not rendered. An account with no incentives
 * shows no incentives card, rather than a card saying zero — a screen of zeroes
 * trains people to stop reading it.
 */
export function AccountHomeRibbon({
  accountId,
  onOpenRibbon,
}: {
  accountId: string;
  onOpenRibbon: (key: 'value' | 'contracts' | 'opportunities' | 'monitoring' | 'incentives') => void;
}) {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();
  const { notifications: notificationSettings } = useSettings();

  const { data: contracts, loading: loadingContracts } = useAsync(
    () => service.getServiceContracts(accountId),
    [accountId, service],
  );
  const { data: opportunities, loading: loadingOpportunities } = useAsync(
    () => service.getAccountOpportunities(accountId),
    [accountId, service],
  );
  const { data: incentives, loading: loadingIncentives } = useAsync(
    () => service.getIncentives(),
    [service],
  );
  const { data: notifications, loading: loadingNotifications } = useAsync(
    () =>
      service.getNotifications({
        overdueAfterMonths: notificationSettings.overdueAfterMonths,
      }),
    [service, notificationSettings.overdueAfterMonths],
  );

  const loading =
    loadingContracts || loadingOpportunities || loadingIncentives || loadingNotifications;

  /* ── Contracts renewing ─────────────────────────────────────────────────
     Sorted by renewal date so "next to renew" is the first one, which is the
     figure the card leads with. */
  const renewing = useMemo(() => {
    const soon = (contracts ?? [])
      .filter((c) => {
        const days = daysUntil(c.renewalDate);
        return days >= 0 && days <= RENEWAL_SOON_DAYS;
      })
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
    return { list: soon, next: soon[0] };
  }, [contracts]);

  /* ── Opportunities closing ──────────────────────────────────────────── */
  const closing = useMemo(() => {
    const open = (opportunities ?? []).filter((o) =>
      OPEN_OPPORTUNITY_STAGES.includes(o.stage),
    );
    const soon = open
      .filter((o) => {
        const days = daysUntil(o.closeDate);
        return days >= 0 && days <= CLOSING_SOON_DAYS;
      })
      .sort((a, b) => a.closeDate.localeCompare(b.closeDate));
    return {
      open,
      soon,
      value: soon.reduce((sum, o) => sum + o.totalValue, 0),
      currency: open[0]?.currency ?? 'GBP',
    };
  }, [opportunities]);

  /* ── Active incentives nominating this account ──────────────────────── */
  const activeIncentives = useMemo(
    () =>
      (incentives ?? []).filter(
        (i) =>
          i.nominatedAccountIds.includes(accountId) &&
          incentiveStatus(i.endDate) === 'active',
      ),
    [incentives, accountId],
  );

  /* ── Monitoring questions outstanding ───────────────────────────────── */
  const accountNotifications = useMemo(
    () => (notifications ?? []).filter((n) => n.accountId === accountId),
    [notifications, accountId],
  );

  if (loading) {
    return <SkeletonRows rows={3} height="96px" label="Loading account summary" />;
  }

  const nothingToShow =
    renewing.list.length === 0 &&
    closing.soon.length === 0 &&
    activeIncentives.length === 0 &&
    accountNotifications.length === 0;

  if (nothingToShow) {
    return (
      <Box
        pad="large"
        round="medium"
        background="background-front"
        border={{ color: 'border-weak' }}
        align="center"
        gap="xxsmall"
      >
        <Text size="medium" weight={600} color="text-strong">
          Nothing needs your attention here.
        </Text>
        <Text size="small" color="text-weak" textAlign="center">
          No contracts renewing, nothing closing soon, no live incentives and no
          monitoring questions outstanding. The tabs above have the detail.
        </Text>
      </Box>
    );
  }

  return (
    <Box gap="medium">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Text size="small" color="text-weak">
          What needs attention on this account. Every card opens the tab behind it.
        </Text>
        {/* PLACEHOLDER DATA — every figure below is derived from invented data. */}
        <SampleDataBadge />
      </Box>

      <motion.div
        variants={staggerContainer(reduced)}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          // Cards find their own column count; nothing is pinned to a
          // breakpoint, so this survives the nav rail expanding and collapsing.
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--hpe-spacing-small)',
        }}
      >
        {renewing.list.length > 0 && (
          <motion.div variants={staggerItem(reduced)}>
            <SummaryCard
              icon={<DocIcon size="small" color="var(--saip-accent)" />}
              label="Contracts renewing"
              value={String(renewing.list.length)}
              unit={`in ${RENEWAL_SOON_DAYS} days`}
              detail={
                renewing.next
                  ? `Next: ${formatCurrencyCompact(
                      renewing.next.value,
                      renewing.next.currency,
                    )} on ${formatDate(renewing.next.renewalDate)}`
                  : undefined
              }
              tone={renewing.list.length > 0 ? 'warning' : 'neutral'}
              reduced={reduced}
              onOpen={() => onOpenRibbon('contracts')}
            />
          </motion.div>
        )}

        {closing.soon.length > 0 && (
          <motion.div variants={staggerItem(reduced)}>
            <SummaryCard
              icon={<Currency size="small" color="var(--saip-accent)" />}
              label="Opportunities closing"
              value={String(closing.soon.length)}
              unit={`in ${CLOSING_SOON_DAYS} days`}
              detail={`${formatCurrencyCompact(closing.value, closing.currency)} of pipeline`}
              tone="neutral"
              reduced={reduced}
              onOpen={() => onOpenRibbon('opportunities')}
            />
          </motion.div>
        )}

        {activeIncentives.length > 0 && (
          <motion.div variants={staggerItem(reduced)}>
            <SummaryCard
              icon={<Achievement size="small" color="var(--saip-accent)" />}
              label="Active incentives"
              value={String(activeIncentives.length)}
              unit={activeIncentives.length === 1 ? 'campaign' : 'campaigns'}
              detail={activeIncentives.map((i) => i.title).join(' · ')}
              tone="neutral"
              reduced={reduced}
              onOpen={() => onOpenRibbon('incentives')}
            />
          </motion.div>
        )}

        {accountNotifications.length > 0 && (
          <motion.div variants={staggerItem(reduced)}>
            <SummaryCard
              icon={<Alert size="small" color="var(--hpe-color-foreground-warning)" />}
              label="Monitoring questions"
              value={String(accountNotifications.length)}
              unit="outstanding"
              detail="Dates that have gone stale or were never recorded"
              tone="warning"
              reduced={reduced}
              onOpen={() => onOpenRibbon('monitoring')}
            />
          </motion.div>
        )}
      </motion.div>

      {/* ── The questions themselves ────────────────────────────────────────
          A count tells you there is work; this tells you what it is. Each row
          deep-links to the exact field, the same route the notification pane
          uses, so the rep lands on the control with it highlighted. */}
      {accountNotifications.length > 0 && (
        <Box gap="xsmall">
          <Text as="h3" size="medium" weight={600} color="text-strong" margin="none">
            Questions to answer
          </Text>
          <Box
            round="medium"
            background="background-front"
            border={{ color: 'border-weak' }}
            style={{ overflow: 'hidden' }}
          >
            {accountNotifications.map((n, i) => (
              <NotificationRow
                key={n.id}
                notification={n}
                first={i === 0}
                reduced={reduced}
                onOpen={() =>
                  navigate(
                    `/account/${accountId}?ribbon=${n.target.ribbon}&field=${n.target.fieldId}&n=${Date.now()}`,
                  )
                }
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * One headline figure, and the tab it belongs to.
 *
 * `tone` colours the left rail only — warning where something is genuinely
 * time-bound, neutral otherwise. The icons follow `--saip-accent` because they
 * are decoration; the warning rail does not, because it means something.
 */
function SummaryCard({
  icon,
  label,
  value,
  unit,
  detail,
  tone,
  reduced,
  onOpen,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tone: 'neutral' | 'warning';
  reduced: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        font: 'inherit',
        textAlign: 'left',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        border: '1px solid var(--hpe-color-border-weak)',
        borderRadius: 'var(--hpe-radius-medium)',
        background: 'var(--hpe-color-background-front)',
        padding: 'var(--hpe-spacing-small)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left rail. Semantic where it matters, accent where it does not. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background:
            tone === 'warning'
              ? 'var(--hpe-color-foreground-warning)'
              : 'var(--saip-accent)',
        }}
      />

      <Box gap="xxsmall" style={{ paddingLeft: 6, minWidth: 0 }}>
        <Box direction="row" align="center" justify="between" gap="xsmall">
          <Box direction="row" align="center" gap="xsmall" style={{ minWidth: 0 }}>
            {icon}
            <Text size="xsmall" color="text-weak" style={{ whiteSpace: 'nowrap' }}>
              {label}
            </Text>
          </Box>
          <FormNextLink size="small" color="var(--saip-accent)" />
        </Box>

        <Box direction="row" align="baseline" gap="xxsmall" wrap>
          <Text size="xxlarge" weight={600} color="text-strong">
            {value}
          </Text>
          {unit && (
            <Text size="small" color="text-weak">
              {unit}
            </Text>
          )}
        </Box>

        {detail && (
          <Text
            size="xsmall"
            color="text-weak"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {detail}
          </Text>
        )}
      </Box>
    </motion.button>
  );
}

function NotificationRow({
  notification,
  first,
  reduced,
  onOpen,
}: {
  notification: AppNotification;
  first: boolean;
  reduced: boolean;
  onOpen: () => void;
}) {
  const severityColor =
    notification.severity === 'critical'
      ? 'var(--hpe-color-foreground-critical)'
      : notification.severity === 'warning'
        ? 'var(--hpe-color-foreground-warning)'
        : 'var(--hpe-color-foreground-info)';

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={
        reduced ? undefined : { backgroundColor: 'var(--hpe-color-background-hover)' }
      }
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        font: 'inherit',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        border: 'none',
        borderTop: first ? 'none' : '1px solid var(--hpe-color-border-weak)',
        background: 'transparent',
        padding: 'var(--hpe-spacing-small)',
      }}
    >
      <Box direction="row" align="center" gap="small" style={{ minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: severityColor,
            flex: '0 0 auto',
          }}
        />
        <Box gap="1px" style={{ minWidth: 0, flex: '1 1 auto' }}>
          <Text size="small" weight={600} color="text-strong">
            {notification.title}
          </Text>
          <Text size="xsmall" color="text-weak">
            {notification.detail}
          </Text>
        </Box>
        <FormNextLink size="small" color="var(--saip-accent)" />
      </Box>
    </motion.button>
  );
}
