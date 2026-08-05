import type { ReactNode } from 'react';
import { Box, Text, Tip } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService, type ValueOverview } from '@/services';
import { formatCurrency, formatCurrencyCompact, formatDate, formatRelative } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { useCountUp } from '@/hooks/useCountUp';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { duration, easing, stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonBar } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

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
        label="Previous 48-month hardware spend"
        value={data.previous48MonthHardwareSpend}
        currency={data.currency}
        caption="Rolling 48 months to today"
        tip={`${formatCurrency(data.previous48MonthHardwareSpend, data.currency)} of hardware across the trailing 48 months.`}
        reduced={reduced}
      />

      <CountUpTile
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

/** SLA spend as a percentage of total contracted spend, with a filling bar. */
function SlaSpendTile({ data, reduced }: { data: ValueOverview; reduced: boolean }) {
  const pct = useCountUp(data.slaSpendPercent);

  return (
    <TileShell
      reduced={reduced}
      tip={`SLA spend is ${data.slaSpendPercent}% of ${formatCurrency(data.totalContractedSpend, data.currency)} total contracted spend across all active contracts.`}
    >
      <Text size="small" color="text-weak">
        SLA spend
      </Text>
      <Box direction="row" align="baseline" gap="xxsmall">
        <Text size="xxlarge" weight={600} color="text-strong">
          {Math.round(pct)}
        </Text>
        <Text size="large" weight={600} color="text-weak">
          %
        </Text>
      </Box>

      {/* Bar fills from zero on entrance. */}
      <Box
        height="8px"
        round="full"
        background="background-contrast"
        overflow="hidden"
        flex={false}
        aria-hidden
      >
        <motion.div
          initial={{ width: reduced ? `${data.slaSpendPercent}%` : '0%' }}
          animate={{ width: `${data.slaSpendPercent}%` }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: duration.entrance * 2.2, ease: easing.out }
          }
          style={{
            height: '100%',
            borderRadius: 'var(--hpe-radius-full)',
            background: 'var(--hpe-color-foreground-primary)',
          }}
        />
      </Box>

      <Text size="xsmall" color="text-weak">
        of {formatCurrencyCompact(data.totalContractedSpend, data.currency)} across all
        active contracts
      </Text>
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
}: {
  label: string;
  value: number;
  currency: string;
  caption: string;
  tip: string;
  reduced: boolean;
}) {
  const animated = useCountUp(value);

  return (
    <TileShell reduced={reduced} tip={tip}>
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
}: {
  label: string;
  display: string;
  caption: string;
  tip: string;
  reduced: boolean;
}) {
  return (
    <TileShell reduced={reduced} tip={tip}>
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
}: {
  children: ReactNode;
  tip: string;
  reduced: boolean;
}) {
  return (
    <motion.div
      variants={staggerItem(reduced)}
      whileHover={reduced ? undefined : { y: -3 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}
    >
      <Tip
        content={
          <Box pad="small" width={{ max: '280px' }} gap="xxsmall">
            <Text size="small">{tip}</Text>
            <Text size="xsmall" color="text-weak">
              Sample data — not a live figure
            </Text>
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
          style={{ cursor: 'default' }}
        >
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
