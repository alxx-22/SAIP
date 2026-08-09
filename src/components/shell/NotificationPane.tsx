import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'grommet';
import { Notification, CircleAlert, FormNextLink } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAccountService, type AppNotification } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/settings/SettingsProvider';
import { popover, staggerContainer, staggerItem } from '@/motion/variants';
import { duration, easing, glow, spring, stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonRows } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

const SEVERITY: Record<
  AppNotification['severity'],
  { background: string; border: string; icon: string; label: string }
> = {
  critical: {
    background: 'background-critical',
    border: 'border-critical',
    icon: 'icon-critical',
    label: 'Action needed',
  },
  warning: {
    background: 'background-warning',
    border: 'border-warning',
    icon: 'icon-warning',
    label: 'Overdue',
  },
  info: {
    background: 'background-info',
    border: 'border-info',
    icon: 'icon-info',
    label: 'For information',
  },
};

/**
 * Notification pane in the top ribbon.
 *
 * Items are derived from account data (see `buildNotifications` in the mock
 * service), so they clear themselves once the underlying date is updated —
 * there's nothing to dismiss and nothing to keep in sync.
 *
 * Selecting a notification deep-links to the exact field that caused it:
 * Account Focus → Account Monitoring, with the field scrolled to and
 * highlighted. Landing the rep on the page but leaving them to hunt for the
 * row would waste most of the value of having the alert at all.
 *
 * `refreshKey` lets the shell force a re-read after a monitoring save.
 */
