import { useMemo, useState } from 'react';
import { Box, Text } from 'grommet';
import { AnimatePresence, motion } from 'framer-motion';
import { FormDown } from 'grommet-icons';
import {
  OPEN_OPPORTUNITY_STAGES,
  useAccountService,
  type AccountOpportunity,
} from '@/services';
import { daysUntil, formatCurrency, formatCurrencyCompact, formatDate } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { OpportunityStageChip } from '@/components/common/ColorChip';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { SkeletonRows } from '@/components/common/Skeleton';
import { duration, easing, spring, stagger } from '@/motion/tokens';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Ribbon — Opportunities for this account.
 *
 * The account page answers "what is going on with this customer". Open pipeline
 * is half of that answer, and it previously lived only under a campaign code on
 * Business Development, where an account manager had no reason to look.
 *
 * THE GRAIN IS THE DESIGN PROBLEM. The source is a Salesforce export at product
 * line-item level, so one opportunity is many rows. Showing those rows raw is
 * unreadable — a rep sees "Northwind, ProLiant" six times and cannot tell it is
 * one deal. So each opportunity is one row here and its product lines expand
 * underneath, which is also the shape `saip.vw_account_opportunity` returns.
 *
 * TWO VALUES, DELIBERATELY BOTH SHOWN. `totalValue` is the CRM's header figure;
 * the product lines are what is itemised against it. They do not reconcile in
 * the source — the header includes elements with no line behind them — so the
 * expanded view labels the line subtotal rather than presenting either as "the"
 * value. Silently showing one would make the other look like a bug.
 */
