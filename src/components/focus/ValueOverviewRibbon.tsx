import type { ReactNode } from 'react';
import { Box, Text, Tip } from 'grommet';
import { motion } from 'framer-motion';
import {
  IS_USING_PLACEHOLDER_DATA,
  SLA_TIER_COLORS,
  useAccountService,
  type ValueOverview,
} from '@/services';
import { formatCurrency, formatCurrencyCompact, formatDate, formatRelative } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { useCountUp } from '@/hooks/useCountUp';
import { staggerContainer, staggerItem, sweep } from '@/motion/variants';
import { duration, easing, stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonBar } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { SlaChip } from '@/components/common/ColorChip';

/**
 * Ribbon A — Value Overview (brief §7.3).
 *
 * Four metrics: SLA spend %, last upsell, previous 48-month hardware spend,
 * predicted next 12-month hardware spend.
 *
 * Motion: figures count up and the SLA bar fills on load; hovering (or
 * focusing) a tile shows a tooltip with the exact figure and the time period
 * it covers — the compact display values like "£18.4M" are deliberately
 * rounded, so the tooltip is where the precise number lives.
 */
export function ValueOverviewRibbon({ accountId }: { accountId: string }) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { data, loading, error } = useAsync(
    () => service.getValueOverview(accountId),
    [accountId, service],
  );

  if (loading) {
    return (
      <Box direction="row" gap="small" wrap aria-busy="true" aria-label="Loading value overview">
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            pad="medium"
            round="medium"
            background="background-front"
            border={{ color: 'border-weak' }}
            gap="small"
            style={{ flex: '1 1 220px', minWidth: 220 }}
          >
            <SkeletonBar height="14px" width="70%" />
            <SkeletonBar height="30px" width="50%" />
            <SkeletonBar height="12px" width="60%" />
          </Box>
        ))}
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box pad="medium" round="medium" background="background-critical" role="alert">
        <Text size="small" color="text-strong">
          Couldn’t load the value overview. {error?.message}
        </Text>
      </Box>
    );
  }

  return (
    <motion.div
      variants={staggerContainer(reduced, stagger.card)}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hpe-spacing-small)' }}
    >
      <SlaSpendTile data={data} reduced={reduced} />

      <MetricTile
        sweepDelay={0.08}
        label="Last purchased an upsell"
        display={formatRelative(data.lastUpsellDate)}
        caption={
          data.lastUpsellDescription
            ? `${formatDate(data.lastUpsellDate)} · ${data.lastUpsellDescription}`
            : 'No upsell recorded'
        }
        tip={
          data.lastUpsellDate
            ? `Last purchase under the “Expand” motion: ${formatDate(data.lastUpsellDate)}. ${data.lastUpsellDescription ?? ''}`
            : 'No purchase has been recorded under the “Expand” motion for this account.'
        }
        reduced={reduced}
      />

      <CountUpTile
        sweepDelay={0.16}
        label="Previous 48-month hardware spend"
        value={data.previous48MonthHardwareSpend}
        currency={data.currency}
        caption="Rolling 48 months to today"
        tip={`${formatCurrency(data.previous48MonthHardwareSpend, data.currency)} of hardware across the trailing 48 months.`}
        reduced={reduced}
      />

      <CountUpTile
        sweepDelay={0.24}
        label="Predicted next 12-month hardware spend"
        value={data.predictedNext12MonthHardwareSpend}
        currency={data.currency}
        caption={`Modelled · ${data.predictionConfidence}% confidence`}
        tip={`Modelled hardware spend for the next 12 months: ${formatCurrency(data.predictedNext12MonthHardwareSpend, data.currency)}. Model confidence ${data.predictionConfidence}%. This is a prediction, not committed spend.`}
        reduced={reduced}
      />
    </motion.div>
  );
}

/**
 * SLA spend, split by tier.
 *
 * Shows the split only. The old headline — "SLA spend as X% of £Y across all
 * active contracts" — was removed at the client's request: with every contract
 * now carrying an SLA, that percentage was close to meaningless, and the useful
 * question is which tiers the money sits in.
 *
 * The unit changes with the account's coverage model, which is the point of the
 * distinction: a customer-level account is counted BY CONTRACT (one contract
 * can cover many sites), a per-location account BY SITE (the customer buys a
 * contract per location). The heading states which is in force so the numbers
 * can't be misread.
 *
 * ASSUMPTION — see README. Confirm the coverage-model rule with the account
 * team before release.
 */
