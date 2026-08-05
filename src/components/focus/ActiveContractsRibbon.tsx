import { useState } from 'react';
import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService, type ServiceContract } from '@/services';
import {
  RENEWAL_SOON_DAYS,
  daysUntil,
  formatCurrency,
  formatDate,
  isExpired,
  isRenewingSoon,
} from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonRows } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { SlaChip } from '@/components/common/ColorChip';

/**
 * Ribbon B — Active Service Contracts (brief §7.3).
 *
 * One row per active contract: SLA, value, cities covered, renewal date.
 *
 * Motion: staggered row reveal, row highlight on hover, and a quiet pulse on
 * the badge of any contract renewing within 90 days. The pulse is deliberately
 * slow and opacity-only — a flag the eye catches when scanning, not something
 * that competes with reading the table.
 *
 * Rendered as a real <table> so the column relationships survive for screen
 * readers; a grid of divs would lose them.
 */
export function ActiveContractsRibbon({ accountId }: { accountId: string }) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { data, loading, error } = useAsync(
    () => service.getServiceContracts(accountId),
    [accountId, service],
  );

  if (loading) return <SkeletonRows rows={4} height="56px" label="Loading contracts" />;

  if (error) {
    return (
      <Box pad="medium" round="medium" background="background-critical" role="alert">
        <Text size="small" color="text-strong">
          Couldn’t load service contracts. {error.message}
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
      >
        <Text color="text-weak">No active service contracts for this account.</Text>
      </Box>
    );
  }

  const renewingSoon = data.filter(isRenewingSoon).length;
  const totalValue = data.reduce((sum, c) => sum + c.value, 0);

  return (
    <Box gap="small">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Text size="small" color="text-weak">
          {data.length} active contract{data.length === 1 ? '' : 's'} ·{' '}
          {formatCurrency(totalValue, data[0].currency)} total value
          {renewingSoon > 0 && (
            <>
              {' · '}
              <Text size="small" color="text-warning" weight={600}>
                {renewingSoon} renewing within {RENEWAL_SOON_DAYS} days
              </Text>
            </>
          )}
        </Text>
        {/* PLACEHOLDER DATA — contracts, values and cities are invented. */}
        <SampleDataBadge />
      </Box>

      <Box
        round="medium"
        background="background-front"
        border={{ color: 'border-weak' }}
        overflow="hidden"
      >
        <Box overflow={{ horizontal: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <caption className="saip-visually-hidden">
              Active service contracts, showing contract number, service level, value,
              cities covered and renewal date. All values are sample data.
            </caption>
            <thead>
              <tr>
                {/* Contracts are identified by number — every contract has an
                    SLA, so the SLA alone doesn't distinguish them. */}
                <HeaderCell>Contract</HeaderCell>
                <HeaderCell>SLA</HeaderCell>
                <HeaderCell align="right">Value</HeaderCell>
                <HeaderCell>City / cities covered</HeaderCell>
                <HeaderCell>Renewal date</HeaderCell>
              </tr>
            </thead>

            <motion.tbody
              variants={staggerContainer(reduced)}
              initial="hidden"
              animate="visible"
            >
              {data.map((contract) => (
                <ContractRow
                  key={contract.contractId}
                  contract={contract}
                  reduced={reduced}
                />
              ))}
            </motion.tbody>
          </table>
        </Box>
      </Box>
    </Box>
  );
}

function HeaderCell({
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
        padding: '12px 16px',
        borderBottom: '1px solid var(--hpe-color-border-weak)',
        background: 'var(--hpe-color-background-contrast)',
        whiteSpace: 'nowrap',
      }}
    >
      <Text size="xsmall" weight={600} color="text-strong">
        {children}
      </Text>
    </th>
  );
}

