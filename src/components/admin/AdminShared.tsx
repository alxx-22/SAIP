import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { duration, easing } from '@/motion/tokens';

/**
 * Small shared pieces for the admin panels, so the three of them look like one
 * screen rather than three that happen to sit behind the same tabs.
 */

/** Card wrapper, matching the panels used across the rest of the app. */
export function AdminPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      background="background-front"
      round="medium"
      pad="medium"
      gap="medium"
      border={{ color: 'border-weak' }}
    >
      <Box direction="row" align="start" justify="between" gap="small" wrap>
        <Box gap="xxsmall" style={{ minWidth: 0 }}>
          <Text as="h2" size="medium" weight={600} color="text-strong" margin="none">
            {title}
          </Text>
          <Text size="small" color="text-weak" style={{ maxWidth: '72ch' }}>
            {description}
          </Text>
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/** Neutral outlined button, used for every non-primary admin action. */
export function AdminButton({
  onClick,
  children,
  disabled,
  tone = 'neutral',
  reduced,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  /** `danger` is for destructive actions only — it borrows the critical colour. */
  tone?: 'neutral' | 'accent' | 'danger';
  reduced: boolean;
  title?: string;
}) {
  const palette = {
    neutral: {
      background: 'transparent',
      border: 'var(--hpe-color-border-strong)',
      color: 'var(--hpe-color-text-strong)',
    },
    accent: {
      background: 'var(--saip-accent)',
      border: 'transparent',
      // Matches the other primary buttons in the app.
      color: 'var(--hpe-base-color-white)',
    },
    danger: {
      background: 'transparent',
      border: 'var(--hpe-color-border-critical)',
      color: 'var(--hpe-color-foreground-critical)',
    },
  }[tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileHover={disabled || reduced ? undefined : { y: -1 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        font: 'inherit',
        fontSize: '0.875rem',
        fontWeight: tone === 'accent' ? 500 : 400,
        padding: '8px 14px',
        borderRadius: 'var(--hpe-radius-small)',
        border: `1px solid ${palette.border}`,
        background: disabled ? 'var(--hpe-color-background-disabled)' : palette.background,
        color: disabled ? 'var(--hpe-color-text-disabled)' : palette.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </motion.button>
  );
}

/** Text input matching the incentive form's fields. */
export function AdminInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  type?: 'text' | 'textarea';
}) {
  const shared: React.CSSProperties = {
    font: 'inherit',
    fontSize: '0.875rem',
    width: '100%',
    padding: 'var(--hpe-spacing-xsmall)',
    borderRadius: 'var(--hpe-radius-small)',
    background: 'var(--hpe-color-background-back)',
    color: 'var(--hpe-color-text-default)',
    border: '1px solid var(--hpe-color-border-weak)',
  };

  if (type === 'textarea') {
    return (
      <textarea
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...shared, resize: 'vertical' }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={shared}
    />
  );
}

/** Read-only pill for a stable identifier. */
export function IdChip({ id }: { id: string }) {
  return (
    <span
      title="Stable identifier — this is what the code and the database join on."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.6875rem',
        fontVariantNumeric: 'tabular-nums',
        background: 'var(--hpe-color-background-back)',
        color: 'var(--hpe-color-text-weak)',
        border: '1px solid var(--hpe-color-border-weak)',
        whiteSpace: 'nowrap',
      }}
    >
      {id}
    </span>
  );
}

/** Warning strip for configuration the code still depends on. */
export function CodeDependentNote({ children }: { children: React.ReactNode }) {
  return (
    <Box
      pad="small"
      round="small"
      background="background-warning"
      border={{ color: 'border-warning' }}
    >
      <Text size="xsmall" color="text-strong">
        {children}
      </Text>
    </Box>
  );
}

/** Row separator used by all three panels' lists. */
export function Row({
  children,
  first = false,
}: {
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <Box
      pad={{ vertical: 'small' }}
      border={first ? undefined : { side: 'top', color: 'border-weak' }}
      gap="small"
    >
      {children}
    </Box>
  );
}

/** Horizontal group that never lets Grommet's gap spacers intercept a click. */
export function FlexRow({
  children,
  gap = 'small',
  justify,
  align = 'center',
}: {
  children: React.ReactNode;
  gap?: 'xxsmall' | 'xsmall' | 'small' | 'medium';
  justify?: 'start' | 'between' | 'end';
  align?: 'start' | 'center';
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        justifyContent:
          justify === 'between'
            ? 'space-between'
            : justify === 'end'
              ? 'flex-end'
              : 'flex-start',
        gap: `var(--hpe-spacing-${gap})`,
      }}
    >
      {children}
    </div>
  );
}
