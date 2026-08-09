import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useAccountService, type Score, type ScoreKey, type ScoreStatus } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonBar } from '@/components/common/Skeleton';

/**
 * The three account scores, compressed onto the header line.
 *
 * They used to be a full `<ScoresOverview>` section between the header and the
 * tabs, costing ~180px on every account before the rep saw anything they could
 * act on. Here they sit centred in the gap between the account name and the
 * Log a meeting button and cost nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ARC IS SCALED IN THE SELECTED ACCENT, NOT THE STATUS RAMP
 *
 * Asked for directly, and it does make the header read as one thing rather than
 * a traffic light bolted onto a themed page. It is worth being explicit about
 * the trade, because everywhere else in this app colour that MEANS something
 * stays semantic:
 *
 *   - The arc encodes MAGNITUDE, twice over — by how far it sweeps, and by how
 *     saturated it is. A weak score is a short, pale arc; a strong one is a
 *     long, saturated one. That is a sequential scale, which is the honest
 *     encoding for a 0–100 number.
 *   - The STATUS — on track / monitor / needs attention — is still carried, by
 *     a semantic dot beside the label and by the accessible name. It is no
 *     longer carried by the arc.
 *
 * So nothing is lost, but the thing that shouts is now magnitude rather than
 * status. If a rep ever needs "which of my accounts is red" to be visible from
 * across the room, the dot is the part to make bigger — not the arc.
 *
 * `color-mix` does the scaling, so it works for any accent without a hand-built
 * ramp per colour. The SVG carries a plain `stroke` ATTRIBUTE as well: a browser
 * that does not know `color-mix` drops the style declaration and falls back to
 * the flat accent rather than to nothing.
 */

/** Semantic status, still shown — as a dot, not as the arc. */
const STATUS: Record<ScoreStatus, { color: string; label: string }> = {
  strong: { color: 'var(--hpe-color-foreground-ok)', label: 'On track' },
  watch: { color: 'var(--hpe-color-foreground-warning)', label: 'Monitor' },
  attention: { color: 'var(--hpe-color-foreground-critical)', label: 'Needs attention' },
};

/** Short labels — the full ones do not fit at this size. */
const SHORT_LABEL: Record<ScoreKey, string> = {
  proximity: 'Proximity',
  centricity: 'Centricity',
  spend: 'Spend',
};

const SIZE = 52;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How much accent to mix in at a given score.
 *
 * Floored at 40% so a poor score is still clearly drawn — a scale that fades to
 * nothing would make the worst number the hardest one to see.
 */
function arcColor(value: number): string {
  const strength = Math.round(40 + (Math.max(0, Math.min(100, value)) / 100) * 60);
  return `color-mix(in oklab, var(--saip-accent) ${strength}%, var(--hpe-color-border-default))`;
}

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
        <SkeletonBar height="72px" width="84px" />
        <SkeletonBar height="72px" width="84px" />
        <SkeletonBar height="72px" width="84px" />
      </Box>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Box
      direction="row"
      gap="medium"
      flex={false}
      wrap
      justify="center"
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
    <Box align="center" gap="3px" flex={false}>
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
            /* Attribute = fallback, style = the scaled colour. A browser without
               `color-mix` drops the style and still draws the flat accent. */
            stroke="var(--saip-accent)"
            style={{ stroke: arcColor(score.value) }}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={
              reduced ? { strokeDashoffset: offset } : { strokeDashoffset: CIRCUMFERENCE }
            }
            animate={{ strokeDashoffset: offset }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.7, ease: easing.out, delay: 0.1 + index * 0.06 }
            }
          />
        </svg>

        {/* Absolutely centred rather than a flex child, so the number never
            shifts the ring's geometry as its width changes. */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text size="medium" weight={600} color="text-strong">
            {score.value}
          </Text>
        </Box>
      </Box>

      {/* The status the arc no longer carries. Dot plus label, so it is legible
          without relying on colour alone. */}
      <Box direction="row" align="center" gap="4px" flex={false}>
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: status.color,
            flex: '0 0 auto',
          }}
        />
        <Text size="xsmall" color="text-weak" style={{ whiteSpace: 'nowrap' }}>
          {SHORT_LABEL[score.key]}
        </Text>
      </Box>
    </Box>
  );

  // The accessible name carries everything the compact visual cannot.
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