function ContractRow({
  contract,
  reduced,
}: {
  contract: ServiceContract;
  reduced: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const soon = isRenewingSoon(contract);
  const expired = isExpired(contract);
  const days = daysUntil(contract.renewalDate);

  const cellStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderBottom: '1px solid var(--hpe-color-border-weak)',
    verticalAlign: 'middle',
  };

  return (
    <motion.tr
      variants={staggerItem(reduced)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: hovered
          ? 'var(--hpe-color-background-hover)'
          : 'var(--hpe-color-background-front)',
        transition: `background-color ${duration.fast}s`,
      }}
    >
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
        {/* Tabular figures so the 400-prefixed numbers line up as a column. */}
        <Text
          size="small"
          weight={600}
          color="text-strong"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {contract.contractId}
        </Text>
      </td>

      <td style={cellStyle}>
        <SlaChip sla={contract.sla} />
      </td>

      <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <Text size="small" color="text-default">
          {formatCurrency(contract.value, contract.currency)}
        </Text>
      </td>

      <td style={cellStyle}>
        <Box direction="row" gap="4px" wrap>
          {contract.cities.map((city) => (
            <Box
              key={city}
              pad={{ horizontal: 'xsmall', vertical: '2px' }}
              round="xsmall"
              background="background-contrast"
              flex={false}
              margin={{ bottom: '2px' }}
            >
              <Text size="xsmall" color="text-default">
                {city}
              </Text>
            </Box>
          ))}
        </Box>
      </td>

      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
        {/*
          Date on top, countdown underneath as quiet supporting text rather
          than a coloured pill jammed alongside it. The old inline badge fought
          the date for attention and made the column look cluttered.
        */}
        <Box gap="3px">
          <Text
            size="small"
            color="text-default"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatDate(contract.renewalDate)}
          </Text>
          {expired ? (
            <RenewalCountdown tone="critical" label="Expired" reduced={reduced} pulse={false} />
          ) : soon ? (
            <RenewalCountdown
              tone="warning"
              label={
                days === 0
                  ? 'Renews today'
                  : days === 1
                    ? 'Renews tomorrow'
                    : `Renews in ${days} days`
              }
              reduced={reduced}
              pulse
              // How far through the 90-day window this contract is.
              progress={1 - days / RENEWAL_SOON_DAYS}
            />
          ) : null}
        </Box>
      </td>
    </motion.tr>
  );
}

/**
 * Renewal flag.
 * Pulses only for the "renewing soon" case, and never under reduced motion —
 * where the colour and the label alone carry the same meaning.
 */
/**
 * Renewal countdown shown under the date.
 *
 * A small status dot, the countdown in words, and a thin track showing how far
 * through the 90-day window the contract is — so "renewing soon" is a shape you
 * can scan down the column, not a block of colour to read one row at a time.
 *
 * Only the dot pulses. Pulsing the whole element made a table full of text
 * shimmer; a single 6px dot flags the row without disturbing anything around
 * it.
 */
function RenewalCountdown({
  tone,
  label,
  reduced,
  pulse,
  progress,
}: {
  tone: 'warning' | 'critical';
  label: string;
  reduced: boolean;
  pulse: boolean;
  /** 0–1 through the renewal window. Omitted for expired contracts. */
  progress?: number;
}) {
  const animate = pulse && !reduced;
  const color =
    tone === 'warning'
      ? 'var(--hpe-color-foreground-warning)'
      : 'var(--hpe-color-foreground-critical)';

  return (
    <Box gap="3px" flex={false}>
      <Box direction="row" align="center" gap="6px">
        <motion.span
          aria-hidden
          animate={animate ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={
            animate
              ? { duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
              : { duration: duration.standard }
          }
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
            flex: '0 0 auto',
          }}
        />
        <Text size="xsmall" weight={600} style={{ color }}>
          {label}
        </Text>
      </Box>

      {typeof progress === 'number' && (
        <Box
          width="104px"
          height="3px"
          round="full"
          background="background-contrast"
          overflow="hidden"
          flex={false}
          aria-hidden
        >
          <motion.div
            initial={{ width: reduced ? `${progress * 100}%` : '0%' }}
            animate={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: duration.entrance * 1.6, ease: easing.out }
            }
            style={{ height: '100%', background: color, borderRadius: 'inherit' }}
          />
        </Box>
      )}
    </Box>
  );
}
