import { useState } from 'react';
import { Box, Text } from 'grommet';
import { AnimatePresence, motion } from 'framer-motion';
import type { Score, ScoreStatus } from '@/services';
import { duration, easing, glow, spring, svgGlow } from '@/motion/tokens';
import { sweep } from '@/motion/variants';
import { useAppMotion } from '@/motion/useAppMotion';
import { useCountUp } from '@/hooks/useCountUp';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

/**
 * Maps score status to HPE semantic status colours.
 * Semantic tokens only — never raw hex (brief §3, HPE colour-usage guidance).
 */
const STATUS_COLOR: Record<
  ScoreStatus,
  { fg: string; label: string; glow: keyof typeof glow; svg: string }
> = {
  strong: { fg: 'foreground-ok', label: 'On track', glow: 'ok', svg: svgGlow.ok },
  watch: {
    fg: 'foreground-warning',
    label: 'Monitor',
    glow: 'warning',
    svg: svgGlow.warning,
  },
  attention: {
    fg: 'foreground-critical',
    label: 'Needs attention',
    glow: 'critical',
    svg: svgGlow.critical,
  },
};

const GAUGE_SIZE = 132;
const STROKE = 10;
const RADIUS = (GAUGE_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A single score summary card with a radial gauge.
 *
 * Motion, per brief §7.2:
 *  - entrance: the gauge fills from zero while the number counts up
 *  - idle:     scores in `attention` breathe gently — a flag, not a distraction
 *  - hover:    the card lifts and reveals a one-line explainer
 *
 * All three collapse to static under `prefers-reduced-motion`, with the
 * explainer switching from hover-reveal to always-visible so the information
 * is never gated behind an animation.
 */
export function ScoreCard({ score, index }: { score: Score; index: number }) {
  const { reduced } = useAppMotion();
  const [hovered, setHovered] = useState(false);
  const displayValue = useCountUp(score.value);
  const status = STATUS_COLOR[score.status];
  const needsAttention = score.status === 'attention';
  const sweepProps = sweep(reduced, index * 0.09);

  // Stroke offset drives the arc; full circumference = empty gauge.
  const filled = CIRCUMFERENCE * (1 - score.value / 100);

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={reduced ? undefined : { y: -4 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{ flex: '1 1 260px', minWidth: 260 }}
    >
      <Box
        pad="medium"
        round="medium"
        background="background-front"
        border={{ color: hovered ? 'border-default' : 'border-weak' }}
        elevation={hovered && !reduced ? 'medium' : 'small'}
        gap="small"
        fill="vertical"
        // The card is a figure, not an interactive control — no tabindex.
        /*
          NOT `overflow: hidden`. Clipping the card squared off the gauge's
          drop-shadow glow into a visible box. The sweep gets its own clipped
          layer below instead, so it stays inside the card while the glow is
          free to bleed past the edge.
        */
        style={{
          position: 'relative',
          boxShadow: hovered && !reduced ? glow[status.glow] : undefined,
          transition: `box-shadow ${duration.standard}s, border-color ${duration.standard}s`,
        }}
      >
        {/* One-shot light sweep as the card arrives, clipped to the card. */}
        {sweepProps && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              borderRadius: 'var(--hpe-radius-medium)',
              pointerEvents: 'none',
            }}
          >
            <motion.span
              {...sweepProps}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '55%',
                background:
                  'linear-gradient(100deg, transparent, var(--hpe-color-background-contrast), transparent)',
                opacity: 0.55,
              }}
            />
          </span>
        )}

        <Box direction="row" justify="between" align="start" gap="xsmall">
          <Text size="medium" weight={600} color="text-strong">
            {score.label}
          </Text>
          {/* PLACEHOLDER DATA marker — score values are invented. */}
          <SampleDataBadge />
        </Box>

        <Box direction="row" align="center" gap="medium">
          <Gauge
            value={score.value}
            display={displayValue}
            filled={filled}
            color={status.fg}
            svgGlowFilter={status.svg}
            reduced={reduced}
            index={index}
            needsAttention={needsAttention}
            hovered={hovered}
            label={score.label}
          />

          <Box gap="xsmall">
            <StatusPill status={score.status} reduced={reduced} />
            <DeltaText delta={score.deltaPoints} />
          </Box>
        </Box>

        {/* Explainer: hover-revealed with motion, always shown without it. */}
        <AnimatePresence initial={false}>
          {(hovered || reduced) && (
            <motion.div
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={
                reduced
                  ? undefined
                  : {
                      opacity: 0,
                      height: 0,
                      transition: { duration: duration.exit, ease: easing.in },
                    }
              }
              transition={{ duration: duration.standard, ease: easing.out }}
              style={{ overflow: 'hidden' }}
            >
              <Text size="small" color="text-weak">
                {score.explainer}
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </motion.div>
  );
}

