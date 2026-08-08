import { useEffect, useState } from 'react';
import { Box, Text } from 'grommet';
import { LinkPrevious } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAccountService } from '@/services';
import { formatCurrency } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { useMeetingLog } from '@/components/meetings/MeetingLogProvider';
import { ValueOverviewRibbon } from '@/components/focus/ValueOverviewRibbon';
import { ActiveContractsRibbon } from '@/components/focus/ActiveContractsRibbon';
import { AccountOpportunitiesRibbon } from '@/components/focus/AccountOpportunitiesRibbon';
import { AccountMonitoringRibbon } from '@/components/focus/AccountMonitoringRibbon';
import { MeetingHistory } from '@/components/meetings/MeetingHistory';
import { AccountIncentivesRibbon } from '@/components/focus/AccountIncentivesRibbon';
import { ScoresOverview } from '@/components/scores/ScoresOverview';
import { SkeletonBar } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { LogMeetingButton } from '@/components/common/LogMeetingButton';
import { directionalPanel, fadeRise, revealOnMount } from '@/motion/variants';
import { duration, easing, glow } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

type RibbonKey =
  | 'value'
  | 'contracts'
  | 'opportunities'
  | 'monitoring'
  | 'meetings'
  | 'incentives';

const RIBBONS: { key: RibbonKey; label: string; heading: string }[] = [
  { key: 'value', label: 'Value Overview', heading: 'Value Overview' },
  { key: 'contracts', label: 'Active Service Contracts', heading: 'Active Service Contracts' },
  /*
    Opportunities sits next to contracts on purpose: contracts are the revenue
    already signed and opportunities the revenue still in play, and reps read
    them together. It comes from the CRM export rather than from SAIP's own
    tables — matched to the account on its company group id.
  */
  { key: 'opportunities', label: 'Opportunities', heading: 'Opportunities' },
  { key: 'monitoring', label: 'Account Monitoring', heading: 'Account Monitoring' },
  // See MeetingHistory for why this one is here — it is not a brief ribbon.
  { key: 'meetings', label: 'Recent Meetings', heading: 'Recent Meetings' },
  // Campaigns targeting this account. Not a brief ribbon either, but the rep
  // opens this page to ask "what is going on with this customer" and a live
  // incentive is part of that answer — it otherwise lived only in Business
  // Development, which an account manager has little reason to visit.
  { key: 'incentives', label: 'Incentives', heading: 'Incentives' },
];

/**
 * Account Focus (brief §7.3).
 *
 * The three ribbons are presented as tabs on a single page — all reachable
 * without navigating away, as the brief requires. Tabs were chosen over
 * stacked sections because Account Monitoring is a long form; stacking it under
 * two data ribbons would bury the thing the rep is most often here to edit.
 *
 * "Log a meeting" here passes the account id, so the modal shows it locked.
 */
