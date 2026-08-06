import { useEffect, useState, type ComponentType } from 'react';
import { Box, Text } from 'grommet';
import {
  Analytics,
  Home,
  Sidebar,
  Target,
  UserAdmin,
  UserSettings,
} from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { duration, easing, glow } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Retractable primary navigation.
 *
 * Collapsed it is an icon rail; expanded it shows labels. The state persists,
 * because a rep who collapses the rail to get screen back does not want it open
 * again on the next page load.
 *
 * The rail is `position: sticky` rather than `fixed`. Fixed would take it out of
 * flow and force the main column to carry a matching margin — two numbers that
 * then have to agree. Sticky keeps the flex row honest: the rail occupies real
 * width, the content gets whatever is left, and nothing has to be kept in sync.
 */

/**
 * Wide enough for "Business Development" — the longest label — to sit on one
 * line beside its icon without clipping. Check this if a longer label is added.
 */
const EXPANDED_WIDTH = 268;
const COLLAPSED_WIDTH = 64;
const STORAGE_KEY = 'saip.nav.collapsed';

interface NavEntry {
  label: string;
  to: string;
  icon: ComponentType<{ color?: string; size?: string }>;
  /** Reserved in the nav only — no content designed yet (brief §6). */
  placeholder?: boolean;
}

const PRIMARY: NavEntry[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Executive View', to: '/executive-view', icon: Analytics, placeholder: true },
  { label: 'Business Development', to: '/business-development', icon: Target },
];

/**
 * Pinned to the bottom, away from the primary destinations.
 *
 * Admin is shown to everyone in the prototype. In production it is gated by an
 * administrator web role — and the gate that matters is on the Dataverse table
 * permissions, not on whether this row renders.
 */
const SECONDARY: NavEntry[] = [
  { label: 'Admin', to: '/admin', icon: UserAdmin },
  { label: 'Profile & Settings', to: '/profile', icon: UserSettings },
];

function loadCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SideNav() {
  const { reduced } = useAppMotion();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Preference is cosmetic — losing it is not worth surfacing.
    }
  }, [collapsed]);

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <motion.div
      animate={{ width }}
      initial={false}
      transition={reduced ? { duration: 0 } : { duration: duration.standard, ease: easing.inOut }}
      style={{
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        flex: '0 0 auto',
        zIndex: 30,
        overflow: 'hidden',
      }}
    >
      <Box
        fill
        background="background-front"
        border={{ side: 'right', color: 'border-weak' }}
        pad={{ vertical: 'small' }}
        justify="between"
      >
        <Box flex={false}>
          <BrandMark collapsed={collapsed} reduced={reduced} />

          <Box
            as="nav"
            aria-label="Primary"
            pad={{ horizontal: 'xsmall' }}
            margin={{ top: 'medium' }}
            gap="xxsmall"
          >
            {PRIMARY.map((entry) => (
              <NavRow
                key={entry.to}
                entry={entry}
                collapsed={collapsed}
                active={location.pathname === entry.to}
                reduced={reduced}
              />
            ))}
          </Box>
        </Box>

        <Box flex={false} pad={{ horizontal: 'xsmall' }} gap="xxsmall">
          <Box
            as="nav"
            aria-label="Account"
            border={{ side: 'top', color: 'border-weak' }}
            pad={{ top: 'small' }}
            gap="xxsmall"
          >
            {SECONDARY.map((entry) => (
              <NavRow
                key={entry.to}
                entry={entry}
                collapsed={collapsed}
                active={location.pathname === entry.to}
                reduced={reduced}
              />
            ))}
          </Box>

          <CollapseToggle
            collapsed={collapsed}
            reduced={reduced}
            onToggle={() => setCollapsed((c) => !c)}
          />
        </Box>
      </Box>
    </motion.div>
  );
}

/**
 * Brand block. The accent bar stays visible when collapsed so the rail keeps its
 * identity at 64px, where the wordmark would not fit.
 */