export function NotificationPane({ refreshKey = 0 }: { refreshKey?: number }) {
  const service = useAccountService();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();
  const [open, setOpen] = useState(false);
  /**
   * Bumped every time the pane is opened, so the list is re-derived on each
   * view. A rep who has just cleared an overdue date should not have to reload
   * the page to see the alert disappear.
   */
  const [openCount, setOpenCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { notifications: prefs } = useSettings();

  const { data, loading } = useAsync(
    () => service.getNotifications({ overdueAfterMonths: prefs.overdueAfterMonths }),
    [service, refreshKey, openCount, prefs.overdueAfterMonths],
  );

  /**
   * The user's severity filter, applied here rather than in the service.
   *
   * The overdue threshold has to go to the service, because only it can see the
   * underlying dates. Severity is already on the notification, so filtering it
   * client-side avoids a round trip and keeps the toggles instant.
   */
  const visible = useMemo(() => {
    if (!prefs.enabled || !data) return [];
    return data.filter((n) => prefs.severities[n.severity]);
  }, [data, prefs.enabled, prefs.severities]);

  const count = visible.length;
  /** Distinguishes "nothing to do" from "you filtered everything out". */
  const filteredOut = (data?.length ?? 0) > 0 && count === 0 && prefs.enabled;

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  function openNotification(n: AppNotification) {
    setOpen(false);
    /*
      The target ribbon and field travel in the URL so the link is shareable
      and survives a refresh.

      `n` (a nonce) is what makes this work when the rep is ALREADY on the
      target page. Without it the URL is identical to the current one, React
      Router treats the navigation as a no-op, nothing re-renders, and the
      notification appears to do nothing — which is exactly how "the
      notification navigation stops working after a while" presented.
    */
    navigate(
      `/account/${n.accountId}?ribbon=${n.target.ribbon}&field=${n.target.fieldId}&n=${Date.now()}`,
    );
  }

  return (
    <Box ref={wrapperRef} style={{ position: 'relative' }} flex={false}>
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (!v) setOpenCount((c) => c + 1);
            return !v;
          });
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          count > 0 ? `Notifications, ${count} needing attention` : 'Notifications'
        }
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={spring.snappy}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // 42 square, matching the Log a meeting button beside it.
          width: 42,
          height: 42,
          padding: 0,
          borderRadius: 'var(--hpe-radius-small)',
          border: `1px solid ${open ? 'var(--saip-accent)' : 'var(--hpe-color-border-weak)'}`,
          background: open
            ? 'var(--hpe-color-background-contrast)'
            : 'var(--hpe-color-background-front)',
          cursor: 'pointer',
          boxShadow: open ? glow.primary : 'none',
        }}
      >
        <Notification size="small" color={open ? 'var(--saip-accent)' : 'icon-default'} />

        {/* Count badge. Pulses gently while anything is outstanding. */}
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={
                reduced
                  ? { scale: 1, opacity: 1 }
                  : { scale: 1, opacity: [1, 0.55, 1] }
              }
              exit={{ scale: 0, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      scale: spring.bouncy,
                      opacity: {
                        duration: 3,
                        ease: 'easeInOut',
                        repeat: Infinity,
                        repeatType: 'loop',
                      },
                    }
              }
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 600,
                lineHeight: 1,
                color: '#ffffff',
                background: 'var(--hpe-color-background-critical-strong, #cc1f1a)',
              }}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={popover(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Notifications"
            style={{
              position: 'absolute',
              zIndex: 60,
              right: 0,
              top: 'calc(100% + 8px)',
              transformOrigin: 'top right',
              width: 400,
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            <Box
              round="medium"
              background="background-floating"
              border={{ color: 'border-weak' }}
              elevation="large"
              overflow="hidden"
            >
              <Box
                direction="row"
                align="center"
                justify="between"
                pad={{ horizontal: 'small', vertical: 'xsmall' }}
                border={{ side: 'bottom', color: 'border-weak' }}
                flex={false}
              >
                <Text size="small" weight={600} color="text-strong">
                  Notifications
                </Text>
                {/* PLACEHOLDER DATA — derived from invented monitoring dates. */}
                <SampleDataBadge />
              </Box>

              <Box
                pad="xsmall"
                gap="xsmall"
                overflow={{ vertical: 'auto' }}
                style={{ maxHeight: 380 }}
              >
                {loading && <SkeletonRows rows={2} height="64px" label="Loading notifications" />}

                {!loading && count === 0 && (
                  <Box pad="medium" align="center" gap="xxsmall">
                    <Text size="small" color="text-weak">
                      {!prefs.enabled
                        ? 'Notifications are turned off.'
                        : filteredOut
                          ? 'Everything is filtered out.'
                          : 'Nothing needs your attention.'}
                    </Text>
                    <Text size="xsmall" color="text-weak" textAlign="center">
                      {!prefs.enabled || filteredOut
                        ? 'Change this in Profile & settings.'
                        : 'Overdue workshops and executive sponsor reviews appear here.'}
                    </Text>
                  </Box>
                )}

                {!loading && count > 0 && (
                  <motion.ul
                    variants={staggerContainer(reduced, stagger.tight)}
                    initial="hidden"
                    animate="visible"
                    style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}
                  >
                    {visible.map((n) => (
                      <motion.li key={n.id} variants={staggerItem(reduced)}>
                        <NotificationRow
                          notification={n}
                          reduced={reduced}
                          onSelect={() => openNotification(n)}
                        />
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

/** One notification. A real button, so it's reachable and activatable. */
function NotificationRow({
  notification,
  reduced,
  onSelect,
}: {
  notification: AppNotification;
  reduced: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const tone = SEVERITY[notification.severity];

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      whileHover={reduced ? undefined : { x: 3 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'none',
        padding: 0,
        font: 'inherit',
        cursor: 'pointer',
        display: 'block',
      }}
    >
      <Box
        direction="row"
        align="start"
        gap="small"
        pad="small"
        round="small"
        background={hovered ? 'background-hover' : 'background-front'}
        border={{ color: hovered ? tone.border : 'border-weak' }}
        style={{
          transition: `background-color ${duration.fast}s, border-color ${duration.fast}s`,
        }}
      >
        <Box
          pad="4px"
          round="xsmall"
          background={tone.background}
          flex={false}
          margin={{ top: '2px' }}
        >
          <CircleAlert size="small" color={tone.icon} />
        </Box>

        <Box gap="2px" flex>
          <Text size="small" weight={600} color="text-strong">
            {notification.title}
          </Text>
          <Text size="xsmall" color="text-default">
            {notification.accountName}
          </Text>
          <Text size="xsmall" color="text-weak">
            {notification.detail}
          </Text>
        </Box>

        <motion.div
          animate={reduced ? undefined : { x: hovered ? 3 : 0 }}
          transition={{ duration: duration.fast, ease: easing.out }}
          aria-hidden
        >
          <FormNextLink size="small" color={hovered ? 'var(--saip-accent)' : 'icon-weak'} />
        </motion.div>
      </Box>
    </motion.button>
  );
}
