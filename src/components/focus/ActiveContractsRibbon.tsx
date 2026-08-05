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
import { duration, easing, glow } from '@/motion/tokens';
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
        <Box direction="row" align="center" gap="xsmall">
          <Text size="small" color="text-default">
            {formatDate(contract.renewalDate)}
          </Text>
          {expired ? (
            <RenewalBadge tone="critical" label="Expired" reduced={reduced} pulse={false} />
          ) : soon ? (
            <RenewalBadge
              tone="warning"
              label={days === 0 ? 'Renews today' : `${days} days`}
              reduced={reduced}
              pulse
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
function RenewalBadge({
  tone,
  label,
  reduced,
  pulse,
}: {
  tone: 'warning' | 'critical';
  label: string;
  reduced: boolean;
  pulse: boolean;
}) {
  const animate = pulse && !reduced;

  return (
    <motion.div
      // Renewing-soon badges pulse their glow and breathe very slightly.
      // Expired badges carry a static critical glow — an expiry isn't urgent
      // in the same "act now" sense, it's already happened.
      animate={
        animate
          ? {
              boxShadow: ['0 0 0 0 transparent', glow.warning, '0 0 0 0 transparent'],
              scale: [1, 1.05, 1],
            }
          : { boxShadow: glow[tone] }
      }
      transition={
        animate
          ? { duration: 2.6, ease: easing.inOut, repeat: Infinity }
          : { duration: duration.standard }
      }
      style={{ borderRadius: 'var(--hpe-radius-xsmall)' }}
    >
      <Box
        pad={{ horizontal: 'xsmall', vertical: '2px' }}
        round="xsmall"
        background={tone === 'warning' ? 'background-warning' : 'background-critical'}
        flex={false}
      >
        <Text size="xsmall" weight={600} color="text-strong">
          {label}
        </Text>
      </Box>
    </motion.div>
  );
}
