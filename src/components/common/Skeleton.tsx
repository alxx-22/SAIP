import { Box } from 'grommet';
import { cssDuration } from '@/motion/tokens';

/**
 * Loading skeleton with a shimmer sweep.
 *
 * The shimmer is the app's only "idle" motion during loading, per the brief.
 * `saip-shimmer` is defined in styles/global.css, where the global
 * `prefers-reduced-motion` block also neutralises it — under reduced motion the
 * bar renders as a static grey block, which still communicates "loading".
 */
export function SkeletonBar({
  height = '16px',
  width = '100%',
  round = 'xsmall',
}: {
  height?: string;
  width?: string;
  round?: string;
}) {
  return (
    <Box
      width={width}
      height={height}
      round={round}
      flex={false}
      aria-hidden
      style={{
        // A moving highlight over the standard "contrast" surface colour.
        background:
          'linear-gradient(90deg, var(--hpe-color-background-contrast) 0%, var(--hpe-color-background-front) 50%, var(--hpe-color-background-contrast) 100%)',
        backgroundSize: '800px 100%',
        animation: `saip-shimmer 1.4s ${cssDuration.fast} infinite linear`,
      }}
    />
  );
}

/**
 * Skeleton standing in for a list of rows.
 * `aria-busy` + a polite status message keeps assistive tech informed rather
 * than announcing a wall of empty boxes.
 */
export function SkeletonRows({
  rows = 5,
  height = '68px',
  label = 'Loading',
}: {
  rows?: number;
  height?: string;
  label?: string;
}) {
  return (
    <Box gap="xsmall" aria-busy="true" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBar key={i} height={height} round="small" />
      ))}
    </Box>
  );
}