function SlaSpendTile({ data, reduced }: { data: ValueOverview; reduced: boolean }) {
  const byLocation = data.slaCoverageModel === 'location';

  return (
    <TileShell
      reduced={reduced}
      tip={`SLA spend split across ${data.slaBreakdown.length} service tier${
        data.slaBreakdown.length === 1 ? '' : 's'
      }, totalling ${formatCurrency(data.totalContractedSpend, data.currency)}. This account is ${
        byLocation ? 'contracted per location' : 'contracted at customer level'
      }.`}
    >
      <Box gap="2px">
        <Text size="small" color="text-weak">
          SLA spend by type
        </Text>
        <Text size="xsmall" color="text-weak">
          {byLocation ? 'Contracted per location' : 'Contracted at customer level'}
        </Text>
      </Box>

      <motion.div
        variants={staggerContainer(reduced, stagger.tight)}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}
      >
        {data.slaBreakdown.map((slice) => (
          <motion.div key={slice.sla} variants={staggerItem(reduced)}>
            <Box gap="2px">
              <Box direction="row" align="center" justify="between" gap="xsmall">
                <SlaChip sla={slice.sla} />
                <Text
                  size="xsmall"
                  color="text-default"
                  style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                >
                  {formatCurrencyCompact(slice.value, data.currency)} ·{' '}
                  {Math.round(slice.percent)}%
                </Text>
              </Box>

              <Box
                height="4px"
                round="full"
                background="background-contrast"
                overflow="hidden"
                flex={false}
                aria-hidden
              >
                <motion.div
                  initial={{ width: reduced ? `${slice.percent}%` : '0%' }}
                  animate={{ width: `${slice.percent}%` }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: duration.entrance * 1.8, ease: easing.out }
                  }
                  style={{
                    height: '100%',
                    borderRadius: 'var(--hpe-radius-full)',
                    background: SLA_TIER_COLORS[slice.sla].border,
                  }}
                />
              </Box>

              <Text size="xsmall" color="text-weak">
                {slice.count} {byLocation ? 'location' : 'contract'}
                {slice.count === 1 ? '' : 's'}
              </Text>
            </Box>
          </motion.div>
        ))}
      </motion.div>
    </TileShell>
  );
}

/** A currency metric that counts up from zero. */
function CountUpTile({
  label,
  value,
  currency,
  caption,
  tip,
  reduced,
  sweepDelay,
}: {
  label: string;
  value: number;
  currency: string;
  caption: string;
  tip: string;
  reduced: boolean;
  sweepDelay?: number;
}) {
  const animated = useCountUp(value);

  return (
    <TileShell reduced={reduced} tip={tip} sweepDelay={sweepDelay}>
      <Text size="small" color="text-weak">
        {label}
      </Text>
      <Text size="xxlarge" weight={600} color="text-strong">
        {formatCurrencyCompact(animated, currency)}
      </Text>
      <Text size="xsmall" color="text-weak">
        {caption}
      </Text>
    </TileShell>
  );
}

/** A metric whose value is text rather than a number. */
function MetricTile({
  label,
  display,
  caption,
  tip,
  reduced,
  sweepDelay,
}: {
  label: string;
  display: string;
  caption: string;
  tip: string;
  reduced: boolean;
  sweepDelay?: number;
}) {
  return (
    <TileShell reduced={reduced} tip={tip} sweepDelay={sweepDelay}>
      <Text size="small" color="text-weak">
        {label}
      </Text>
      <Text size="xlarge" weight={600} color="text-strong">
        {display}
      </Text>
      <Text size="xsmall" color="text-weak">
        {caption}
      </Text>
    </TileShell>
  );
}

/**
 * Shared tile chrome: stagger entrance, hover lift and the exact-figure tooltip.
 *
 * `tabIndex={0}` is deliberate — the tooltip carries information not shown on
 * the face of the tile, so keyboard users need to be able to reach it. Grommet's
 * Tip opens on focus as well as hover.
 */
function TileShell({
  children,
  tip,
  reduced,
  sweepDelay = 0,
}: {
  children: ReactNode;
  tip: string;
  reduced: boolean;
  sweepDelay?: number;
}) {
  const sweepProps = sweep(reduced, sweepDelay);

  return (
    <motion.div
      variants={staggerItem(reduced)}
      whileHover={reduced ? undefined : { y: -5, scale: 1.015 }}
      whileTap={reduced ? undefined : { scale: 0.995 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{ flex: '1 1 240px', minWidth: 240, display: 'flex' }}
    >
      <Tip
        content={
          <Box pad="small" width={{ max: '280px' }} gap="xxsmall">
            <Text size="small">{tip}</Text>
            {/* The one sample-data marker that is plain text rather than a
                <SampleDataBadge>, so it needs the flag explicitly. */}
            {IS_USING_PLACEHOLDER_DATA && (
              <Text size="xsmall" color="text-weak">
                Sample data — not a live figure
              </Text>
            )}
          </Box>
        }
      >
        <Box
          pad="medium"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak' }}
          gap="xsmall"
          fill
          tabIndex={0}
          className="saip-value-tile"
          style={{ cursor: 'default', position: 'relative', overflow: 'hidden' }}
        >
          {/* Light sweep as the tile arrives, then never again. */}
          {sweepProps && (
            <motion.span
              {...sweepProps}
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '55%',
                pointerEvents: 'none',
                background:
                  'linear-gradient(100deg, transparent, var(--hpe-color-background-contrast), transparent)',
                opacity: 0.6,
              }}
            />
          )}
          <Box direction="row" justify="end">
            {/* PLACEHOLDER DATA — every figure in this ribbon is invented. */}
            <SampleDataBadge />
          </Box>
          {children}
        </Box>
      </Tip>
    </motion.div>
  );
}