function BrandMark({ collapsed, reduced }: { collapsed: boolean; reduced: boolean }) {
  return (
    <Box
      direction="row"
      align="center"
      gap="small"
      pad={{ horizontal: 'small' }}
      flex={false}
      // Fixed height so toggling does not shift the nav rows below it.
      height="44px"
    >
      <Box
        width="6px"
        height="28px"
        round="xsmall"
        background="var(--saip-accent)"
        flex={false}
        style={{ boxShadow: glow.primary }}
        aria-hidden
      />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={reduced ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
            transition={{ duration: duration.fast, ease: easing.out }}
            style={{ whiteSpace: 'nowrap' }}
          >
            <Text size="large" weight={600} color="text-strong">
              SAIP
            </Text>
            <Text size="xsmall" color="text-weak" as="div">
              Account Intelligence
            </Text>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

function NavRow({
  entry,
  collapsed,
  active,
  reduced,
}: {
  entry: NavEntry;
  collapsed: boolean;
  active: boolean;
  reduced: boolean;
}) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
      style={{ textDecoration: 'none', position: 'relative', display: 'block' }}
      aria-current={active ? 'page' : undefined}
      // The label is not rendered when collapsed, so the accessible name has to
      // come from somewhere. This also gives sighted users a native tooltip.
      title={collapsed ? entry.label : undefined}
      aria-label={collapsed ? entry.label : undefined}
    >
      <motion.div
        whileHover={reduced ? undefined : { x: 2 }}
        transition={{ duration: duration.fast, ease: easing.out }}
      >
        <Box
          direction="row"
          align="center"
          gap="small"
          pad={{ horizontal: 'small', vertical: 'xsmall' }}
          round="xsmall"
          height="40px"
          className="saip-nav-row"
          background={active ? 'background-active' : undefined}
          style={{ position: 'relative' }}
        >
          {/* Active marker. A shared layoutId slides it between rows rather than
              cross-fading two bars, so the rail reads as one moving indicator. */}
          {active && (
            <motion.div
              layoutId="saip-sidenav-active"
              transition={
                reduced ? { duration: 0 } : { duration: duration.standard, ease: easing.inOut }
              }
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                bottom: 6,
                width: 3,
                borderRadius: 3,
                background: 'var(--saip-accent)',
                boxShadow: glow.primary,
              }}
            />
          )}

          <Box flex={false} aria-hidden>
            <Icon color={active ? 'var(--saip-accent)' : 'text-weak'} size="18px" />
          </Box>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast, ease: easing.out }}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text
                  size="small"
                  weight={active ? 600 : 400}
                  color={active ? 'text-strong' : 'text-weak'}
                >
                  {entry.label}
                </Text>
                {/* Placeholder routes are marked in the nav so nobody clicks
                    through expecting a built page. */}
                {entry.placeholder && (
                  <Text size="xsmall" color="text-weak" aria-label="Not yet built">
                    ·
                  </Text>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </motion.div>
    </NavLink>
  );
}

function CollapseToggle({
  collapsed,
  reduced,
  onToggle,
}: {
  collapsed: boolean;
  reduced: boolean;
  onToggle: () => void;
}) {
  return (
    <Box pad={{ top: 'xsmall' }} flex={false}>
      <motion.button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        whileHover={reduced ? undefined : { x: 2 }}
        transition={{ duration: duration.fast, ease: easing.out }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--hpe-spacing-small)',
          width: '100%',
          height: 40,
          padding: '0 var(--hpe-spacing-small)',
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--hpe-radius-xsmall)',
          cursor: 'pointer',
          color: 'var(--hpe-color-text-weak)',
        }}
      >
        <motion.span
          animate={{ rotate: collapsed ? 180 : 0 }}
          initial={false}
          transition={reduced ? { duration: 0 } : { duration: duration.standard, ease: easing.inOut }}
          style={{ display: 'flex' }}
          aria-hidden
        >
          <Sidebar size="18px" color="text-weak" />
        </motion.span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast, ease: easing.out }}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Text size="small" color="text-weak">
                Collapse
              </Text>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </Box>
  );
}