export function AccountFocusPage() {
  const { accountId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { openMeetingLog, savedCount } = useMeetingLog();

  // Deep link from the notification pane:
  // ?ribbon=monitoring&field=mon-workshop&n=<nonce>
  const requestedRibbon = searchParams.get('ribbon') as RibbonKey | null;
  const requestedField = searchParams.get('field');
  // The nonce changes on every notification click, so re-selecting the SAME
  // notification re-runs this effect instead of being a silent no-op.
  const requestNonce = searchParams.get('n');

  const [active, setActive] = useState<RibbonKey>(
    requestedRibbon && RIBBONS.some((r) => r.key === requestedRibbon)
      ? requestedRibbon
      : 'value',
  );

  // A repeat click may also need to switch back to the target ribbon if the
  // rep has since moved to another tab.
  useEffect(() => {
    if (requestedRibbon && RIBBONS.some((r) => r.key === requestedRibbon)) {
      setActive(requestedRibbon);
    }
  }, [requestedRibbon, requestNonce]);

  /**
   * Scroll the deep-linked field into view and flag it once the ribbon has
   * rendered. Landing the rep on the right page but leaving them to find the
   * row themselves would waste most of the value of the notification.
   *
   * The highlight persists until the rep hovers the field — it marks "this is
   * the thing you came here for", so it should wait to be acknowledged rather
   * than time out while they're still reading. On hover it fades out quickly
   * and gets out of the way.
   */
  useEffect(() => {
    if (!requestedField || active !== requestedRibbon) return;

    let field: Element | null = null;
    let cleanupHover: (() => void) | undefined;

    // The ribbon loads asynchronously; poll briefly for the field to appear.
    let attempts = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById(requestedField);
      attempts += 1;
      if (el) {
        window.clearInterval(timer);
        el.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth',
          block: 'center',
        });

        field = el.closest('.saip-field') ?? el;
        // Clear any highlight left over from a previous click.
        document
          .querySelectorAll('.saip-field-flagged, .saip-field-unflagging')
          .forEach((n) => n.classList.remove('saip-field-flagged', 'saip-field-unflagging'));
        field.classList.add('saip-field-flagged');

        const dismiss = () => {
          if (!field) return;
          field.classList.add('saip-field-unflagging');
          window.setTimeout(() => {
            field?.classList.remove('saip-field-flagged', 'saip-field-unflagging');
          }, 260);
        };
        field.addEventListener('mouseenter', dismiss, { once: true });
        cleanupHover = () => field?.removeEventListener('mouseenter', dismiss);
      } else if (attempts > 40) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => {
      window.clearInterval(timer);
      cleanupHover?.();
      field?.classList.remove('saip-field-flagged', 'saip-field-unflagging');
    };
  }, [requestedField, requestedRibbon, requestNonce, active, reduced, accountId]);
  /**
   * Direction of the last tab change: +1 forward, -1 back. Panels enter from
   * the side you came from, so switching ribbons has a sense of place rather
   * than every panel arriving identically.
   */
  const [direction, setDirection] = useState(1);

  function selectRibbon(key: RibbonKey) {
    const from = RIBBONS.findIndex((r) => r.key === active);
    const to = RIBBONS.findIndex((r) => r.key === key);
    setDirection(to >= from ? 1 : -1);
    setActive(key);
  }

  const { data: account, loading } = useAsync(
    () => service.getAccount(accountId),
    [accountId, service],
  );

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="medium">
      <motion.div variants={fadeRise(reduced)} initial="hidden" animate="visible">
        <Box gap="small">
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              width: 'fit-content',
            }}
          >
            <LinkPrevious size="small" color="icon-primary" />
            <Text size="small" color="text-primary">
              All accounts
            </Text>
          </Link>

          <Box direction="row" align="start" justify="between" gap="medium" wrap>
            <Box gap="xxsmall">
              {loading ? (
                <SkeletonBar height="34px" width="320px" />
              ) : (
                <Box direction="row" align="center" gap="small" wrap>
                  <Text
                    as="h1"
                    size="xxlarge"
                    weight={600}
                    color="text-strong"
                    margin="none"
                  >
                    {/* PLACEHOLDER DATA — fictional account name. */}
                    {account?.accountName ?? 'Unknown account'}
                  </Text>
                  <SampleDataBadge />
                </Box>
              )}

              {account && (
                <Text color="text-weak">
                  {account.industry} · {account.region} ·{' '}
                  {formatCurrency(account.annualServicesRevenue, account.currency)} annual
                  services revenue
                </Text>
              )}
            </Box>

            {/* Account id passed → modal locks the account. */}
            <LogMeetingButton
              onClick={() => openMeetingLog(accountId)}
              disabled={!accountId}
            />
          </Box>
        </Box>
      </motion.div>

      {/* Account-level scores, above the ribbons. */}
      <motion.div {...revealOnMount(reduced, 0.1)}>
        <ScoresOverview
          accountId={accountId}
          heading="Scores"
          description="Relationship and spend health for this account."
        />
      </motion.div>

      {/* ── Ribbon tabs ──────────────────────────────────────────────────── */}
      <Box gap="medium">
        <Box
          direction="row"
          gap="xsmall"
          role="tablist"
          aria-label="Account detail sections"
          border={{ side: 'bottom', color: 'border-weak' }}
          overflow={{ horizontal: 'auto' }}
          flex={false}
        >
          {RIBBONS.map((ribbon) => (
            <RibbonTab
              key={ribbon.key}
              label={ribbon.label}
              selected={active === ribbon.key}
              reduced={reduced}
              onSelect={() => selectRibbon(ribbon.key)}
              controls={`panel-${ribbon.key}`}
              id={`tab-${ribbon.key}`}
            />
          ))}
        </Box>

        {/* Panels cross-fade; `mode="wait"` stops the outgoing and incoming
            ribbons from overlapping mid-transition. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            id={`panel-${active}`}
            role="tabpanel"
            aria-labelledby={`tab-${active}`}
            tabIndex={0}
            variants={directionalPanel(reduced, direction)}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ outline: 'none' }}
          >
            <Box gap="small">
              <Text as="h2" size="large" weight={600} color="text-strong" margin="none">
                {RIBBONS.find((r) => r.key === active)?.heading}
              </Text>

              {active === 'value' && <ValueOverviewRibbon accountId={accountId} />}
              {active === 'contracts' && <ActiveContractsRibbon accountId={accountId} />}
              {active === 'opportunities' && (
                <AccountOpportunitiesRibbon accountId={accountId} />
              )}
              {active === 'monitoring' && (
                <AccountMonitoringRibbon accountId={accountId} />
              )}
              {active === 'meetings' && (
                <MeetingHistory accountId={accountId} refreshKey={savedCount} />
              )}
              {active === 'incentives' && (
                <AccountIncentivesRibbon accountId={accountId} />
              )}
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Keeps the Copilot launcher clear of page content. */}
      <Box height="48px" flex={false} />
    </Box>
  );
}

/**
 * A single ribbon tab.
 *
 * Real `role="tab"` semantics with `aria-selected` and `aria-controls`, and a
 * shared `layoutId` underline so switching ribbons slides the indicator rather
 * than snapping it.
 */
function RibbonTab({
  label,
  selected,
  reduced,
  onSelect,
  controls,
  id,
}: {
  label: string;
  selected: boolean;
  reduced: boolean;
  onSelect: () => void;
  controls: string;
  id: string;
}) {
  return (
    <motion.button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={controls}
      onClick={onSelect}
      whileHover={reduced ? undefined : { y: -1 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        position: 'relative',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        font: 'inherit',
        padding: '10px 14px',
        whiteSpace: 'nowrap',
        color: selected
          ? 'var(--hpe-color-text-strong)'
          : 'var(--hpe-color-text-weak)',
        fontWeight: selected ? 600 : 400,
      }}
    >
      {label}
      {selected && (
        <motion.div
          layoutId="saip-ribbon-underline"
          transition={
            reduced ? { duration: 0 } : { duration: duration.standard, ease: easing.inOut }
          }
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: -1,
            height: 2,
            borderRadius: 2,
            background: 'var(--saip-accent)',
            boxShadow: glow.primary,
          }}
        />
      )}
    </motion.button>
  );
}
