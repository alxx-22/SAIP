import { Box, Text } from 'grommet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { IncentiveOpportunity, OpportunityStage } from '@/services';
import { formatCurrency, formatDate, daysUntil } from '@/services/derive';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

/**
 * Stage colours, from HPE semantic tokens rather than the accent.
 *
 * Open stages progress neutral → info as they advance; the two closed stages
 * use ok and critical. Deliberately semantic: whether a deal is won or lost is
 * status, not decoration, so it must not follow the user's accent choice.
 */
const STAGE_STYLE: Record<
  OpportunityStage,
  { background: string; border: string; text: string }
> = {
  Qualify: {
    background: 'var(--hpe-color-background-back)',
    border: 'var(--hpe-color-border-weak)',
    text: 'var(--hpe-color-text-weak)',
  },
  Propose: {
    background: 'var(--hpe-color-background-info)',
    border: 'var(--hpe-color-border-info)',
    text: 'var(--hpe-color-text-strong)',
  },
  Negotiate: {
    background: 'var(--hpe-color-background-warning)',
    border: 'var(--hpe-color-border-warning)',
    text: 'var(--hpe-color-text-strong)',
  },
  'Closed won': {
    background: 'var(--hpe-color-background-ok)',
    border: 'var(--hpe-color-border-ok)',
    text: 'var(--hpe-color-text-strong)',
  },
  'Closed lost': {
    background: 'var(--hpe-color-background-critical)',
    border: 'var(--hpe-color-border-critical)',
    text: 'var(--hpe-color-text-strong)',
  },
};

const OPEN_STAGES: OpportunityStage[] = ['Qualify', 'Propose', 'Negotiate'];

/**
 * Campaign code opportunities — everything raised against this incentive's code.
 *
 * A real table rather than a list of cards: these are compared column against
 * column (value against close date against stage), which is what a table is for.
 * It scrolls inside its own container so the page never scrolls sideways.
 */
export function IncentiveOpportunities({
  opportunities,
  campaignCode,
}: {
  opportunities: IncentiveOpportunity[];
  /** Null means there is no code to raise anything against. */
  campaignCode: string | null;
}) {
  const { reduced } = useAppMotion();
  const navigate = useNavigate();

  return (
    <Box gap="small">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Box direction="row" align="center" gap="small">
          <Text as="h3" size="medium" weight={600} color="text-strong" margin="none">
            Campaign code opportunities
          </Text>
          {opportunities.length > 0 && <SampleDataBadge />}
        </Box>
        {campaignCode && (
          <Text size="xsmall" color="text-weak">
            Raised against{' '}
            <Text size="xsmall" weight={600} color="text-strong">
              {campaignCode}
            </Text>
          </Text>
        )}
      </Box>

      {!campaignCode && (
        <Box
          pad="medium"
          round="small"
          background="background-back"
          border={{ color: 'border-weak' }}
        >
          <Text size="small" color="text-weak">
            This incentive has no campaign code, so there is nothing for
            opportunities to be raised against. Add a code to start tracking them.
          </Text>
        </Box>
      )}

      {campaignCode && opportunities.length === 0 && (
        <Box
          pad="medium"
          round="small"
          background="background-back"
          border={{ color: 'border-weak' }}
        >
          <Text size="small" color="text-weak">
            No opportunities have been raised against {campaignCode} yet.
          </Text>
        </Box>
      )}

      {campaignCode && opportunities.length > 0 && (
        <Box
          round="small"
          border={{ color: 'border-weak' }}
          background="background-front"
          /* The table is wider than the column on narrow viewports, so it gets
             its own scroller. Without this the whole page scrolls sideways. */
          style={{ overflowX: 'auto' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <caption className="saip-visually-hidden">
              Opportunities raised against campaign code {campaignCode}
            </caption>
            <thead>
              <tr>
                <Th>Opportunity</Th>
                <Th>Account</Th>
                <Th align="right">Value</Th>
                <Th>Stage</Th>
                <Th>Close date</Th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity, i) => (
                <motion.tr
                  key={opportunity.opportunityId}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: duration.fast,
                    ease: easing.out,
                    delay: reduced ? 0 : i * 0.04,
                  }}
                  style={{ borderTop: '1px solid var(--hpe-color-border-weak)' }}
                >
                  <Td>
                    {/* Tabular figures so the ten-digit numbers line up and a
                        mistyped one is visible at a glance. */}
                    <Text
                      size="small"
                      weight={600}
                      color="text-strong"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {opportunity.opportunityId}
                    </Text>
                    <Text size="xsmall" color="text-weak" as="div">
                      {opportunity.description}
                    </Text>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => navigate(`/account/${opportunity.accountId}`)}
                      style={{
                        font: 'inherit',
                        fontSize: '0.875rem',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        color: 'var(--saip-accent)',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      {opportunity.accountName}
                    </button>
                  </Td>
                  <Td align="right">
                    <Text
                      size="small"
                      color="text-strong"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCurrency(opportunity.value, opportunity.currency)}
                    </Text>
                  </Td>
                  <Td>
                    <StageChip stage={opportunity.stage} />
                  </Td>
                  <Td>
                    <CloseDate
                      date={opportunity.closeDate}
                      stage={opportunity.stage}
                    />
                  </Td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
}

/**
 * Close date, flagged when an OPEN opportunity is already past it.
 *
 * A closed deal with a past date is simply history and gets no flag; an open one
 * is slipping, which is the whole reason to read this column.
 */
function CloseDate({ date, stage }: { date: string; stage: OpportunityStage }) {
  const overdue = OPEN_STAGES.includes(stage) && daysUntil(date) < 0;

  return (
    <Box gap="xxsmall">
      <Text
        size="small"
        color={overdue ? 'text-strong' : 'text-weak'}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatDate(date)}
      </Text>
      {overdue && (
        <Text size="xsmall" weight={600} color="foreground-critical">
          Past close date
        </Text>
      )}
    </Box>
  );
}

function StageChip({ stage }: { stage: OpportunityStage }) {
  const s = STAGE_STYLE[stage];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        background: s.background,
        color: s.text,
        border: `1px solid ${s.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.border,
          flex: '0 0 auto',
        }}
      />
      {stage}
    </span>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: 'var(--hpe-spacing-small)',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--hpe-color-text-weak)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: 'var(--hpe-spacing-small)',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}
