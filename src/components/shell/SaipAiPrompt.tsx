import { useState } from 'react';
import { Box, Text } from 'grommet';
import { Search, Send } from 'grommet-icons';
import { motion } from 'framer-motion';
import { duration, easing, glow } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * SAIP.Ai — the assistant entry point on the homepage.
 *
 * PLACEHOLDER, STRUCTURAL ONLY. There is no agent behind this. It is here so
 * the homepage has the right shape now and the agent can be dropped in later
 * without a redesign.
 *
 * It does NOT pretend to work: submitting explains that the assistant is not
 * connected yet rather than showing a fake reply. A convincing canned answer
 * would be the wrong kind of placeholder — someone would eventually demo it as
 * though it were real.
 *
 * TO GO LIVE: replace `handleSubmit` with a call to the agent, and render the
 * response below the box. The three example prompts are the intended
 * capabilities — search, act, and log a meeting — so they double as a spec.
 */

/**
 * What the assistant is meant to do, once it exists.
 *
 * Shown as clickable examples: they fill the box rather than submit, so a rep
 * can see the shape of a good prompt and edit it. Each maps to one of the three
 * intended modes.
 */
const EXAMPLES: { mode: string; prompt: string }[] = [
  { mode: 'Search', prompt: 'Which accounts have contracts renewing in the next 90 days?' },
  { mode: 'Act', prompt: 'Draft a spend review agenda for Caledonia Energy plc' },
  { mode: 'Log', prompt: 'Log a Teams call with Meridian Health Trust yesterday' },
];

export function SaipAiPrompt() {
  const { reduced } = useAppMotion();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [notice, setNotice] = useState(false);

  function handleSubmit() {
    if (!value.trim()) return;
    setNotice(true);
  }

  return (
    <Box
      background="background-front"
      round="medium"
      border={{ color: 'border-weak' }}
      pad={{ horizontal: 'medium', vertical: 'medium' }}
      gap="small"
      align="center"
    >
      {/* Centred column, capped so the input never becomes an unusably wide
          single line on a large monitor. */}
      <Box gap="small" width={{ max: '760px' }} fill="horizontal" align="center">
        <Box align="center" gap="xxsmall">
          <Box direction="row" align="center" gap="xsmall">
            <Text size="large" weight={600} color="text-strong">
              Chat to SAIP
              <Text size="large" weight={600} style={{ color: 'var(--saip-accent)' }}>
                .Ai
              </Text>
            </Text>
            <ComingSoonChip />
          </Box>
          <Text size="small" color="text-weak" textAlign="center">
            Ask about your accounts, start an action, or log a meeting — in your
            own words.
          </Text>
        </Box>

        <motion.div
          style={{ width: '100%' }}
          animate={
            reduced || !focused ? { scale: 1 } : { scale: 1.005 }
          }
          transition={{ duration: duration.fast, ease: easing.out }}
        >
          <Box
            direction="row"
            align="center"
            gap="small"
            pad={{ horizontal: 'small', vertical: 'xsmall' }}
            round="medium"
            background="background-back"
            border={{ color: focused ? 'border-selected' : 'border-weak' }}
            style={{
              width: '100%',
              boxShadow: focused && !reduced ? glow.primary : 'none',
              transition: `box-shadow ${duration.fast}s ease-out`,
            }}
          >
            <Search size="small" color="icon-default" />
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setNotice(false);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder="Ask SAIP.Ai anything about your accounts…"
              aria-label="Ask SAIP.Ai"
              // The wrapper below draws the border and the accent glow on focus.
              // Without this the input drew its own ring inside that one.
              className="saip-bare-input"
              style={{
                font: 'inherit',
                fontSize: '0.9375rem',
                flex: 1,
                minWidth: 0,
                padding: '10px 0',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--hpe-color-text-default)',
              }}
            />
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={!value.trim()}
              aria-label="Send to SAIP.Ai"
              whileHover={reduced || !value.trim() ? undefined : { scale: 1.06 }}
              whileTap={reduced || !value.trim() ? undefined : { scale: 0.94 }}
              transition={{ duration: duration.fast, ease: easing.out }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flex: '0 0 auto',
                borderRadius: 'var(--hpe-radius-small)',
                border: 'none',
                background: value.trim()
                  ? 'var(--saip-accent)'
                  : 'var(--hpe-color-background-disabled)',
                cursor: value.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Send
                size="small"
                color={
                  value.trim()
                    ? 'var(--hpe-base-color-white)'
                    : 'var(--hpe-color-icon-disabled)'
                }
              />
            </motion.button>
          </Box>
        </motion.div>

        {/* Honest response. No canned answer — see the note at the top. */}
        {notice && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.fast, ease: easing.out }}
            style={{ width: '100%' }}
            role="status"
          >
            <Box
              pad="small"
              round="small"
              background="background-info"
              border={{ color: 'border-info' }}
            >
              <Text size="small" color="text-strong">
                SAIP.Ai isn’t connected yet. This is a placeholder for the
                assistant — it will answer questions, take actions and log
                meetings once it’s built.
              </Text>
            </Box>
          </motion.div>
        )}

        {/* CSS gap, not Grommet's <Box gap> — its spacer divs overlay controls
            on a wrapping row and swallow the click. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--hpe-spacing-xsmall)',
          }}
        >
          {EXAMPLES.map((example) => (
            <motion.button
              key={example.mode}
              type="button"
              // Fills the box rather than submitting, so the rep can edit it
              // before sending and sees what a good prompt looks like.
              onClick={() => {
                setValue(example.prompt);
                setNotice(false);
              }}
              whileHover={reduced ? undefined : { y: -1 }}
              transition={{ duration: duration.fast, ease: easing.out }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                font: 'inherit',
                fontSize: '0.75rem',
                padding: '6px 10px',
                borderRadius: 'var(--hpe-radius-xsmall)',
                border: '1px solid var(--hpe-color-border-weak)',
                background: 'var(--hpe-color-background-back)',
                color: 'var(--hpe-color-text-weak)',
                cursor: 'pointer',
                maxWidth: '100%',
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--hpe-color-text-strong)',
                  flex: '0 0 auto',
                }}
              >
                {example.mode}
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {example.prompt}
              </span>
            </motion.button>
          ))}
        </div>
      </Box>
    </Box>
  );
}

/** Marks the section as structural, in the same spirit as SampleDataBadge. */
function ComingSoonChip() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.6875rem',
        fontWeight: 600,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        background: 'var(--hpe-color-background-back)',
        color: 'var(--hpe-color-text-weak)',
        border: '1px solid var(--hpe-color-border-weak)',
      }}
    >
      Not built yet
    </span>
  );
}
