import { useMemo, useState } from 'react';
import { Box, Text, TextInput } from 'grommet';
import { FormNextLink, Search } from 'grommet-icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Account } from '@/services';
import { useAccountService } from '@/services';
import { formatCurrencyCompact, formatRelative } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { duration, easing, glow, spring } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonRows } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

/**
 * Account Selection Pane (brief §7.1).
 *
 * Lists every account aligned to the signed-in salesperson and routes to
 * Account Focus on selection.
 *
 * Motion: staggered row reveal on entrance, elevation + highlight on hover,
 * skeleton shimmer while loading, and no ambient motion once settled.
 *
 * The filter box is an addition, not in the brief — a rep with a large book
 * shouldn't have to scan a long list by eye. It filters on name, industry and
 * region.
 */
export function AccountSelectionPane() {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();
  const [query, setQuery] = useState('');

  const { data, loading, error } = useAsync(() => service.getAccounts(), [service]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((a) =>
      [a.accountName, a.industry, a.region].some((f) => f.toLowerCase().includes(q)),
    );
  }, [data, query]);

  return (
    <Box gap="small">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Box gap="xxsmall">
          <Text as="h2" size="large" weight={600} color="text-strong" margin="none">
            Your accounts
          </Text>
          <Text size="small" color="text-weak">
            {loading
              ? 'Loading your aligned accounts…'
              : `${filtered.length} account${filtered.length === 1 ? '' : 's'} aligned to you`}
          </Text>
        </Box>

        <Box width="280px" flex={false}>
          <TextInput
            icon={<Search size="small" />}
            placeholder="Filter accounts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter accounts by name, industry or region"
          />
        </Box>
      </Box>

      {loading && <SkeletonRows rows={5} label="Loading accounts" />}

      {error && (
        <Box
          pad="medium"
          round="medium"
          background="background-critical"
          border={{ color: 'border-critical' }}
          role="alert"
        >
          <Text size="small" color="text-strong">
            Couldn’t load your accounts. {error.message}
          </Text>
        </Box>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Box
          pad="large"
          round="medium"
          background="background-front"
          border={{ color: 'border-weak' }}
          align="center"
        >
          <Text color="text-weak">
            {query ? `No accounts match “${query}”.` : 'No accounts are aligned to you yet.'}
          </Text>
        </Box>
      )}

      {!loading && !error && filtered.length > 0 && (
        <motion.ul
          variants={staggerContainer(reduced)}
          initial="hidden"
          animate="visible"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}
        >
          {filtered.map((account) => (
            <motion.li key={account.accountId} variants={staggerItem(reduced)}>
              <AccountRow
                account={account}
                reduced={reduced}
                onSelect={() => navigate(`/account/${account.accountId}`)}
              />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Box>
  );
}

/**
 * One selectable account.
 *
 * Rendered as a real <button> so keyboard and screen-reader users get
 * activation, focus and role for free — a div with an onClick would not.
 */
function AccountRow({
  account,
  reduced,
  onSelect,
}: {
  account: Account;
  reduced: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      whileHover={reduced ? undefined : { x: 6, scale: 1.006 }}
      whileTap={reduced ? undefined : { scale: 0.994 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      aria-label={`Open ${account.accountName}`}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: 0,
        border: 'none',
        background: 'none',
        font: 'inherit',
        display: 'block',
      }}
    >
      <Box
        direction="row"
        align="center"
        justify="between"
        gap="medium"
        /*
          Wraps because the figures block below is `flex={false}` — it cannot
          shrink, and at phone widths the name and three figures together are
          wider than the screen, which pushed the whole document into
          horizontal scroll. Wrapping drops the figures onto a second line
          instead.
        */
        wrap
        pad={{ horizontal: 'medium', vertical: 'small' }}
        round="small"
        background={hovered ? 'background-hover' : 'background-front'}
        border={{ color: hovered ? 'border-default' : 'border-weak' }}
        elevation={hovered && !reduced ? 'small' : undefined}
        style={{
          position: 'relative',
          boxShadow: hovered && !reduced ? glow.primary : undefined,
          transition: `background-color ${duration.fast}s, border-color ${duration.fast}s, box-shadow ${duration.fast}s`,
        }}
      >
        {/* Brand rail that grows in from the leading edge on hover. */}
        <motion.span
          aria-hidden
          animate={reduced ? undefined : { scaleY: hovered ? 1 : 0 }}
          initial={false}
          transition={spring.snappy}
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 3,
            transformOrigin: 'center',
            background: 'var(--saip-accent)',
          }}
        />

        {/* `1 1 200px` rather than plain `flex`: it must be allowed to SHRINK
            (Grommet's `flex` compiles to grow-only) and to sit on its own line
            once the figures wrap below it. */}
        <Box gap="xxsmall" style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Box direction="row" align="center" gap="xsmall" wrap>
            <Text weight={600} color="text-strong">
              {account.accountName}
            </Text>
            {/* PLACEHOLDER DATA — account names are fictional. */}
            <SampleDataBadge />
          </Box>
          <Text size="small" color="text-weak">
            {account.industry} · {account.region}
          </Text>
        </Box>

        <Box direction="row" align="center" gap="large" flex={false} wrap>
          <Stat
            label="Annual services"
            value={formatCurrencyCompact(
              account.annualServicesRevenue,
              account.currency,
            )}
          />
          <Stat
            label="Active contracts"
            value={String(account.activeContractCount)}
          />
          <Stat label="Last meeting" value={formatRelative(account.lastMeetingDate)} />

          <motion.div
            animate={reduced ? undefined : { x: hovered ? 3 : 0 }}
            transition={{ duration: duration.fast, ease: easing.out }}
            aria-hidden
          >
            <FormNextLink color={hovered ? 'var(--saip-accent)' : 'icon-weak'} />
          </motion.div>
        </Box>
      </Box>
    </motion.button>
  );
}

/** Compact labelled figure used in the account row. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box gap="4px" align="end" flex={false}>
      <Text size="xsmall" color="text-weak">
        {label}
      </Text>
      <Text size="small" weight={500} color="text-default">
        {value}
      </Text>
    </Box>
  );
}
