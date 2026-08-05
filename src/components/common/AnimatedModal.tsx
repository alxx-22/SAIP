import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Box } from 'grommet';
import { modalBackdrop, modalPanel } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Portal-rendered modal with entrance/exit animation and a focus trap.
 *
 * Built rather than using Grommet's <Layer> because `AnimatePresence` can only
 * await exit animations from a direct `motion` child — wrapping Layer would
 * silently drop the exit animation the brief requires. This keeps Layer's
 * useful behaviours (focus trap, Esc, click-outside, scroll lock) and adds
 * full control over the motion.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, labelled by its own heading,
 * focus moved in on open and restored to the trigger on close, Tab cycles
 * within the dialog, Escape closes.
 */
export function AnimatedModal({
  open,
  onClose,
  labelledBy,
  children,
  width = '640px',
}: {
  open: boolean;
  onClose: () => void;
  /** id of the element naming this dialog. */
  labelledBy: string;
  children: ReactNode;
  width?: string;
}) {
  const { reduced } = useAppMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Remember the trigger so focus can go back where it came from.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    } else {
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  // Move focus into the dialog once it exists.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Prevent the page behind the modal from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="saip-modal-backdrop"
          variants={modalBackdrop(reduced)}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--hpe-spacing-medium)',
            background: 'var(--hpe-color-background-screenOverlay)',
          }}
        >
          <motion.div
            key="saip-modal-panel"
            ref={panelRef}
            variants={modalPanel(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            // Clicks inside must not reach the backdrop's close handler.
            onClick={(e) => e.stopPropagation()}
            style={{
              width,
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'flex',
              outline: 'none',
            }}
          >
            <Box
              round="medium"
              background="background-front"
              elevation="large"
              overflow="hidden"
              fill="horizontal"
            >
              {children}
            </Box>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
