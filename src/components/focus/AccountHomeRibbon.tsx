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

/** How many rows each card previews. */
const PREVIEW_COUNT = 3;

/**
 * Home — the first thing anyone sees on an account.
 *
 * Every other tab answers a question you have to already have. This one answers
 * the question a rep actually arrives with: **what needs me, on this account,
 * today.**
 *
 * It stores nothing and adds no data of its own. Each card is a count, a
 * figure, and the next three things behind it — clicking one goes to the tab
 * that owns them. The summary is a router, not a report, so nothing here can
 * disagree with the detail it points at.
 *
 * WHY THREE. A bare count tells you there is work but not whether it is yours
 * to worry about — "2 contracts renewing" could be £4k or £4m. Three named rows
 * is enough to decide whether to open the tab, and few enough that the card
 * stays a summary rather than becoming a second copy of the table.
 *
 * A card with nothing to say is not rendered. An account with no incentives
 * shows no incentives card, rather than a card saying zero — a screen of zeroes
 * trains people to stop reading it.
 */
export function AccountHomeRibbon({
  accountId,
  onOpenRibbon,
}: {
  accountId: string;
  onOpenRibbon: (
    key: 'value' | 'contracts' | 'opportunities' | 'monitoring' | 'incentives',
  ) => void;
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
     Sorted by renewal date, so the preview is genuinely "next to expire"
     rather than whatever order the service happened to return. */
  const renewing = useMemo(() => {
    const soon = (contracts ?? [])
      .filter((c) => {
        const days = daysUntil(c.renewalDate);
        return days >= 0 && days <= RENEWAL_SOON_DAYS;
      })
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
    return soon;
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
      soon,
      value: soon.reduce((sum, o) => sum + o.totalValue, 0),
      currency: open[0]?.currency ?? 'GBP',
    };
  }, [opportunities]);

  /* ── Active incentives nominating this account ──────────────────────────
     Ordered by the ones ENDING SOONEST, because that is the one a rep can
     still do something about. An open-ended incentive has no deadline to
     miss, so it sorts last rather than first. */
  const activeIncentives = useMemo(
    () =>
      (incentives ?? [])
        .filter(
          (i) =>
            i.nominatedAccountIds.includes(accountId) &&
            incentiveStatus(i.endDate) === 'active',
        )
        .sort((a, b) => (a.endDate ?? '9999-12-31').localeCompare(b.endDate ?? '9999-12-31')),
    [incentives, accountId],
  );

  /* ── Monitoring questions outstanding ───────────────────────────────────
     `getNotifications` already returns most severe first, so the first three
     are the three most important. Not re-sorted here — that would put the
     definition of "important" in two places. */
  const accountNotifications = useMemo(
    () => (notifications ?? []).filter((n) => n.accountId === accountId),
    [notifications, accountId],
  );

  if (loading) {
    return <SkeletonRows rows={3} height="150px" label="Loading account summary" />;
  }

  const nothingToShow =
    renewing.length === 0 &&
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--hpe-spacing-small)',
          alignItems: 'stretch',
        }}
      >
        {renewing.length > 0 && (
          <motion.div variants={staggerItem(reduced)}>
            <SummaryCard
              icon={<DocIcon size="small" color="var(--saip-accent)" />}
              label="Contracts renewing"
              value={String(renewing.length)}
              unit={`in ${RENEWAL_SOON_DAYS} days`}
              tone="warning"
              reduced={reduced}
              onOpen={() => onOpenRibbon('contracts')}
              items={renewing.slice(0, PREVIEW_COUNT).map((c) => ({
                id: c.contractId,
                // Contracts are referred to by number, not by SLA — every
                // contract has an SLA, so it would not distinguish them.
                primary: c.contractId,
                secondary: `${formatCurrencyCompact(c.value, c.currency)} · ${formatDate(
                  c.renewalDate,
                )}`,
              }))}
              moreCount={renewing.length - PREVIEW_COUNT}
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
              footnote={`${formatCurrencyCompact(closing.value, closing.currency)} of pipeline`}
              tone="neutral"
              reduced={reduced}
              onOpen={() => onOpenRibbon('opportunities')}
              items={closing.soon.slice(0, PREVIEW_COUNT).map((o) => ({
                id: o.opportunityId,
                primary: o.name,
                secondary: `${formatCurrencyCompact(
                  o.totalValue,
                  o.currency,
                )} · ${formatDate(o.closeDate)}`,
              }))}
              moreCount={closing.soon.length - PREVIEW_COUNT}
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
              tone="neutral"
              reduced={reduced}
              onOpen={() => onOpenRibbon('incentives')}
              items={activeIncentives.slice(0, PREVIEW_COUNT).map((i) => ({
                id: i.incentiveId,
                primary: i.title,
                secondary: i.endDate ? `ends ${formatDate(i.endDate)}` : 'open-ended',
              }))}
              moreCount={activeIncentives.length - PREVIEW_COUNT}
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
              tone="warning"
              reduced={reduced}
              onOpen={() => onOpenRibbon('monitoring')}
              items={accountNotifications.slice(0, PREVIEW_COUNT).map((n) => ({
                id: n.id,
                primary: n.title,
                secondary: n.severity === 'critical' ? 'never recorded' : 'overdue',
                marker: severityColor(n.severity),
              }))}
              moreCount={accountNotifications.length - PREVIEW_COUNT}
            />
          </motion.div>
        )}
      </motion.div>

      {/* ── The questions themselves ────────────────────────────────────────
          Kept full-width and below the cards, deliberately. Everything else on
          this page is read-only and derived; this is the one thing on the
          account that only a person can do, so it gets the space rather than
          being compressed into a card. Each row deep-links to the exact field,
          the same route the notification pane uses, so the rep lands on the
          control with it highlighted. */}
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

