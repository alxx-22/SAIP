import { useState } from 'react';
import { Box, Text } from 'grommet';
import { UserAdmin } from 'grommet-icons';
import { motion } from 'framer-motion';
import { useAppMotion } from '@/motion/useAppMotion';
import { duration, easing } from '@/motion/tokens';
import { UsersRolesPanel } from '@/components/admin/UsersRolesPanel';
import { QuestionsPanel } from '@/components/admin/QuestionsPanel';
import { OptionSetsPanel } from '@/components/admin/OptionSetsPanel';

/**
 * Admin portal.
 *
 * THE IDEA: configuration lives in tables, not in markup. Questions, the
 * dropdowns that feed them, and who can see what are all records that an
 * administrator edits at runtime. Renaming a question or adding a meeting tag
 * stops being a code change, a build and a deploy.
 *
 * WHAT IS TRUE TODAY, STATED PLAINLY: this portal reads and writes that
 * configuration, and the seeded values mirror what the app renders — field id
 * for field id. But the app's own screens still use their TypeScript constants,
 * so an edit here does not yet change the Account Monitoring ribbon or the
 * meeting form. Wiring the consumers is the next step and lands with the SQL
 * build plan.
 *
 * Saying so in the UI matters more than saying so here: an admin screen that
 * silently does nothing is worse than no admin screen, so the banner below
 * spells it out.
 *
 * ACCESS: in production this route is for administrators only, enforced by a
 * web role and — critically — by Dataverse table permissions. Hiding the nav
 * entry is not security; the Web API is reachable regardless of what the UI
 * renders.
 */

type AdminTab = 'users' | 'questions' | 'dropdowns';

const TABS: { id: AdminTab; label: string; hint: string }[] = [
  { id: 'users', label: 'Users & roles', hint: 'Who can sign in, and what they can reach' },
  { id: 'questions', label: 'Questions', hint: 'The fields the app asks for' },
  { id: 'dropdowns', label: 'Dropdowns', hint: 'The lists those fields choose from' },
];

export function AdminPage() {
  const { reduced } = useAppMotion();
  const [tab, setTab] = useState<AdminTab>('users');

  return (
    <Box pad={{ horizontal: 'medium', vertical: 'medium' }} gap="medium">
      <Box gap="xxsmall">
        <Box direction="row" align="center" gap="small">
          <UserAdmin color="var(--saip-accent)" />
          <Text as="h1" size="xxlarge" weight={600} color="text-strong" margin="none">
            Admin
          </Text>
        </Box>
        <Text color="text-weak" style={{ maxWidth: '76ch' }}>
          Configuration held as data. Change what the app asks, the lists it
          offers and who can reach it — without changing the front end.
        </Text>
      </Box>

      {/* The honest caveat, in the product rather than only in the code. */}
      <Box
        pad="small"
        round="small"
        background="background-info"
        border={{ color: 'border-info' }}
        role="note"
      >
        <Text size="small" color="text-strong">
          <Text size="small" weight={600} color="text-strong">
            Not yet connected.{' '}
          </Text>
          Edits here are saved for this session and show the shape of the tables
          behind them, but the app's own screens still read their questions and
          dropdowns from code. Wiring them up comes with the SQL build.
        </Text>
      </Box>

      <div
        role="tablist"
        aria-label="Admin sections"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hpe-spacing-xsmall)' }}
      >
        {TABS.map((entry) => {
          const selected = tab === entry.id;
          return (
            <motion.button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(entry.id)}
              whileHover={reduced ? undefined : { y: -1 }}
              transition={{ duration: duration.fast, ease: easing.out }}
              style={{
                textAlign: 'left',
                font: 'inherit',
                fontSize: '0.875rem',
                padding: '8px 14px',
                borderRadius: 'var(--hpe-radius-small)',
                cursor: 'pointer',
                color: 'var(--hpe-color-text-strong)',
                background: selected
                  ? 'var(--hpe-color-background-active)'
                  : 'transparent',
                border: selected
                  ? '1px solid var(--saip-accent)'
                  : '1px solid var(--hpe-color-border-weak)',
              }}
            >
              <span style={{ fontWeight: selected ? 600 : 400, display: 'block' }}>
                {entry.label}
              </span>
              <span
                style={{ fontSize: '0.6875rem', color: 'var(--hpe-color-text-weak)' }}
              >
                {entry.hint}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Keyed so switching tabs replays the entrance rather than swapping silently. */}
      <motion.div
        key={tab}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.fast, ease: easing.out }}
      >
        {tab === 'users' && <UsersRolesPanel />}
        {tab === 'questions' && <QuestionsPanel />}
        {tab === 'dropdowns' && <OptionSetsPanel />}
      </motion.div>

      <Box height="48px" flex={false} />
    </Box>
  );
}
