import { useId, useState } from 'react';
import { Box, Text } from 'grommet';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { Drag, FormNext } from 'grommet-icons';
import { duration, easing } from '@/motion/tokens';
import { canSave, type Issue } from './validation';

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
      // The solid pair, matching every other filled button — see accents.ts.
      background: 'var(--saip-accent-solid)',
      border: 'transparent',
      color: 'var(--saip-on-solid)',
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

/**
 * Save bar pinned to the bottom of an editable card.
 *
 * Edits are held as a local draft until this is pressed — nothing reaches the
 * service on a keystroke. Errors block the save and are listed in full, because
 * "Save is disabled" with no reason is the most frustrating possible state.
 * Warnings are listed too but do not block: they describe consequences for
 * existing data, which is the admin's call to make.
 */
export function SaveBar({
  issues,
  dirty,
  saving,
  saved,
  reduced,
  onSave,
  onDiscard,
  saveLabel,
}: {
  issues: Issue[];
  dirty: boolean;
  saving: boolean;
  /** Briefly true after a successful write, so the click has a visible result. */
  saved: boolean;
  reduced: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel: string;
}) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  // One definition of "is this saveable", shared with anything else that asks.
  const blocked = !canSave(issues);

  // A clean, unchanged card shows nothing at all — a permanent disabled Save on
  // every section would be noise.
  if (!dirty && !saved) return null;

  return (
    <Box
      gap="small"
      pad={{ top: 'small' }}
      border={{ side: 'top', color: 'border-weak' }}
    >
      {errors.length > 0 && (
        <Box
          pad="small"
          round="small"
          background="background-critical"
          border={{ color: 'border-critical' }}
          gap="xxsmall"
          role="alert"
        >
          <Text size="xsmall" weight={600} color="text-strong">
            {errors.length === 1
              ? 'This change cannot be saved:'
              : `${errors.length} things stop this being saved:`}
          </Text>
          {errors.map((issue, i) => (
            <Text key={i} size="xsmall" color="text-strong">
              • {issue.message}
            </Text>
          ))}
        </Box>
      )}

      {warnings.length > 0 && (
        <Box
          pad="small"
          round="small"
          background="background-warning"
          border={{ color: 'border-warning' }}
          gap="xxsmall"
        >
          <Text size="xsmall" weight={600} color="text-strong">
            Saving anyway will:
          </Text>
          {warnings.map((issue, i) => (
            <Text key={i} size="xsmall" color="text-strong">
              • {issue.message}
            </Text>
          ))}
        </Box>
      )}

      <FlexRow justify="end" gap="small">
        {saved && !dirty && (
          <Text size="xsmall" color="foreground-ok" role="status">
            Saved
          </Text>
        )}
        {dirty && (
          <>
            <AdminButton onClick={onDiscard} reduced={reduced} disabled={saving}>
              Discard
            </AdminButton>
            <AdminButton
              onClick={onSave}
              reduced={reduced}
              disabled={saving || blocked}
              tone="accent"
              title={blocked ? 'Fix the errors above first.' : undefined}
            >
              {saving ? 'Saving…' : saveLabel}
            </AdminButton>
          </>
        )}
      </FlexRow>
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

/**
 * Small status chip for a collapsed card's header.
 *
 * Exists so the closed state can still say the things you would otherwise have
 * to expand to find out — that a card has unsaved edits, that a list is matched
 * by name in code, that a section is switched off.
 */
export function StatusChip({
  tone,
  children,
}: {
  tone: 'warning' | 'info' | 'muted';
  children: React.ReactNode;
}) {
  const palette = {
    warning: {
      background: 'var(--hpe-color-background-warning)',
      color: 'var(--hpe-color-text-strong)',
      border: 'var(--hpe-color-border-warning)',
    },
    info: {
      background: 'var(--hpe-color-background-info)',
      color: 'var(--hpe-color-text-strong)',
      border: 'var(--hpe-color-border-info)',
    },
    muted: {
      background: 'var(--hpe-color-background-back)',
      color: 'var(--hpe-color-text-weak)',
      border: 'var(--hpe-color-border-weak)',
    },
  }[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: palette.background,
        color: palette.color,
        border: `1px solid ${palette.border}`,
      }}
    >
      {children}
    </span>
  );
}

/**
 * A card that is CLOSED until you open it, with actions that work either way.
 *
 * The admin screens grew to the point where Questions rendered every question
 * of every section expanded, which was several thousand pixels of form before
 * you could see what sections existed. Collapsed, the same screen is a list you
 * can read.
 *
 * WHY THE ACTIONS SIT OUTSIDE THE COLLAPSE. Delete stays reachable on a closed
 * card, because "remove this whole dropdown" is a decision you make from the
 * list, not something you should have to expand and scroll to reach. It is a
 * sibling of the toggle rather than a child of it — nesting a button inside the
 * expand button would be invalid HTML and would fire both on click.
 *
 * The body is unmounted while closed, not hidden. These cards hold draft state,
 * and keeping fifty of them mounted meant fifty live drafts and fifty
 * validation passes on every keystroke.
 */
