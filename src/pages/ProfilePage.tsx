import { Box, CheckBox, Heading, RangeInput, Text } from 'grommet';
import { Moon, Sun, System, UserSettings } from 'grommet-icons';
import { motion } from 'framer-motion';
import {
  OVERDUE_MONTHS_MAX,
  OVERDUE_MONTHS_MIN,
  useSettings,
  type ThemeMode,
} from '@/settings/SettingsProvider';
import { ACCENTS, type AccentId } from '@/settings/accents';
import { useAccountService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { staggerContainer, staggerItem } from '@/motion/variants';
import type { NotificationSeverity } from '@/services';

/**
 * Profile and settings.
 *
 * A ROUTE, NOT A SEPARATE POWER PAGES PAGE — deliberately.
 *
 * A second Power Pages page would mean a second document load, a second copy of
 * the bundle parsed, and the theme applying a beat after the page paints (a
 * visible flash of the wrong theme). It would also put the settings outside the
 * React tree that consumes them, so every change would need to round-trip
 * through storage to take effect. As a hash route it is instant, shares the
 * provider, and costs nothing extra to serve.
 *
 * Note the site also has a Power Pages "Profile" page at /profile. There is no
 * collision: this app uses hash routing, so this screen lives at `/#/profile`.
 */
export function ProfilePage() {
  const { reduced } = useAppMotion();
  const service = useAccountService();
  const { data: user } = useAsync(() => service.getCurrentUser(), [service]);

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="medium">
      <Box gap="xxsmall">
        <Box direction="row" align="center" gap="small">
          <UserSettings color="var(--saip-accent)" />
          <Heading level={1} size="small" margin="none">
            Profile &amp; settings
          </Heading>
        </Box>
        <Text size="small" color="text-weak">
          {user
            ? `Signed in as ${user.displayName} · ${user.email}`
            : 'Loading your details…'}
        </Text>
      </Box>

      <motion.div
        variants={staggerContainer(reduced)}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--hpe-spacing-medium)' }}
      >
        <motion.div variants={staggerItem(reduced)}>
          <AppearanceSection />
        </motion.div>
        <motion.div variants={staggerItem(reduced)}>
          <NotificationsSection />
        </motion.div>
      </motion.div>
    </Box>
  );
}

