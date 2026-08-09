import type { ReactNode } from 'react';
import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { fadeRise } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';
import { NotificationPane } from './NotificationPane';

/**
 * The top of every page — and, since the app has no separate top bar, the only
 * top of every page.
 *
 * WHY THE TOP BAR WENT. It was a sticky strip carrying one control: the
 * notification bell. Under it, every page then drew its own heading row. That
 * was two stacked bands of chrome, roughly 120px, before any content — on a
 * laptop it pushed the first thing worth reading below the fold.
 *
 * Merging them costs nothing: the bell now sits at the end of the heading row it
 * used to float above. One band, same controls.
 *
 * Deliberately NOT sticky. The point of the merge was to give the page back its
 * vertical space, and a sticky header that includes a title and a subtitle takes
 * more of it while scrolling than the bar ever did.
 *
 * LAYOUT — four slots, in reading order:
 *
 *   eyebrow    a back link or breadcrumb, above the title
 *   title      the h1, with optional adornment (a badge, a chip)
 *   aside      compact visuals that belong WITH the title — the account gauges
 *   actions    the page's primary button, then the bell
 *
 * `aside` sits between the title and the actions because that gap is otherwise
 * dead space on a wide screen, and because a summary visual is read as part of
 * the heading rather than as content.
 */
export function PageHeader({
  eyebrow,
  title,
  titleAdornment,
  subtitle,
  aside,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Rendered inline after the title — a badge or chip. */
  titleAdornment?: ReactNode;
  subtitle?: ReactNode;
  /** Compact visuals shown between the title and the actions. */
  aside?: ReactNode;
  /** The page's own actions. The notification bell is appended automatically. */
  actions?: ReactNode;
}) {
  const { reduced } = useAppMotion();

  return (
    /*
      A real <header>, not a div.

      It is inside <main>, which is valid — `header` is sectioning-adjacent
      content, not a page-level singleton — and it earns its keep: with the top
      bar gone, this is the only landmark separating the page's chrome from its
      content, and the notification bell now lives inside it rather than in a
      banner of its own.
    */
    <motion.header variants={fadeRise(reduced)} initial="hidden" animate="visible">
      <Box gap="xsmall">
        {eyebrow}

        <Box direction="row" align="center" justify="between" gap="medium" wrap>
          {/*
            `2 1 380px` rather than Grommet's `flex`, which compiles to
            grow-only. Three things are being asked for at once:

              - SHRINK, so the aside and actions keep their space
              - a basis wide enough that the account name, its badge and the
                subtitle stay on one line each at desktop widths (at 260px the
                badge dropped below the title and the subtitle ran to two lines)
              - twice the aside's growth factor, so leftover space goes mostly
                to the text rather than padding out the gauges
          */}
          <Box gap="xxsmall" style={{ flex: '2 1 380px', minWidth: 0 }}>
            {typeof title === 'string' ? (
              <Box direction="row" align="center" gap="small" wrap>
                <Text as="h1" size="xxlarge" weight={600} color="text-strong" margin="none">
                  {title}
                </Text>
                {titleAdornment}
              </Box>
            ) : (
              title
            )}

            {subtitle && (
              <Text color="text-weak" size="small">
                {subtitle}
              </Text>
            )}
          </Box>

          {/*
            The aside takes the LEFTOVER space and centres itself in it, rather
            than sitting flush against the actions. `1 1 auto` beside the
            title's `1 1 260px` means the title wins the room it needs and the
            aside gets what remains — so the gauges sit mid-way between the
            account name and Log a meeting instead of hugging the button.
          */}
          {aside && (
            <div
              style={{
                flex: '1 1 auto',
                display: 'flex',
                justifyContent: 'center',
                minWidth: 0,
              }}
            >
              {aside}
            </div>
          )}

          {/*
            CSS gap rather than Grommet's <Box gap>: its spacer divs sit on top
            of controls in a wrapping row and swallow the click. The same trap
            is documented in SaipAiPrompt and global.css.
          */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--hpe-spacing-small)',
              flex: '0 0 auto',
            }}
          >
            {actions}
            <NotificationPane />
          </div>
        </Box>
      </Box>
    </motion.header>
  );
}
