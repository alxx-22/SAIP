import { useState } from 'react';
import { Box, Text } from 'grommet';
import { AnimatePresence, motion } from 'framer-motion';
import type { Score, ScoreStatus } from '@/services';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { useCountUp } from '@/hooks/useCountUp';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

/**
 * Maps score status to HPE semantic status colours.
 * Semantic tokens only — never raw hex (brief §3, HPE colour-usage guidance).
 */
const STATUS_COLOR: Record<ScoreStatus, { fg: string; label: string }> = {
  strong: { fg: 'foreground-ok', label: 'On track' },
  watch: { fg: 'foreground-warning', label: 'Monitor' },
  attention: { fg: 'foreground-critical', label: 'Needs attention' },
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
        style={{
          transition: `box-shadow ${duration.standard}s, border-color ${duration.standard}s`,
        }}
      >
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
            reduced={reduced}
            index={index}
            needsAttention={needsAttention}
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
  reduced,
  index,
  needsAttention,
  label,
}: {
  value: number;
  display: number;
  filled: number;
  color: string;
  reduced: boolean;
  index: number;
  needsAttention: boolean;
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
        // Idle breathing for "needs attention" scores only.
        animate={needsAttention && !reduced ? { opacity: [1, 0.72, 1] } : undefined}
        transition={
          needsAttention && !reduced
            ? { duration: 2.6, ease: easing.inOut, repeat: Infinity }
            : undefined
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

  return (
    <motion.div
      animate={
        status === 'attention' && !reduced ? { opacity: [1, 0.68, 1] } : undefined
      }
      transition={
        status === 'attention' && !reduced
          ? { duration: 2.6, ease: easing.inOut, repeat: Infinity }
          : undefined
      }
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