function severityColor(severity: AppNotification['severity']): string {
  return severity === 'critical'
    ? 'var(--hpe-color-foreground-critical)'
    : severity === 'warning'
      ? 'var(--hpe-color-foreground-warning)'
      : 'var(--hpe-color-foreground-info)';
}

interface PreviewItem {
  id: string;
  primary: string;
  secondary: string;
  /** Optional dot before the row — severity, where that applies. */
  marker?: string;
}

/**
 * One headline figure, its next three items, and the tab they belong to.
 *
 * `tone` colours the left rail only — warning where something is genuinely
 * time-bound, neutral otherwise. The icons follow `--saip-accent` because they
 * are decoration; the warning rail does not, because it means something.
 *
 * The whole card is one button rather than a list of links. The preview is there
 * to help you decide whether to open the tab, not to be a navigation target of
 * its own — three separate click targets inside a card that is itself clickable
 * would be ambiguous, and the tab behind it lists the same rows properly.
 */
function SummaryCard({
  icon,
  label,
  value,
  unit,
  footnote,
  items,
  moreCount,
  tone,
  reduced,
  onOpen,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  /** One line under the number, before the preview — a total, usually. */
  footnote?: string;
  items: PreviewItem[];
  /** How many rows are not shown. Values <= 0 render nothing. */
  moreCount: number;
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
        display: 'flex',
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

      <Box gap="xxsmall" style={{ paddingLeft: 6, minWidth: 0, width: '100%' }}>
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

        {footnote && (
          <Text size="xsmall" color="text-weak">
            {footnote}
          </Text>
        )}

        {/* The preview. Separated by a rule so it reads as detail under the
            headline rather than as more headline. */}
        {items.length > 0 && (
          <Box
            gap="4px"
            margin={{ top: '4px' }}
            pad={{ top: 'xsmall' }}
            border={{ side: 'top', color: 'border-weak' }}
          >
            {items.map((item) => (
              <Box
                key={item.id}
                direction="row"
                align="center"
                gap="xsmall"
                style={{ minWidth: 0 }}
              >
                {item.marker && (
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: item.marker,
                      flex: '0 0 auto',
                    }}
                  />
                )}
                <Text
                  size="xsmall"
                  color="text-strong"
                  style={{
                    // Truncates rather than wraps: a wrapped row would make one
                    // card taller than its neighbours in the same grid track.
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: '1 1 auto',
                  }}
                  title={item.primary}
                >
                  {item.primary}
                </Text>
                <Text
                  size="xsmall"
                  color="text-weak"
                  style={{ whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  {item.secondary}
                </Text>
              </Box>
            ))}

            {moreCount > 0 && (
              <Text size="xsmall" color="text-weak">
                +{moreCount} more
              </Text>
            )}
          </Box>
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
            background: severityColor(notification.severity),
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
