import {
  SLA_TIER_COLORS,
  MEETING_TAG_COLORS,
  INCENTIVE_TYPE_COLORS,
  OPPORTUNITY_STAGE_COLORS,
} from '@/services';
import type { IncentiveType, MeetingTag, OpportunityStage, SlaTier } from '@/services';

/**
 * Colour-coded chips for SLA tiers and meeting tags.
 *
 * Both palettes live in `services/types.ts` next to the values they describe,
 * so a new tier or tag can't be added without a colour being chosen for it.
 * The label is always rendered — colour is reinforcement, never the only way to
 * tell one chip from another.
 */

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 8px',
  borderRadius: 'var(--hpe-radius-xsmall)',
  fontSize: '0.75rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  lineHeight: 1.5,
};

export function SlaChip({ sla }: { sla: SlaTier }) {
  const c = SLA_TIER_COLORS[sla];
  return (
    <span
      style={{
        ...baseStyle,
        background: c.background,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.border,
          flex: '0 0 auto',
        }}
      />
      {sla}
    </span>
  );
}

export function TagChip({ tag }: { tag: MeetingTag }) {
  const c = MEETING_TAG_COLORS[tag];
  return (
    <span
      style={{
        ...baseStyle,
        background: c.background,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.border,
          flex: '0 0 auto',
        }}
      />
      {tag}
    </span>
  );
}

export function IncentiveTypeChip({ type }: { type: IncentiveType }) {
  const c = INCENTIVE_TYPE_COLORS[type];
  return (
    <span
      style={{
        ...baseStyle,
        background: c.background,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.border,
          flex: '0 0 auto',
        }}
      />
      {type}
    </span>
  );
}

export function OpportunityStageChip({ stage }: { stage: OpportunityStage }) {
  const c = OPPORTUNITY_STAGE_COLORS[stage];
  return (
    <span
      style={{
        ...baseStyle,
        background: c.background,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.border,
          flex: '0 0 auto',
        }}
      />
      {stage}
    </span>
  );
}