export function CollapsibleCard({
  title,
  summary,
  badge,
  actions,
  defaultOpen = false,
  reduced,
  children,
}: {
  title: React.ReactNode;
  /** One line under the title, readable while closed. */
  summary: React.ReactNode;
  /** Optional chip shown next to the title — status, count, warning. */
  badge?: React.ReactNode;
  /** Always visible, open or closed. Delete lives here. */
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <Box
      background="background-front"
      round="medium"
      border={{ color: 'border-weak' }}
      style={{ overflow: 'hidden' }}
    >
      <FlexRow justify="between" align="center">
        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          whileHover={
            reduced ? undefined : { backgroundColor: 'var(--hpe-color-background-hover)' }
          }
          transition={{ duration: duration.fast, ease: easing.out }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: '1 1 320px',
            minWidth: 0,
            font: 'inherit',
            textAlign: 'left',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 'var(--hpe-spacing-small) var(--hpe-spacing-medium)',
          }}
        >
          <motion.span
            animate={reduced ? undefined : { rotate: open ? 90 : 0 }}
            transition={{ duration: duration.fast, ease: easing.out }}
            style={{ display: 'flex', flex: '0 0 auto' }}
            aria-hidden
          >
            <FormNext color="var(--hpe-color-icon-default)" />
          </motion.span>

          <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Text size="medium" weight={600} color="text-strong">
                {title}
              </Text>
              {badge}
            </span>
            <Text size="xsmall" color="text-weak">
              {summary}
            </Text>
          </span>
        </motion.button>

        {actions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--hpe-spacing-xsmall)',
              padding: '0 var(--hpe-spacing-medium)',
              flex: '0 0 auto',
            }}
          >
            {actions}
          </div>
        )}
      </FlexRow>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { height: 0, opacity: 0, transition: { duration: duration.exit } }
            }
            transition={{ duration: duration.standard, ease: easing.out }}
            style={{ overflow: 'hidden' }}
          >
            <Box
              pad={{ horizontal: 'medium', bottom: 'medium', top: 'small' }}
              gap="medium"
              border={{ side: 'top', color: 'border-weak' }}
            >
              {children}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

/**
 * Drag-to-reorder list.
 *
 * Built on framer-motion's `Reorder`, which is already a dependency, rather
 * than pulling in a drag-and-drop library for two lists.
 *
 * DRAGGING IS FROM A HANDLE ONLY (`dragListener={false}` plus explicit
 * `dragControls`). Every row here contains text inputs, and a row-wide drag
 * listener makes it impossible to select text in them — you reach for the
 * middle of a label and the row picks up instead.
 *
 * DRAG IS AN ENHANCEMENT, NEVER THE ONLY WAY. The Up/Down buttons stay, because
 * a pointer drag is unusable by keyboard and awkward with assistive tech. The
 * handle is `aria-hidden` for exactly that reason — announcing a control that
 * cannot be operated by keyboard is worse than not announcing it.
 *
 * `onReorder` hands back the whole list in its new order. Callers renumber
 * their own `order` field from the array index, so the stored value stays
 * dense (1, 2, 3…) rather than accumulating the gaps that repeated swapping
 * leaves behind.
 */
export function SortableList<T>({
  values,
  getKey,
  onReorder,
  reduced,
  renderItem,
}: {
  values: T[];
  getKey: (value: T) => string;
  onReorder: (next: T[]) => void;
  reduced: boolean;
  /** `handle` is the grip — place it wherever the row wants it. */
  renderItem: (value: T, index: number, handle: React.ReactNode) => React.ReactNode;
}) {
  return (
    <Reorder.Group
      axis="y"
      values={values}
      onReorder={onReorder}
      as="div"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      {values.map((value, index) => (
        <SortableRow
          key={getKey(value)}
          value={value}
          reduced={reduced}
          render={(handle) => renderItem(value, index, handle)}
        />
      ))}
    </Reorder.Group>
  );
}

function SortableRow<T>({
  value,
  reduced,
  render,
}: {
  value: T;
  reduced: boolean;
  render: (handle: React.ReactNode) => React.ReactNode;
}) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);

  const handle = (
    <span
      // Not a button: it does nothing on click or Enter, and a control that
      // only responds to a pointer drag should not be in the tab order
      // pretending otherwise. The Up/Down buttons are the accessible path.
      aria-hidden
      onPointerDown={(event) => {
        event.preventDefault();
        controls.start(event);
      }}
      title="Drag to reorder"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 28,
        flex: '0 0 auto',
        borderRadius: 'var(--hpe-radius-xsmall)',
        cursor: dragging ? 'grabbing' : 'grab',
        color: 'var(--hpe-color-icon-default)',
        // Without this a touch drag scrolls the page instead of moving the row.
        touchAction: 'none',
      }}
    >
      <Drag size="small" />
    </span>
  );

  return (
    <Reorder.Item
      value={value}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      transition={reduced ? { duration: 0 } : undefined}
      style={{
        position: 'relative',
        listStyle: 'none',
        // Lifts the dragged row clear of its neighbours' borders.
        zIndex: dragging ? 2 : 1,
      }}
      animate={{
        boxShadow: dragging ? 'var(--hpe-shadow-medium)' : 'none',
        backgroundColor: dragging
          ? 'var(--hpe-color-background-front)'
          : 'rgba(0,0,0,0)',
      }}
    >
      {render(handle)}
    </Reorder.Item>
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
