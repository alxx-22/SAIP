import { useEffect, useMemo, useState } from 'react';
import { Box, Button, FormField, Text, TextInput } from 'grommet';
import { Checkmark, CircleAlert, StatusGoodSmall } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useAccountService, type AccountMonitoring } from '@/services';
import {
  MONITORING_OVERDUE_MONTHS,
  formatRelative,
  heldWithinLastYear,
  isOverdue,
  todayIso,
} from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { confirmPop, staggerContainer, staggerItem } from '@/motion/variants';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { SkeletonRows } from '@/components/common/Skeleton';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

type SaveState = 'idle' | 'saving' | 'saved';

/**
 * Ribbon C — Account Monitoring (brief §7.3).
 *
 * An editable form the salesperson uses to keep relationship-health data
 * current, in two sections. Saves through the same swappable service layer.
 *
 * Motion: fields fade in per section; a checkmark micro-animation plays on
 * save; fields that are overdue carry a soft, persistent visual flag rather
 * than an animation — an overdue state can last for months, so animating it
 * would be a permanent distraction.
 */
export function AccountMonitoringRibbon({ accountId }: { accountId: string }) {
  const service = useAccountService();
  const { reduced } = useAppMotion();

  const { data, loading, error } = useAsync(
    () => service.getAccountMonitoring(accountId),
    [accountId, service],
  );

  const [draft, setDraft] = useState<AccountMonitoring | null>(null);
  /**
   * The last-persisted record. `dirty` compares the draft against this rather
   * than against `data`, so a successful save can update the baseline without
   * refetching — which is also what keeps the save confirmation on screen.
   */
  const [baseline, setBaseline] = useState<AccountMonitoring | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed the editable draft once the record arrives, and re-seed when the
  // account changes.
  useEffect(() => {
    if (!data) return;
    setDraft(data);
    setBaseline(data);
    setSaveState('idle');
    setSaveError(null);
  }, [data]);

  const dirty = useMemo(
    () => Boolean(draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline)),
    [draft, baseline],
  );

  if (loading || !draft) {
    return <SkeletonRows rows={6} height="56px" label="Loading account monitoring" />;
  }

  if (error) {
    return (
      <Box pad="medium" round="medium" background="background-critical" role="alert">
        <Text size="small" color="text-strong">
          Couldn’t load account monitoring. {error.message}
        </Text>
      </Box>
    );
  }

  function setProximity(key: keyof AccountMonitoring['customerProximity'], value: string) {
    setDraft((d) =>
      d
        ? { ...d, customerProximity: { ...d.customerProximity, [key]: value || null } }
        : d,
    );
    setSaveState('idle');
  }

  function setCentricity(
    key: keyof AccountMonitoring['customerCentricity'],
    value: string,
  ) {
    setDraft((d) =>
      d
        ? { ...d, customerCentricity: { ...d.customerCentricity, [key]: value || null } }
        : d,
    );
    setSaveState('idle');
  }

  async function handleSave() {
    if (!draft || saveState === 'saving') return;
    setSaveState('saving');
    setSaveError(null);
    try {
      // The service returns the persisted record (with its updated audit
      // fields), so it becomes both the new draft and the new baseline — no
      // refetch needed, and the form is clean again immediately.
      const saved = await service.saveAccountMonitoring(draft);
      setDraft(saved);
      setBaseline(saved);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2600);
    } catch (err) {
      setSaveState('idle');
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const workshopHeldRecently = heldWithinLastYear(draft.customerProximity.lastWorkshop);

  return (
    <Box gap="medium">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Text size="small" color="text-weak">
          Keep these dates current — they feed the Customer Proximity and Customer
          Centricity scores.
        </Text>
        {/* PLACEHOLDER DATA — seeded dates are invented. */}
        <SampleDataBadge />
      </Box>

      <motion.div
        variants={staggerContainer(reduced)}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gap: 'var(--hpe-spacing-medium)' }}
      >
        {/* ── Customer Proximity ─────────────────────────────────────────── */}
        <motion.div variants={staggerItem(reduced)}>
          <Section title="Customer Proximity">
            <DateField
              id="mon-stakeholder-meeting"
              label="Last meeting with key stakeholders"
              value={draft.customerProximity.lastStakeholderMeeting}
              onChange={(v) => setProximity('lastStakeholderMeeting', v)}
            />

            <DateField
              id="mon-workshop"
              label="Last workshop held"
              value={draft.customerProximity.lastWorkshop}
              onChange={(v) => setProximity('lastWorkshop', v)}
              // Derived flag required by the brief: held in the last 12 months?
              derived={
                <DerivedFlag
                  ok={workshopHeldRecently}
                  okLabel="Workshop held in the last 12 months"
                  notOkLabel={
                    draft.customerProximity.lastWorkshop
                      ? 'No workshop in the last 12 months'
                      : 'No workshop recorded'
                  }
                />
              }
            />

            <DateField
              id="mon-spend-review"
              label="Last spend review / SLA review with customer"
              value={draft.customerProximity.lastSpendOrSlaReview}
              onChange={(v) => setProximity('lastSpendOrSlaReview', v)}
            />
          </Section>
        </motion.div>

        {/* ── Customer Centricity ────────────────────────────────────────── */}
        <motion.div variants={staggerItem(reduced)}>
          <Section title="Customer Centricity">
            <DateField
              id="mon-customer-visit"
              label="Last visit to customer"
              value={draft.customerCentricity.lastCustomerVisit}
              onChange={(v) => setCentricity('lastCustomerVisit', v)}
            />

            <DateField
              id="mon-performance-review"
              label="Last performance review with customer"
              value={draft.customerCentricity.lastPerformanceReview}
              onChange={(v) => setCentricity('lastPerformanceReview', v)}
            />

            {/*
              PLACEHOLDER FIELDS — names not final.
              The brief asked to leave room for 1–2 more fields "in the same
              spirit" and explicitly not to invent definitive names, so both
              carry a visible "Field name TBC" marker for the account team to
              confirm or rename. See README placeholder checklist.
            */}
            <DateField
              id="mon-exec-engagement"
              label="Last executive engagement"
              value={draft.customerCentricity.lastExecutiveEngagement}
              onChange={(v) => setCentricity('lastExecutiveEngagement', v)}
              provisional
            />

            <DateField
              id="mon-sponsor-review"
              label="Last service review with executive sponsor"
              value={draft.customerCentricity.lastServiceReviewWithSponsor}
              onChange={(v) => setCentricity('lastServiceReviewWithSponsor', v)}
              provisional
            />
          </Section>
        </motion.div>
      </motion.div>

      {saveError && (
        <Box pad="small" round="small" background="background-critical" role="alert">
          <Text size="small" color="text-strong">
            Couldn’t save. {saveError}
          </Text>
        </Box>
      )}

      {/* ── Save bar ─────────────────────────────────────────────────────── */}
      <Box
        direction="row"
        align="center"
        justify="between"
        gap="small"
        pad={{ top: 'small' }}
        border={{ side: 'top', color: 'border-weak' }}
        wrap
      >
        <Text size="xsmall" color="text-weak">
          {draft.lastUpdatedAt
            ? `Last updated ${formatRelative(draft.lastUpdatedAt)}${draft.lastUpdatedBy ? ` by ${draft.lastUpdatedBy}` : ''}`
            : 'Never updated'}
        </Text>

        <Box direction="row" align="center" gap="small">
          <AnimatePresence>
            {saveState === 'saved' && (
              <motion.div
                key="saved"
                variants={confirmPop(reduced)}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Box
                  direction="row"
                  align="center"
                  gap="xsmall"
                  pad={{ horizontal: 'small', vertical: '4px' }}
                  round="xsmall"
                  background="background-ok"
                  role="status"
                >
                  <Checkmark size="small" color="icon-ok" />
                  <Text size="small" weight={600} color="text-strong">
                    Saved
                  </Text>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            primary
            label={saveState === 'saving' ? 'Saving…' : 'Save changes'}
            onClick={handleSave}
            disabled={!dirty || saveState === 'saving'}
          />
        </Box>
      </Box>
    </Box>
  );
}