/** Shared card shell so both sections sit on the same surface and rhythm. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      background="background-front"
      round="small"
      pad="medium"
      gap="medium"
      border={{ color: 'border-weak' }}
    >
      <Box gap="xxsmall">
        <Heading level={2} size="xsmall" margin="none">
          {title}
        </Heading>
        <Text size="small" color="text-weak">
          {description}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

const MODES: { id: ThemeMode; label: string; hint: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', hint: 'Always light', Icon: Sun },
  { id: 'dark', label: 'Dark', hint: 'Always dark', Icon: Moon },
  { id: 'auto', label: 'System', hint: 'Follow my device', Icon: System },
];

function AppearanceSection() {
  const { mode, accent, resolvedMode, setMode, setAccent } = useSettings();
  const { reduced } = useAppMotion();

  return (
    <Section
      title="Appearance"
      description="Choose light or dark, then an accent colour. Every colour is an HPE design token, so both themes stay inside the design system."
    >
      <Box gap="xsmall">
        <Text size="small" weight={600} color="text-strong">
          Theme
        </Text>
        <Box direction="row" gap="small" wrap>
          {MODES.map(({ id, label, hint, Icon }) => {
            const selected = mode === id;
            return (
              <motion.button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={selected}
                whileHover={reduced ? undefined : { y: -2 }}
                transition={{ duration: duration.fast, ease: easing.out }}
                style={{
                  flex: '1 1 140px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--hpe-spacing-small)',
                  padding: 'var(--hpe-spacing-small)',
                  borderRadius: 'var(--hpe-radius-small)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: selected
                    ? 'var(--hpe-color-background-active)'
                    : 'var(--hpe-color-background-back)',
                  border: selected
                    ? '2px solid var(--saip-accent)'
                    : '2px solid var(--hpe-color-border-weak)',
                }}
              >
                <Icon color={selected ? 'var(--saip-accent)' : 'text-weak'} size="18px" />
                <span>
                  <Text
                    size="small"
                    weight={selected ? 600 : 400}
                    color="text-strong"
                    as="div"
                  >
                    {label}
                  </Text>
                  <Text size="xsmall" color="text-weak" as="div">
                    {hint}
                  </Text>
                </span>
              </motion.button>
            );
          })}
        </Box>
        {mode === 'auto' && (
          <Text size="xsmall" color="text-weak">
            Your device is currently set to {resolvedMode}.
          </Text>
        )}
      </Box>

      <Box gap="xsmall">
        <Text size="small" weight={600} color="text-strong">
          Accent colour
        </Text>
        <Text size="xsmall" color="text-weak">
          Replaces the green throughout the app — gauges, highlights, the
          assistant and the active navigation marker.
        </Text>
        <Box direction="row" gap="small" wrap>
          {ACCENTS.map((option) => (
            <AccentSwatch
              key={option.id}
              id={option.id}
              label={option.label}
              description={option.description}
              selected={accent === option.id}
              onSelect={setAccent}
              reduced={reduced}
              // Preview the accent in the mode currently showing, so the swatch
              // is the colour the user will actually get.
              swatch={
                resolvedMode === 'dark' ? option.dark.accent : option.light.accent
              }
            />
          ))}
        </Box>
      </Box>
    </Section>
  );
}

function AccentSwatch({
  id,
  label,
  description,
  swatch,
  selected,
  onSelect,
  reduced,
}: {
  id: AccentId;
  label: string;
  description: string;
  swatch: string;
  selected: boolean;
  onSelect: (id: AccentId) => void;
  reduced: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      title={description}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--hpe-spacing-small)',
        padding: 'var(--hpe-spacing-small)',
        borderRadius: 'var(--hpe-radius-small)',
        cursor: 'pointer',
        background: selected
          ? 'var(--hpe-color-background-active)'
          : 'var(--hpe-color-background-back)',
        border: selected
          ? '2px solid var(--saip-accent)'
          : '2px solid var(--hpe-color-border-weak)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: swatch,
          flex: '0 0 auto',
          // Only the selected swatch glows, so the eye lands on the current choice.
          boxShadow: selected ? `0 0 12px -2px ${swatch}` : 'none',
        }}
      />
      <Text size="small" weight={selected ? 600 : 400} color="text-strong">
        {label}
      </Text>
    </motion.button>
  );
}

const SEVERITY_LABELS: Record<NotificationSeverity, { label: string; hint: string }> = {
  critical: { label: 'Action needed', hint: 'Something is overdue and blocking' },
  warning: { label: 'Overdue', hint: 'Past the cadence you expect to keep' },
  info: { label: 'For information', hint: 'Worth knowing, nothing to do today' },
};

function NotificationsSection() {
  const { notifications, setNotifications, resetAll } = useSettings();

  return (
    <Section
      title="Notifications"
      description="Notifications are derived from your accounts rather than stored, so they clear themselves as soon as the underlying date is updated. These options control what surfaces in the pane."
    >
      <CheckBox
        toggle
        checked={notifications.enabled}
        label="Show notifications"
        onChange={(event) => setNotifications({ enabled: event.target.checked })}
      />

      <Box
        gap="xsmall"
        // Sub-options are meaningless while notifications are off. Dimmed and
        // disabled rather than removed, so the pane does not jump around.
        style={{
          opacity: notifications.enabled ? 1 : 0.45,
          pointerEvents: notifications.enabled ? 'auto' : 'none',
        }}
        aria-hidden={!notifications.enabled}
      >
        <Text size="small" weight={600} color="text-strong">
          Show these types
        </Text>
        {(Object.keys(SEVERITY_LABELS) as NotificationSeverity[]).map((severity) => (
          <Box key={severity} gap="xxsmall">
            <CheckBox
              checked={notifications.severities[severity]}
              label={SEVERITY_LABELS[severity].label}
              disabled={!notifications.enabled}
              onChange={(event) =>
                setNotifications({
                  severities: { [severity]: event.target.checked },
                })
              }
            />
            <Text size="xsmall" color="text-weak" margin={{ left: 'medium' }}>
              {SEVERITY_LABELS[severity].hint}
            </Text>
          </Box>
        ))}

        <Box gap="xxsmall" margin={{ top: 'small' }}>
          <Text size="small" weight={600} color="text-strong">
            Flag a field as overdue after {notifications.overdueAfterMonths} months
          </Text>
          <Text size="xsmall" color="text-weak">
            Applies to your notifications only. The Account Monitoring ribbon
            keeps using the agreed 12-month business rule, because that flag is a
            fact about the account rather than a personal preference.
          </Text>
          <RangeInput
            min={OVERDUE_MONTHS_MIN}
            max={OVERDUE_MONTHS_MAX}
            step={1}
            value={notifications.overdueAfterMonths}
            disabled={!notifications.enabled}
            aria-label="Months before a monitoring field is flagged overdue"
            onChange={(event) =>
              setNotifications({ overdueAfterMonths: Number(event.target.value) })
            }
          />
          <Box direction="row" justify="between">
            <Text size="xsmall" color="text-weak">
              {OVERDUE_MONTHS_MIN} months
            </Text>
            <Text size="xsmall" color="text-weak">
              {OVERDUE_MONTHS_MAX} months
            </Text>
          </Box>
        </Box>
      </Box>

      <Box direction="row" justify="start" margin={{ top: 'small' }}>
        <button
          type="button"
          onClick={resetAll}
          style={{
            background: 'transparent',
            border: '1px solid var(--hpe-color-border-strong)',
            borderRadius: 'var(--hpe-radius-small)',
            padding: 'var(--hpe-spacing-xsmall) var(--hpe-spacing-small)',
            cursor: 'pointer',
            color: 'var(--hpe-color-text-strong)',
            font: 'inherit',
          }}
        >
          Reset all settings
        </button>
      </Box>
    </Section>
  );
}
