import type { ReactNode } from 'react';
import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { duration, easing, glow, spring, stagger } from '@/motion/tokens';
import { staggerContainer, staggerItem } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';
import { IS_USING_PLACEHOLDER_DATA } from '@/services';
import { CopilotWidget } from './CopilotWidget';
import { NotificationPane } from './NotificationPane';

/** Top-level navigation. Two entries are placeholders per the brief §6. */
const NAV_ITEMS: { label: string; to: string; placeholder?: boolean }[] = [
  { label: 'Home', to: '/' },
  { label: 'Executive View', to: '/executive-view', placeholder: true },
  { label: 'Business Development', to: '/business-development', placeholder: true },
];

/**
 * Persistent app chrome: brand bar, primary nav, sample-data banner and the
 * Copilot Studio slot. Wraps every route.
 *
 * In Power Pages this chrome would likely be replaced by the site's own header
 * Web Template — it lives in its own component precisely so it can be dropped
 * without touching the pages underneath.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { reduced } = useAppMotion();
  const location = useLocation();

  return (
    <Box background="background-back" style={{ minHeight: '100vh' }}>
      {IS_USING_PLACEHOLDER_DATA && <SampleDataBanner reduced={reduced} />}

      <motion.header
        initial={reduced ? false : { y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: duration.entrance, ease: easing.out }}
        style={{ position: 'sticky', top: 0, zIndex: 20 }}
      >
        <Box
          direction="row"
          align="center"
          justify="between"
          pad={{ horizontal: 'medium', vertical: 'small' }}
          background="background-front"
          border={{ side: 'bottom', color: 'border-weak' }}
          flex={false}
        >
          <Box direction="row" align="center" gap="small">
            {/* Brand mark — HPE's green as a decorative element, from tokens.
                Draws itself in vertically as the header lands. */}
            <motion.div
              initial={reduced ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: duration.entrance, ease: easing.out, delay: 0.12 }}
              style={{ transformOrigin: 'center' }}
              aria-hidden
            >
              <Box
                width="6px"
                height="28px"
                round="xsmall"
                background="decorative-brand"
                flex={false}
                style={{ boxShadow: glow.primary }}
              />
            </motion.div>
            <Box>
              <Text size="large" weight={600} color="text-strong">
                SAIP
              </Text>
              <Text size="xsmall" color="text-weak">
                Services Account Intelligence Portal
              </Text>
            </Box>
          </Box>

          <Box direction="row" align="center" gap="small">
            <motion.nav
              aria-label="Primary"
              variants={staggerContainer(reduced, stagger.tight)}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', gap: 'var(--hpe-spacing-xsmall)' }}
            >
              {NAV_ITEMS.map((item) => (
                <motion.div key={item.to} variants={staggerItem(reduced)}>
                  <NavItem
                    {...item}
                    active={location.pathname === item.to}
                    reduced={reduced}
                  />
                </motion.div>
              ))}
            </motion.nav>

            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduced ? { duration: 0 } : { ...spring.bouncy, delay: 0.25 }}
            >
              <NotificationPane />
            </motion.div>
          </Box>
        </Box>
      </motion.header>

      {/* Route content scrolls with the document, not in its own container. */}
      <Box as="main">{children}</Box>

      <CopilotWidget />
    </Box>
  );
}

/**
 * A nav link with an animated active underline.
 *
 * The underline is a shared `layoutId` element, so moving between routes slides
 * it rather than cross-fading two bars — the kind of continuity that makes the
 * nav feel responsive instead of redrawn.
 */
function NavItem({
  label,
  to,
  placeholder,
  active,
  reduced,
}: {
  label: string;
  to: string;
  placeholder?: boolean;
  active: boolean;
  reduced: boolean;
}) {
  return (
    <NavLink
      to={to}
      style={{ textDecoration: 'none', position: 'relative', display: 'block' }}
      aria-current={active ? 'page' : undefined}
    >
      <motion.div
        whileHover={reduced ? undefined : { y: -1 }}
        transition={{ duration: duration.fast, ease: easing.out }}
      >
        <Box
          pad={{ horizontal: 'small', vertical: 'xsmall' }}
          round="xsmall"
          direction="row"
          align="center"
          gap="xsmall"
          className="saip-nav-item"
        >
          <Text
            size="small"
            weight={active ? 600 : 400}
            color={active ? 'text-strong' : 'text-weak'}
          >
            {label}
          </Text>
          {/* Placeholder routes are labelled in the nav itself so nobody
              clicks through expecting a built page. */}
          {placeholder && (
            <Text size="xsmall" color="text-weak" aria-label="Not yet built">
              ·
            </Text>
          )}
        </Box>
        {active && (
          <motion.div
            layoutId="saip-nav-underline"
            transition={
              reduced
                ? { duration: 0 }
                : { duration: duration.standard, ease: easing.inOut }
            }
            style={{
              position: 'absolute',
              left: 'var(--hpe-spacing-xsmall)',
              right: 'var(--hpe-spacing-xsmall)',
              bottom: -2,
              height: 2,
              borderRadius: 2,
              background: 'var(--hpe-color-decorative-brand)',
              boxShadow: glow.primary,
            }}
          />
        )}
      </motion.div>
    </NavLink>
  );
}

/**
 * Whole-app sample-data banner (brief §5).
 *
 * Rendered only while `IS_USING_PLACEHOLDER_DATA` is true, so wiring the real
 * service removes it automatically.
 */
function SampleDataBanner({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={{ duration: duration.entrance, ease: easing.out }}
      style={{ overflow: 'hidden', flex: '0 0 auto' }}
    >
      <Box
        background="background-warning"
        pad={{ horizontal: 'medium', vertical: 'xsmall' }}
        direction="row"
        align="center"
        gap="small"
        border={{ side: 'bottom', color: 'border-warning' }}
        role="note"
      >
        <Text size="small" weight={600} color="text-strong">
          Prototype
        </Text>
        <Text size="small" color="text-strong">
          Every account, figure, score and date shown is invented sample data —
          not a real customer and not live from Dataverse.
        </Text>
      </Box>
    </motion.div>
  );
}