/** A titled group of related fields. `<h3>` sits correctly under the ribbon `<h2>`. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      pad="medium"
      round="medium"
      background="background-front"
      border={{ color: 'border-weak' }}
      gap="small"
    >
      <Text as="h3" size="medium" weight={600} color="text-strong" margin="none">
        {title}
      </Text>
      <Box gap="small">{children}</Box>
    </Box>
  );
}

/**
 * A labelled date field with an overdue flag.
 *
 * Every field gets a real <label> bound by htmlFor/id — the brief calls this
 * out specifically for this form. The overdue state is communicated by an icon
 * and text, not colour alone.
 */
function DateField({
  id,
  label,
  value,
  onChange,
  derived,
  provisional,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  derived?: React.ReactNode;
  /** Marks a field whose name the account team has not yet confirmed. */
  provisional?: boolean;
}) {
  const overdue = isOverdue(value);

  return (
    <Box gap="xxsmall">
      <FormField
        label={
          <Box direction="row" align="center" gap="xsmall" wrap>
            <Text size="small" weight={500} color="text-strong">
              {label}
            </Text>
            {provisional && (
              <Box
                pad={{ horizontal: 'xsmall', vertical: '1px' }}
                round="xsmall"
                background="background-info"
                flex={false}
              >
                <Text size="xsmall" color="text-strong">
                  Field name TBC
                </Text>
              </Box>
            )}
          </Box>
        }
        htmlFor={id}
        name={id}
        contentProps={{ border: undefined }}
      >
        <TextInput
          id={id}
          name={id}
          type="date"
          max={todayIso()}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>

      <Box direction="row" align="center" gap="small" wrap>
        <Text size="xsmall" color="text-weak">
          {formatRelative(value)}
        </Text>

        {/* Soft persistent overdue flag — static by design, not animated. */}
        {overdue && (
          <Box direction="row" align="center" gap="4px">
            <CircleAlert size="small" color="icon-warning" />
            <Text size="xsmall" color="text-warning">
              {value
                ? `Overdue — more than ${MONITORING_OVERDUE_MONTHS} months ago`
                : 'Not recorded yet'}
            </Text>
          </Box>
        )}

        {derived}
      </Box>
    </Box>
  );
}

/** Derived yes/no indicator, e.g. "workshop held in the last 12 months?". */
function DerivedFlag({
  ok,
  okLabel,
  notOkLabel,
}: {
  ok: boolean;
  okLabel: string;
  notOkLabel: string;
}) {
  return (
    <Box
      direction="row"
      align="center"
      gap="4px"
      pad={{ horizontal: 'xsmall', vertical: '2px' }}
      round="xsmall"
      background={ok ? 'background-ok' : 'background-warning'}
      flex={false}
      style={{ transition: `background-color ${duration.standard}s ${easing.inOut}` }}
    >
      {ok ? (
        <StatusGoodSmall size="small" color="icon-ok" />
      ) : (
        <CircleAlert size="small" color="icon-warning" />
      )}
      <Text size="xsmall" weight={500} color="text-strong">
        {ok ? okLabel : notOkLabel}
      </Text>
    </Box>
  );
}
