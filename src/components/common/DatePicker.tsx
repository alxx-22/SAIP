import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Calendar, Text } from 'grommet';
import { Schedule } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDate, todayIso } from '@/services/derive';
import { popover } from '@/motion/variants';
import { duration, easing, glow, spring } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * HPE-tokenised date picker.
 *
 * Replaces `<input type="date">`, whose control is drawn by the browser and
 * cannot be themed — it ignored the HPE palette entirely and looked like a
 * different product on every OS.
 *
 * The calendar itself is Grommet's `<Calendar>`, which `grommet-theme-hpe`
 * already styles from semantic tokens (day hover, selected, in-range, adjacent
 * months all resolve to `--hpe-color-*`). Hand-rolling a month grid would have
 * meant re-deriving all of that by eye. What is custom here is the trigger, the
 * animated popover, the quick actions and the keyboard/focus behaviour.
 *
 * Dates cross this boundary as `YYYY-MM-DD` strings, matching the service
 * layer. Grommet emits a full ISO string, so the first 10 characters are taken
 * rather than re-parsing through `Date` — which would shift the day for anyone
 * west of UTC.
 */
export function DatePicker({
  id,
  value,
  onChange,
  max = todayIso(),
  min = '1990-01-01',
  placeholder = 'Select a date',
  clearable = true,
  invalid = false,
}: {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Latest selectable date, inclusive. Defaults to today — these are all "last X" fields. */
  max?: string;
  min?: string;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
}) {
  const { reduced } = useAppMotion();
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  // Close on outside click and on Escape, wherever focus happens to be.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  // Flip above the trigger when there isn't room below — these fields sit near
  // the bottom of a long form as often as not.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 380 && rect.top > 380);
  }, [open]);

  // Move focus into the calendar so arrow keys drive it immediately.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('button[aria-pressed], button:not([disabled])')
        ?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [open]);

  function handleSelect(selected: unknown) {
    // Grommet hands back a full ISO string (or an array in range mode, unused
    // here). The date part is taken verbatim to avoid a timezone shift.
    const iso = String(selected).slice(0, 10);
    onChange(iso);
    close();
  }

  return (
    <Box ref={wrapperRef} style={{ position: 'relative' }} fill="horizontal">
      <motion.button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        /*
          No `y` on hover. Shifting the trigger made it sit a pixel out of
          line with the fields above and below it, so the form looked
          misaligned the moment the pointer crossed it. Hover is communicated
          by border and glow, which don't move anything.
        */
        whileHover={reduced ? undefined : { boxShadow: glow.neutral }}
        whileTap={reduced ? undefined : { scale: 0.995 }}
        transition={{ duration: duration.fast, ease: easing.out }}
        /*
          Deliberately borderless and transparent.

          The surrounding Grommet <FormField> already draws the border that
          every other input in the form sits inside. Drawing a second one here
          produced a doubled edge that read as a permanent focus ring — the
          date field looked selected even when it wasn't. Matching the other
          fields means owning no chrome of our own; the open state is signalled
          with a glow instead, which sits on top rather than adding an edge.
        */
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
          font: 'inherit',
          fontSize: '1rem',
          textAlign: 'left',
          cursor: 'pointer',
          // Matches Grommet's own input padding so the row height lines up.
          padding: '11px 11px',
          borderRadius: 'var(--hpe-radius-xsmall)',
          border: 'none',
          background: invalid
            ? 'var(--hpe-color-background-critical)'
            : 'transparent',
          color: value
            ? 'var(--hpe-color-text-strong)'
            : 'var(--hpe-color-text-placeholder)',
          boxShadow: open ? glow.primary : 'none',
          transition: `box-shadow ${duration.fast}s, background-color ${duration.fast}s`,
        }}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <motion.span
          animate={reduced ? undefined : { rotate: open ? -12 : 0, scale: open ? 1.1 : 1 }}
          transition={spring.snappy}
          style={{ display: 'flex' }}
        >
          <Schedule size="small" color={open ? 'var(--saip-accent)' : 'icon-weak'} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            variants={popover(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Choose a date"
            style={{
              position: 'absolute',
              zIndex: 50,
              left: 0,
              [dropUp ? 'bottom' : 'top']: 'calc(100% + 6px)',
              transformOrigin: dropUp ? 'bottom left' : 'top left',
            }}
          >
            <Box
              round="medium"
              background="background-floating"
              border={{ color: 'border-weak' }}
              elevation="large"
              pad="xsmall"
              flex={false}
            >
              {/* Calendar content settles just after the panel lands. */}
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: duration.standard, ease: easing.out, delay: 0.06 }}
              >
                <Calendar
                  size="small"
                  firstDayOfWeek={1}
                  daysOfWeek
                  date={value ? `${value}T00:00:00` : undefined}
                  bounds={[`${min}T00:00:00`, `${max}T00:00:00`]}
                  onSelect={handleSelect}
                />
              </motion.div>

              <Box
                direction="row"
                justify="between"
                align="center"
                gap="xsmall"
                pad={{ horizontal: 'xsmall', top: 'xsmall' }}
                border={{ side: 'top', color: 'border-weak' }}
              >
                <Button
                  size="small"
                  label="Today"
                  onClick={() => {
                    onChange(todayIso());
                    close();
                  }}
                />
                {clearable && (
                  <Button
                    size="small"
                    label="Clear"
                    onClick={() => {
                      onChange(null);
                      close();
                    }}
                    disabled={!value}
                  />
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Mirrors the chosen value into the form as a real date input so the
        control still participates in native form semantics and validation.
      */}
      <input type="hidden" name={id} value={value ?? ''} readOnly />
    </Box>
  );
}

/** Screen-reader-friendly summary of the current value, for use under a field. */
export function DateValueText({ value }: { value: string | null }) {
  return (
    <Text size="xsmall" color="text-weak">
      {value ? formatDate(value) : 'No date set'}
    </Text>
  );
}
