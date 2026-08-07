import { useEffect, useId, useState } from 'react';
import { Box, Text } from 'grommet';
import { Checkmark, Close } from 'grommet-icons';
import { motion } from 'framer-motion';
import {
  INCENTIVE_TYPES,
  useAccountService,
  type Account,
  type IncentiveDraft,
  type IncentiveType,
} from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { AnimatedModal } from '@/components/common/AnimatedModal';
import { DatePicker } from '@/components/common/DatePicker';
import { IncentiveTypeChip } from '@/components/common/ColorChip';
import { duration, easing, spring } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { todayIso } from '@/services/derive';

/**
 * Create a new incentive.
 *
 * Resources and opportunities are deliberately NOT on this form. An upload needs
 * a saved record to attach to, and an opportunity is raised in the CRM against
 * the campaign code rather than typed here — so both are things you add to an
 * incentive after it exists, not fields you fill in to create one.
 */
export function IncentiveFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful save so the list can refresh. */
  onCreated: () => void;
}) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const headingId = useId();

  const { data: accounts } = useAsync(() => service.getAccounts(), [service]);

  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [campaignCode, setCampaignCode] = useState('');
  const [type, setType] = useState<IncentiveType>('Upsell');
  const [startDate, setStartDate] = useState<string | null>(todayIso());
  const [endDate, setEndDate] = useState<string | null>(null);
  const [nominated, setNominated] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset when the modal is reopened, so a cancelled draft doesn't come back.
  useEffect(() => {
    if (open) return;
    setTitle('');
    setOverview('');
    setCampaignCode('');
    setType('Upsell');
    setStartDate(todayIso());
    setEndDate(null);
    setNominated([]);
    setSubmitted(false);
    setSaving(false);
    setSaved(false);
  }, [open]);

  const titleInvalid = submitted && title.trim().length === 0;
  const overviewInvalid = submitted && overview.trim().length === 0;
  const startInvalid = submitted && !startDate;
  // An end date before the start would create an incentive that is historical
  // the moment it is saved.
  const endInvalid = Boolean(startDate && endDate && endDate < startDate);
  const valid =
    title.trim().length > 0 && overview.trim().length > 0 && !!startDate && !endInvalid;

  async function submit() {
    setSubmitted(true);
    if (!valid || !startDate) return;

    setSaving(true);
    const draft: IncentiveDraft = {
      title: title.trim(),
      overview: overview.trim(),
      // Empty string is not "no code" — normalise it so the detail view can
      // rely on null meaning exactly one thing.
      campaignCode: campaignCode.trim() ? campaignCode.trim().toUpperCase() : null,
      type,
      startDate,
      endDate,
      nominatedAccountIds: nominated,
      // Assignment happens on the incentive's own page, once it exists — the
      // same reasoning as resources and opportunities.
      assignedUserIds: [],
      assignedRoleIds: [],
    };
    await service.createIncentive(draft);
    setSaving(false);
    setSaved(true);
    onCreated();
    window.setTimeout(onClose, reduced ? 300 : 900);
  }

  return (
    <AnimatedModal open={open} onClose={onClose} labelledBy={headingId} width="720px">
      <Box pad="medium" gap="medium">
        <Box direction="row" align="start" justify="between" gap="small">
          <Box gap="xxsmall">
            <Text id={headingId} as="h2" size="large" weight={600} color="text-strong">
              New incentive
            </Text>
            <Text size="small" color="text-weak">
              Documents and opportunities are added after it exists.
            </Text>
          </Box>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'inline-flex',
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--hpe-radius-xsmall)',
              border: '1px solid var(--hpe-color-border-weak)',
              background: 'transparent',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <Close size="small" />
          </button>
        </Box>

        <Field label="Title" required invalid={titleInvalid} hint="What the incentive is called.">
          {(id) => (
            <TextField
              id={id}
              value={title}
              onChange={setTitle}
              invalid={titleInvalid}
              placeholder="e.g. Complete Care attach on renewal"
            />
          )}
        </Field>

        <Field
          label="Overview"
          required
          invalid={overviewInvalid}
          hint="What it is for and who it is aimed at."
        >
          {(id) => (
            <textarea
              id={id}
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              rows={4}
              style={{
                font: 'inherit',
                fontSize: '0.875rem',
                width: '100%',
                resize: 'vertical',
                padding: 'var(--hpe-spacing-small)',
                borderRadius: 'var(--hpe-radius-small)',
                background: 'var(--hpe-color-background-front)',
                color: 'var(--hpe-color-text-default)',
                border: `1px solid var(--hpe-color-border-${overviewInvalid ? 'critical' : 'weak'})`,
              }}
            />
          )}
        </Field>

        <Box direction="row" gap="medium" wrap>
          <Box flex="grow" style={{ minWidth: 220 }}>
            <Field
              label="Campaign code"
              hint="Optional. Opportunities are raised against this."
            >
              {(id) => (
                <TextField
                  id={id}
                  value={campaignCode}
                  onChange={setCampaignCode}
                  placeholder="e.g. CC-ATTACH-Q3"
                />
              )}
            </Field>
          </Box>
        </Box>

        <Box gap="xsmall">
          <Text size="small" weight={600} color="text-strong">
            Purpose
          </Text>
          {/*
            Plain flex + CSS gap, NOT Grommet's <Box gap>. Grommet renders gap as
            real spacer <div>s, and on a wrapping row those spacers overlay the
            controls — elementFromPoint at the centre of a chip returned the
            spacer, not the button, so the chip could not be clicked at all.
            CSS gap creates no elements and cannot intercept anything.
          */}
          <div
            role="radiogroup"
            aria-label="Purpose"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--hpe-spacing-xsmall)',
            }}
          >
            {INCENTIVE_TYPES.map((option) => {
              const selected = type === option;
              return (
                <motion.button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(option)}
                  whileHover={reduced ? undefined : { y: -1 }}
                  transition={{ duration: duration.fast, ease: easing.out }}
                  style={{
                    padding: 4,
                    borderRadius: 'var(--hpe-radius-small)',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: selected
                      ? '2px solid var(--saip-accent)'
                      : '2px solid transparent',
                  }}
                >
                  <IncentiveTypeChip type={option} />
                </motion.button>
              );
            })}
          </div>
        </Box>

        <Box direction="row" gap="medium" wrap>
          <Box flex="grow" style={{ minWidth: 200 }}>
            <Field label="Start date" required invalid={startInvalid}>
              {(id) => (
                <DatePicker
                  id={id}
                  value={startDate}
                  onChange={setStartDate}
                  // Incentives are scheduled forward, unlike the "last X"
                  // monitoring fields the picker defaults to.
                  max="2100-01-01"
                  clearable={false}
                  invalid={startInvalid}
                />
              )}
            </Field>
          </Box>
          <Box flex="grow" style={{ minWidth: 200 }}>
            <Field
              label="End date"
              hint="Leave empty for open-ended."
              invalid={endInvalid}
              error={endInvalid ? 'End date must be on or after the start date.' : undefined}
            >
              {(id) => (
                <DatePicker
                  id={id}
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate ?? '1990-01-01'}
                  max="2100-01-01"
                  invalid={endInvalid}
                />
              )}
            </Field>
          </Box>
        </Box>

        <Box gap="xsmall">
          <Text size="small" weight={600} color="text-strong">
            Nominated accounts
          </Text>
          <Text size="xsmall" color="text-weak">
            {nominated.length === 0
              ? 'None selected. You can nominate accounts later.'
              : `${nominated.length} selected`}
          </Text>
          <Box
            gap="xxsmall"
            pad="xsmall"
            round="small"
            border={{ color: 'border-weak' }}
            background="background-back"
            style={{ maxHeight: 180, overflowY: 'auto' }}
          >
            {(accounts ?? []).map((account: Account) => {
              const checked = nominated.includes(account.accountId);
              return (
                <label
                  key={account.accountId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--hpe-spacing-xsmall)',
                    padding: '4px 6px',
                    borderRadius: 'var(--hpe-radius-xsmall)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setNominated((current) =>
                        e.target.checked
                          ? [...current, account.accountId]
                          : current.filter((id) => id !== account.accountId),
                      )
                    }
                  />
                  <Text size="small" color="text-strong">
                    {account.accountName}
                  </Text>
                  <Text size="xsmall" color="text-weak">
                    {account.region}
                  </Text>
                </label>
              );
            })}
          </Box>
        </Box>

        <Box direction="row" gap="small" justify="end" align="center">
          {submitted && !valid && (
            <Text size="small" color="foreground-critical" role="alert">
              Fill in the required fields.
            </Text>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              font: 'inherit',
              fontSize: '0.875rem',
              padding: '10px 16px',
              borderRadius: 'var(--hpe-radius-medium)',
              border: '1px solid var(--hpe-color-border-strong)',
              background: 'transparent',
              color: 'var(--hpe-color-text-strong)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <motion.button
            type="button"
            onClick={submit}
            disabled={saving || saved}
            whileHover={saving || saved || reduced ? undefined : { y: -2 }}
            transition={reduced ? { duration: 0 } : spring.snappy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              font: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 500,
              padding: '10px 20px',
              borderRadius: 'var(--hpe-radius-medium)',
              border: 'none',
              background: saved
                ? 'var(--hpe-color-background-ok)'
                : 'var(--saip-accent)',
              // Matches the Log a meeting button: white on the accent.
              color: saved ? 'var(--hpe-color-text-strong)' : 'var(--hpe-base-color-white)',
              cursor: saving || saved ? 'default' : 'pointer',
            }}
          >
            {saved && <Checkmark size="small" />}
            {saved ? 'Created' : saving ? 'Creating…' : 'Create incentive'}
          </motion.button>
        </Box>
      </Box>
    </AnimatedModal>
  );
}

/** Label + hint + error wrapper. Generates the id so label/control always agree. */
function Field({
  label,
  hint,
  error,
  required,
  invalid,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  invalid?: boolean;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <Box gap="xxsmall" fill="horizontal">
      <label htmlFor={id}>
        <Text size="small" weight={600} color="text-strong">
          {label}
          {required && (
            <Text size="small" color="foreground-critical">
              {' '}
              *
            </Text>
          )}
        </Text>
      </label>
      {hint && (
        <Text size="xsmall" color="text-weak">
          {hint}
        </Text>
      )}
      {children(id)}
      {invalid && error && (
        <Text size="xsmall" color="foreground-critical" role="alert">
          {error}
        </Text>
      )}
    </Box>
  );
}

function TextField({
  id,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        font: 'inherit',
        fontSize: '0.875rem',
        width: '100%',
        padding: 'var(--hpe-spacing-small)',
        borderRadius: 'var(--hpe-radius-small)',
        background: 'var(--hpe-color-background-front)',
        color: 'var(--hpe-color-text-default)',
        border: `1px solid var(--hpe-color-border-${invalid ? 'critical' : 'weak'})`,
      }}
    />
  );
}
