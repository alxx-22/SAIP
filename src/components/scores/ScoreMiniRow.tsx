import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService, type Score, type ScoreKey, type ScoreStatus } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonBar } from '@/components/common/Skeleton';

/**
 * The three account scores, compressed to fit on the header line.
 *
 * They used to be a full `<ScoresOverview>` section between the header and the
 * tabs, which cost about 180px of vertical space on every account — before the
 * rep had seen a single thing they could act on. Here they sit in the gap
 * between the account name and the Log a meeting button and cost nothing.
 *
 * STATUS COLOUR IS NOT THE ACCENT, and this is the one place that distinction
 * matters most. A gauge's colour MEANS something — ok, watch, attention — so it
 * stays on the semantic tokens no matter which accent is chosen. Recolouring a
 * red gauge to match a theme preference would make it stop reading as a problem.
 * Everything decorative follows `--saip-accent`; nothing that carries meaning
 * does.
 *
 * Each gauge is a button, because "my proximity score is red" and "what do I do
 * about it" should be one click apart rather than a hunt through the tabs.
 */

const STATUS: Record<ScoreStatus, { stroke: string; label: string }> = {
  strong: { stroke: 'var(--hpe-color-foreground-ok)', label: 'On track' },
  watch: { stroke: 'var(--hpe-color-foreground-warning)', label: 'Monitor' },
  attention: { stroke: 'var(--hpe-color-foreground-critical)', label: 'Needs attention' },
};

/** Short labels — the full ones do not fit at this size. */
const SHORT_LABEL: Record<ScoreKey, string> = {
  proximity: 'Proximity',
  centricity: 'Centricity',
  spend: 'Spend',
};

const SIZE = 46;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreMiniRow({
  accountId,
  onSelect,
}: {
  accountId: string;
  /** Called with the ribbon that explains the score. */
  onSelect?: (ribbon: 'monitoring' | 'value') => void;
}) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const { data, loading } = useAsync(
    () => service.getAccountScores(accountId),
    [accountId, service],
  );

  if (loading) {
    return (
      <Box direction="row" gap="small" flex={false} aria-hidden>
        <SkeletonBar height="62px" width="76px" />
        <SkeletonBar height="62px" width="76px" />
        <SkeletonBar height="62px" width="76px" />
      </Box>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Box
      direction="row"
      gap="small"
      flex={false}
      wrap
      role="group"
      aria-label="Account scores"
    >
      {data.map((score, i) => (
        <ScoreMini
          key={score.key}
          score={score}
          index={i}
          reduced={reduced}
          onSelect={
            onSelect
              ? () => onSelect(score.key === 'spend' ? 'value' : 'monitoring')
              : undefined
          }
        />
      ))}
    </Box>
  );
}

function ScoreMini({
  score,
  index,
  reduced,
  onSelect,
}: {
  score: Score;
  index: number;
  reduced: boolean;
  onSelect?: () => void;
}) {
  const status = STATUS[score.status];
  const offset = CIRCUMFERENCE * (1 - score.value / 100);

  const body = (
    <Box align="center" gap="2px" flex={false}>
      <Box style={{ position: 'relative', width: SIZE, height: SIZE }} flex={false}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden
          style={{ display: 'block', transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--hpe-color-border-weak)"
            strokeWidth={STROKE}
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={status.stroke}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={reduced ? { strokeDashoffset: offset } : { strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.7, ease: easing.out, delay: 0.1 + index * 0.06 }
            }
          />
        </svg>

        {/* Absolutely centred rather than a flex child, so the number never
            shifts the ring's geometry as it counts up in width. */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text size="small" weight={600} color="text-strong">
            {score.value}
          </Text>
        </Box>
      </Box>

      <Text size="xsmall" color="text-weak" style={{ whiteSpace: 'nowrap' }}>
        {SHORT_LABEL[score.key]}
      </Text>
    </Box>
  );

  // The accessible name carries everything the compact visual cannot: the full
  // label, the value, and what the colour is saying.
  const description = `${score.label}: ${score.value} out of 100, ${status.label}`;

  if (!onSelect) {
    return (
      <Box flex={false} title={description} aria-label={description} role="img">
        {body}
      </Box>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      title={`${description}. ${score.explainer}`}
      aria-label={`${description}. Open the section that explains it.`}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ duration: duration.fast, ease: easing.out }}
      style={{
        font: 'inherit',
        border: 'none',
        background: 'transparent',
        padding: 2,
        cursor: 'pointer',
        borderRadius: 'var(--hpe-radius-small)',
      }}
    >
      {body}
    </motion.button>
  );
}