export function AccountOpportunitiesRibbon({ accountId }: { accountId: string }) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { data, loading, error } = useAsync(
    () => service.getAccountOpportunities(accountId),
    [accountId, service],
  );

  /** Open / Closed / All. Open first, because that is the working view. */
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');

  const { open, closed } = useMemo(() => {
    const rows = data ?? [];
    return {
      open: rows.filter((o) => OPEN_OPPORTUNITY_STAGES.includes(o.stage)),
      closed: rows.filter((o) => !OPEN_OPPORTUNITY_STAGES.includes(o.stage)),
    };
  }, [data]);

  const shown = filter === 'open' ? open : filter === 'closed' ? closed : (data ?? []);

  if (loading) {
    return <SkeletonRows rows={3} height="76px" label="Loading opportunities" />;
  }

  if (error) {
    return (
      <Box pad="medium" round="medium" background="background-critical" role="alert">
        <Text size="small" color="text-strong">
          Couldn’t load opportunities. {error.message}
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
        gap="xxsmall"
      >
        <Text size="small" color="text-weak">
          No opportunities recorded against this account.
        </Text>
        <Text size="xsmall" color="text-weak" textAlign="center">
          Opportunities come from the CRM and are matched to the account on its
          company group id.
        </Text>
      </Box>
    );
  }

  const openPipeline = open.reduce((sum, o) => sum + o.totalValue, 0);
  const wonValue = closed
    .filter((o) => o.stage === 'Closed won')
    .reduce((sum, o) => sum + o.totalValue, 0);
  const currency = data[0].currency;

  return (
    <Box gap="small">
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Text size="small" color="text-weak">
          {open.length} open · {formatCurrency(openPipeline, currency)} pipeline
          {wonValue > 0 && (
            <>
              {' · '}
              <Text size="small" color="text-ok" weight={600}>
                {formatCurrency(wonValue, currency)} won
              </Text>
            </>
          )}
        </Text>
        {/* PLACEHOLDER DATA — every opportunity, product and figure is invented. */}
        <SampleDataBadge />
      </Box>

      {/* ── Filter ──────────────────────────────────────────────────────── */}
      <Box direction="row" gap="xxsmall" wrap flex={false}>
        {(
          [
            ['open', `Open (${open.length})`],
            ['closed', `Closed (${closed.length})`],
            ['all', `All (${data.length})`],
          ] as const
        ).map(([key, label]) => (
          <FilterButton
            key={key}
            label={label}
            selected={filter === key}
            reduced={reduced}
            onSelect={() => setFilter(key)}
          />
        ))}
      </Box>

      {shown.length === 0 ? (
        <Box
          pad="large"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak' }}
          align="center"
        >
          <Text size="small" color="text-weak">
            {filter === 'open'
              ? 'No open opportunities. Everything here has closed.'
              : 'Nothing closed yet for this account.'}
          </Text>
        </Box>
      ) : (
        <motion.div
          variants={staggerContainer(reduced, stagger.card)}
          initial="hidden"
          animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--hpe-spacing-xsmall)' }}
        >
          {shown.map((opportunity) => (
            <motion.div key={opportunity.opportunityId} variants={staggerItem(reduced)}>
              <OpportunityRow opportunity={opportunity} reduced={reduced} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </Box>
  );
}

/** Segmented filter control. Matches the Business Development active/historical pair. */
function FilterButton({
  label,
  selected,
  reduced,
  onSelect,
}: {
  label: string;
  selected: boolean;
  reduced: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        font: 'inherit',
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: 'pointer',
        padding: '5px 12px',
        borderRadius: 'var(--hpe-radius-small)',
        border: `1px solid ${
          selected ? 'transparent' : 'var(--hpe-color-border-weak)'
        }`,
        background: selected ? 'var(--saip-accent-solid)' : 'transparent',
        color: selected ? 'var(--saip-on-solid)' : 'var(--hpe-color-text-default)',
      }}
    >
      {label}
    </motion.button>
  );
}

/**
 * One opportunity, expandable to its product lines.
 *
 * Collapsed by default: the account page already carries four other ribbons,
 * and a rep scanning for "what is closing soon" wants the headline, not a
 * product breakdown for every deal at once.
 */
function OpportunityRow({
  opportunity,
  reduced,
}: {
  opportunity: AccountOpportunity;
  reduced: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = OPEN_OPPORTUNITY_STAGES.includes(opportunity.stage);
  const days = daysUntil(opportunity.closeDate);

  /*
    An open opportunity whose close date has passed is the thing worth flagging
    on this page — it means the forecast is stale, not that the deal is lost.
    A closed one being in the past is simply how closed deals work, so it gets
    no emphasis at all.
  */
  const slipped = isOpen && days < 0;
  const imminent = isOpen && days >= 0 && days <= 30;

  const lineSubtotal = opportunity.lines.reduce((sum, l) => sum + l.value, 0);
  const panelId = `opportunity-lines-${opportunity.opportunityId}`;

  return (
    <Box round="medium" background="background-front" border={{ color: 'border-weak' }}>
      <motion.button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        whileHover={reduced ? undefined : { backgroundColor: 'var(--hpe-color-background-hover)' }}
        transition={{ duration: duration.fast, ease: easing.out }}
        style={{
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          borderRadius: 'var(--hpe-radius-medium)',
          padding: 'var(--hpe-spacing-small)',
          width: '100%',
        }}
      >
        <Box direction="row" align="start" justify="between" gap="small" wrap>
          <Box gap="xxsmall" style={{ minWidth: 0, flex: '1 1 320px' }}>
            <Box direction="row" align="center" gap="xsmall" wrap>
              <Text size="medium" weight={600} color="text-strong">
                {opportunity.name}
              </Text>
              <OpportunityStageChip stage={opportunity.stage} />
            </Box>

            <Text size="xsmall" color="text-weak">
              {/* The number people quote to each other, so it stays visible
                  rather than hiding inside the expanded panel. */}
              {opportunity.opportunityNumber} · {opportunity.ownerName}
              {opportunity.campaignName && <> · {opportunity.campaignName}</>}
            </Text>
          </Box>

          <Box
            direction="row"
            align="center"
            gap="small"
            flex={false}
            style={{ marginLeft: 'auto' }}
          >
            <Box align="end" gap="1px">
              <Text size="medium" weight={600} color="text-strong">
                {formatCurrencyCompact(opportunity.totalValue, opportunity.currency)}
              </Text>
              <Text
                size="xsmall"
                color={slipped ? 'text-warning' : imminent ? 'text-strong' : 'text-weak'}
                weight={slipped || imminent ? 600 : 400}
              >
                {slipped
                  ? `Close date passed — ${formatDate(opportunity.closeDate)}`
                  : imminent
                    ? `Closes in ${days} day${days === 1 ? '' : 's'}`
                    : formatDate(opportunity.closeDate)}
              </Text>
            </Box>

            <motion.span
              animate={reduced ? undefined : { rotate: expanded ? 180 : 0 }}
              transition={spring.snappy}
              style={{ display: 'flex', flex: '0 0 auto' }}
              aria-hidden
            >
              <FormDown color="var(--hpe-color-icon-default)" />
            </motion.span>
          </Box>
        </Box>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            key="lines"
            initial={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { height: 0, opacity: 0, transition: { duration: duration.exit } }
            }
            transition={{ duration: duration.standard, ease: easing.out }}
            style={{ overflow: 'hidden' }}
          >
            <Box
              pad={{ horizontal: 'small', bottom: 'small' }}
              gap="small"
              border={{ side: 'top', color: 'border-weak' }}
            >
              <Box pad={{ top: 'small' }} gap="xxsmall">
                <Text size="small" color="text-default">
                  {opportunity.description}
                </Text>
                <Text size="xsmall" color="text-weak">
                  {opportunity.salesMotion} · Forecast: {opportunity.forecastCategory} ·
                  Company group {opportunity.companyGroupId}
                </Text>
              </Box>

              <Box overflow={{ horizontal: 'auto' }}>
                <table
                  style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}
                >
                  <caption className="saip-visually-hidden">
                    Product lines on opportunity {opportunity.opportunityNumber}. All
                    figures are sample data.
                  </caption>
                  <thead>
                    <tr>
                      <LineHeader>Product</LineHeader>
                      <LineHeader>Category</LineHeader>
                      <LineHeader align="right">Line value</LineHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunity.lines.map((l) => (
                      <tr key={l.lineId}>
                        <LineCell>{l.productName}</LineCell>
                        <LineCell muted>{l.productCategory}</LineCell>
                        <LineCell align="right">
                          {formatCurrency(l.value, l.currency)}
                        </LineCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>

              {/*
                Labelled as the LINE subtotal, not as the opportunity's value.
                It does not equal `totalValue`, and saying which is which here
                is what stops the difference reading as an error.
              */}
              <Box direction="row" justify="between" gap="small" wrap>
                <Text size="xsmall" color="text-weak">
                  {opportunity.lines.length} product line
                  {opportunity.lines.length === 1 ? '' : 's'} · subtotal{' '}
                  {formatCurrency(lineSubtotal, opportunity.currency)}
                </Text>
                <Text size="xsmall" color="text-weak">
                  Total value to HPE{' '}
                  {formatCurrency(opportunity.totalValue, opportunity.currency)}
                </Text>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

function LineHeader({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: '6px 8px',
        borderBottom: '1px solid var(--hpe-color-border-weak)',
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--hpe-color-text-weak)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function LineCell({
  children,
  align = 'left',
  muted,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  muted?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: '6px 8px',
        fontSize: '0.8125rem',
        color: muted ? 'var(--hpe-color-text-weak)' : 'var(--hpe-color-text-default)',
        borderBottom: '1px solid var(--hpe-color-border-weak)',
      }}
    >
      {children}
    </td>
  );
}
