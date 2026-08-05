import { useEffect, useRef, useState } from 'react';
import { duration as motionDuration } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

/**
 * Animates a number from 0 to `target` on mount.
 *
 * Used by the score gauges and the Value Overview metrics. Driven by
 * requestAnimationFrame rather than a CSS transition because the *number text*
 * has to change, not just a visual property.
 *
 * Reduced motion returns `target` immediately — the figure is the information,
 * so it must never be withheld.
 */
export function useCountUp(target: number, enabled = true): number {
  const { reduced } = useAppMotion();
  const [value, setValue] = useState(reduced || !enabled ? target : 0);
  const frame = useRef<number>();

  useEffect(() => {
    if (reduced || !enabled) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const totalMs = motionDuration.entrance * 1000 * 2.2;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / totalMs, 1);
      // Cubic ease-out — fast start, settles gently onto the final figure.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        // Land exactly on target so no rounding drift is visible.
        setValue(target);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, reduced, enabled]);

  return value;
}