/** Radial gauge. The arc animates from empty; the number counts up alongside. */
function Gauge({
  value,
  display,
  filled,
  color,
  svgGlowFilter,
  reduced,
  index,
  needsAttention,
  hovered,
  label,
}: {
  value: number;
  display: number;
  filled: number;
  color: string;
  svgGlowFilter: string;
  reduced: boolean;
  index: number;
  needsAttention: boolean;
  hovered: boolean;
  label: string;
}) {
  return (
    <Box
      flex={false}
      style={{ position: 'relative', width: GAUGE_SIZE, height: GAUGE_SIZE }}
      role="img"
      aria-label={`${label}: ${Math.round(value)} out of 100`}
    >
      <motion.svg
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        // "Needs attention" is a smooth fade in / fade out pulse — no scaling,
        // no flash. Symmetric easing over a long cycle so it breathes rather
        // than blinks.
        animate={
          needsAttention && !reduced
            ? { opacity: [1, 0.45, 1] }
            : { opacity: 1, scale: hovered && !reduced ? 1.04 : 1 }
        }
        transition={
          needsAttention && !reduced
            ? { duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
            : spring.snappy
        }
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--hpe-color-border-weak)"
          strokeWidth={STROKE}
        />
        {/* Value arc */}
        <motion.circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`var(--hpe-color-${color})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          // Coloured glow on the value arc, matching the status colour.
          style={{ filter: svgGlowFilter }}
          initial={{ strokeDashoffset: reduced ? filled : CIRCUMFERENCE }}
          animate={{ strokeDashoffset: filled }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  duration: duration.entrance * 2.2,
                  ease: easing.out,
                  // Stagger gauges so three don't fill in lockstep.
                  delay: index * 0.09,
                }
          }
        />
      </motion.svg>

      <Box
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text size="xxlarge" weight={600} color="text-strong">
          {Math.round(display)}
        </Text>
        <Text size="xsmall" color="text-weak">
          out of 100
        </Text>
      </Box>
    </Box>
  );
}

/** Status pill. Pulses softly when attention is needed. */
function StatusPill({ status, reduced }: { status: ScoreStatus; reduced: boolean }) {
  const meta = STATUS_COLOR[status];
  const background =
    status === 'strong'
      ? 'background-ok'
      : status === 'watch'
        ? 'background-warning'
        : 'background-critical';

  const pulsing = status === 'attention' && !reduced;

  return (
    <motion.div
      // Attention pills fade in and out in step with the gauge; the others
      // carry a static glow.
      animate={pulsing ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
      transition={
        pulsing
          ? { duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
          : { duration: duration.standard }
      }
      style={{
        boxShadow: glow[meta.glow],
        borderRadius: 'var(--hpe-radius-xsmall)',
        alignSelf: 'flex-start',
      }}
    >
      <Box
        pad={{ horizontal: 'small', vertical: '2px' }}
        round="xsmall"
        background={background}
        flex={false}
        alignSelf="start"
      >
        <Text size="xsmall" weight={600} color="text-strong">
          {meta.label}
        </Text>
      </Box>
    </motion.div>
  );
}

/** Period-over-period movement in points. */
function DeltaText({ delta }: { delta: number }) {
  const rising = delta > 0;
  const flat = delta === 0;
  return (
    <Text
      size="small"
      color={flat ? 'text-weak' : rising ? 'text-ok' : 'text-critical'}
    >
      {flat ? 'No change' : `${rising ? '▲' : '▼'} ${Math.abs(delta)} pts`}
      <Text size="xsmall" color="text-weak">
        {' '}
        vs. last period
      </Text>
    </Text>
  );
}
