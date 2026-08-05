import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormField,
  Select,
  Text,
  TextArea,
  TextInput,
} from 'grommet';
import { Checkmark, Close, Lock } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MEETING_PLACES,
  MEETING_TAGS,
  useAccountService,
  type MeetingPlace,
  type MeetingTag,
} from '@/services';
import { todayIso } from '@/services/derive';
import { useAsync } from '@/hooks/useAsync';
import { AnimatedModal } from '@/components/common/AnimatedModal';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import { DatePicker } from '@/components/common/DatePicker';
import {
  chipInteraction,
  confirmPop,
  staggerContainer,
  staggerItem,
} from '@/motion/variants';
import { duration, easing, glow, spring, stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';

type Phase = 'editing' | 'saving' | 'saved';

interface FormState {
  accountId: string;
  meetingDate: string;
  place: MeetingPlace | '';
  subject: string;
  comments: string;
  tags: MeetingTag[];
}

function emptyForm(accountId = ''): FormState {
  return {
    accountId,
    meetingDate: todayIso(),
    place: '',
    subject: '',
    comments: '',
    tags: [],
  };
}

/**
 * Log a Meeting (brief §7.4).
 *
 * ONE component, TWO entry points:
 *  - from the Homepage, `lockedAccountId` is undefined → the first field is an
 *    account picker and it is required;
 *  - from Account Focus, `lockedAccountId` is set → the account is shown
 *    locked and read-only at the top, and the picker is not rendered.
 *
 * Motion: the modal scales/fades in over a blurred backdrop (handled by
 * `AnimatedModal`), form sections stagger in, and a save confirmation plays
 * before the modal closes itself.
 */
export function MeetingLogModal({
  open,
  onClose,
  lockedAccountId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the account is pre-selected and cannot be changed. */
  lockedAccountId?: string;
  onSaved?: () => void;
}) {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [form, setForm] = useState<FormState>(() => emptyForm(lockedAccountId));
  const [phase, setPhase] = useState<Phase>('editing');
  const [touched, setTouched] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: accounts } = useAsync(() => service.getAccounts(), [service]);

  // Reset to a clean form each time the modal opens, so a cancelled entry
  // doesn't reappear the next time the rep opens it.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(lockedAccountId));
      setPhase('editing');
      setTouched(false);
      setSaveError(null);
    }
  }, [open, lockedAccountId]);

  const lockedAccount = useMemo(
    () => accounts?.find((a) => a.accountId === lockedAccountId),
    [accounts, lockedAccountId],
  );

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.accountId) e.accountId = 'Select the account this meeting relates to.';
    if (!form.meetingDate) e.meetingDate = 'Enter the date the meeting took place.';
    else if (form.meetingDate > todayIso())
      e.meetingDate = 'The meeting date can’t be in the future.';
    if (!form.place) e.place = 'Select where the meeting took place.';
    if (!form.subject.trim()) e.subject = 'Give the meeting a short subject.';
    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  async function handleSave() {
    setTouched(true);
    if (!isValid || phase !== 'editing') return;

    setPhase('saving');
    setSaveError(null);
    try {
      await service.logMeeting({
        accountId: form.accountId,
        meetingDate: form.meetingDate,
        place: form.place as MeetingPlace,
        subject: form.subject.trim(),
        comments: form.comments.trim(),
        tags: form.tags,
      });
      setPhase('saved');
      onSaved?.();
      // Let the confirmation animation land before dismissing.
      window.setTimeout(onClose, reduced ? 350 : 1100);
    } catch (err) {
      setPhase('editing');
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function toggleTag(tag: MeetingTag) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  const showError = (field: keyof FormState) =>
    touched && errors[field] ? errors[field] : undefined;

  return (
    <AnimatedModal open={open} onClose={onClose} labelledBy="meeting-log-title">
      <Box>
        {/* Header */}
        <Box
          direction="row"
          align="center"
          justify="between"
          pad={{ horizontal: 'medium', vertical: 'small' }}
          border={{ side: 'bottom', color: 'border-weak' }}
          flex={false}
        >
          <Box gap="xxsmall">
            <Text
              id="meeting-log-title"
              as="h2"
              size="large"
              weight={600}
              color="text-strong"
              margin="none"
            >
              Log a meeting
            </Text>
            <Text size="xsmall" color="text-weak">
              Recorded against the account and visible to the account team.
            </Text>
          </Box>
          <Button
            icon={<Close />}
            onClick={onClose}
            a11yTitle="Close without saving"
            plain
          />
        </Box>

        {/* Body */}
        <Box
          pad="medium"
          gap="small"
          overflow={{ vertical: 'auto' }}
          style={{ maxHeight: '60vh' }}
        >
          <motion.div
            variants={staggerContainer(reduced, stagger.tight)}
            initial="hidden"
            animate="visible"
            style={{ display: 'grid', gap: 'var(--hpe-spacing-xsmall)' }}
          >
            {/* Account: locked banner OR picker, never both. */}
            <motion.div variants={staggerItem(reduced)}>
              {lockedAccountId ? (
                <Box
                  direction="row"
                  align="center"
                  gap="small"
                  pad={{ horizontal: 'small', vertical: 'xsmall' }}
                  round="small"
                  background="background-contrast"
                  border={{ color: 'border-weak' }}
                >
                  <Lock size="small" color="icon-weak" />
                  <Box gap="4px" flex>
                    <Text size="xsmall" color="text-weak">
                      Account
                    </Text>
                    <Box direction="row" align="center" gap="xsmall" wrap>
                      <Text weight={600} color="text-strong">
                        {lockedAccount?.accountName ?? lockedAccountId}
                      </Text>
                      <SampleDataBadge />
                    </Box>
                  </Box>
                  <Text size="xsmall" color="text-weak">
                    Pre-selected
                  </Text>
                </Box>
              ) : (
                <FormField
                  label="Account"
                  htmlFor="meeting-account"
                  name="meeting-account"
                  required
                  error={showError('accountId')}
                >
                  <Select
                    id="meeting-account"
                    name="meeting-account"
                    placeholder="Select an account"
                    options={accounts ?? []}
                    labelKey="accountName"
                    valueKey={{ key: 'accountId', reduce: true }}
                    value={form.accountId}
                    onChange={({ value }) =>
                      setForm((f) => ({ ...f, accountId: value as string }))
                    }
                    // Lets the rep type to narrow a long account list.
                    onSearch={undefined}
                  />
                </FormField>
              )}
            </motion.div>

            <motion.div variants={staggerItem(reduced)}>
              <FormField
                label="Date of meeting"
                htmlFor="meeting-date"
                name="meeting-date"
                required
                error={showError('meetingDate')}
              >
                <DatePicker
                  id="meeting-date"
                  value={form.meetingDate || null}
                  onChange={(v) => setForm((f) => ({ ...f, meetingDate: v ?? '' }))}
                  // A meeting can't have happened in the future.
                  max={todayIso()}
                  clearable={false}
                  invalid={Boolean(showError('meetingDate'))}
                />
              </FormField>
            </motion.div>

            <motion.div variants={staggerItem(reduced)}>
              <FormField
                label="Meeting place"
                htmlFor="meeting-place"
                name="meeting-place"
                required
                error={showError('place')}
              >
                <Select
                  id="meeting-place"
                  name="meeting-place"
                  placeholder="Where did it take place?"
                  options={MEETING_PLACES}
                  value={form.place}
                  onChange={({ option }) =>
                    setForm((f) => ({ ...f, place: option as MeetingPlace }))
                  }
                />
              </FormField>
            </motion.div>

            <motion.div variants={staggerItem(reduced)}>
              <FormField
                label="Subject"
                htmlFor="meeting-subject"
                name="meeting-subject"
                required
                error={showError('subject')}
              >
                <TextInput
                  id="meeting-subject"
                  name="meeting-subject"
                  placeholder="e.g. Q3 service review"
                  maxLength={120}
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </FormField>
            </motion.div>

            <motion.div variants={staggerItem(reduced)}>
              <FormField
                label="Comments"
                htmlFor="meeting-comments"
                name="meeting-comments"
              >
                <TextArea
                  id="meeting-comments"
                  name="meeting-comments"
                  placeholder="What was discussed, what was agreed, what happens next…"
                  rows={4}
                  resize="vertical"
                  value={form.comments}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                />
              </FormField>
            </motion.div>

            <motion.div variants={staggerItem(reduced)}>
              <TagPicker selected={form.tags} onToggle={toggleTag} reduced={reduced} />
            </motion.div>
          </motion.div>

          {saveError && (
            <Box
              pad="small"
              round="small"
              background="background-critical"
              border={{ color: 'border-critical' }}
              role="alert"
            >
              <Text size="small" color="text-strong">
                Couldn’t save this meeting. {saveError}
              </Text>
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box
          direction="row"
          align="center"
          justify="between"
          gap="small"
          pad={{ horizontal: 'medium', vertical: 'small' }}
          border={{ side: 'top', color: 'border-weak' }}
          background="background-contrast"
          flex={false}
        >
          <Box>
            {touched && !isValid && (
              <Text size="xsmall" color="text-critical">
                Complete the required fields to save.
              </Text>
            )}
          </Box>

          <Box direction="row" gap="small" align="center">
            <Button label="Cancel" onClick={onClose} disabled={phase !== 'editing'} />
            <SaveButton phase={phase} reduced={reduced} onSave={handleSave} />
          </Box>
        </Box>
      </Box>
    </AnimatedModal>
  );
}

/**
 * Save control that morphs through editing → saving → saved.
 * The confirmation is the last thing the rep sees before the modal dismisses.
 */
function SaveButton({
  phase,
  reduced,
  onSave,
}: {
  phase: Phase;
  reduced: boolean;
  onSave: () => void;
}) {
  return (
    <Box style={{ position: 'relative', minWidth: 132 }} flex={false}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'saved' ? (
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
              justify="center"
              gap="xsmall"
              pad={{ horizontal: 'medium', vertical: 'xsmall' }}
              round="xsmall"
              background="background-ok"
              // Announce the outcome for screen-reader users.
              role="status"
              style={{ position: 'relative', boxShadow: glow.ok }}
            >
              {/* Ring burst expanding out of the confirmation. */}
              {!reduced && (
                <motion.span
                  initial={{ opacity: 0.8, scale: 0.9 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  transition={{ duration: 0.75, ease: easing.out }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'var(--hpe-radius-xsmall)',
                    border: '2px solid var(--hpe-color-foreground-ok)',
                    pointerEvents: 'none',
                  }}
                  aria-hidden
                />
              )}
              <motion.span
                initial={reduced ? false : { scale: 0.4, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={spring.bouncy}
                style={{ display: 'flex' }}
              >
                <Checkmark size="small" color="icon-ok" />
              </motion.span>
              <Text size="small" weight={600} color="text-strong">
                Meeting logged
              </Text>
            </Box>
          </motion.div>
        ) : (
          <motion.div
            key="save"
            initial={false}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, transition: { duration: duration.fast } }
            }
          >
            <Button
              primary
              label={phase === 'saving' ? 'Saving…' : 'Save meeting'}
              onClick={onSave}
              disabled={phase === 'saving'}
              fill="horizontal"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

/**
 * Multi-select tags as toggle chips.
 *
 * Uses real <button aria-pressed> elements inside a labelled group, so the
 * selected state is exposed to assistive tech — a styled div would not be.
 */
function TagPicker({
  selected,
  onToggle,
  reduced,
}: {
  selected: MeetingTag[];
  onToggle: (tag: MeetingTag) => void;
  reduced: boolean;
}) {
  return (
    <Box gap="xsmall" role="group" aria-labelledby="meeting-tags-label">
      <Text id="meeting-tags-label" size="small" weight={500} color="text-strong">
        Tags
      </Text>
      <Box direction="row" gap="xsmall" wrap>
        {MEETING_TAGS.map((tag) => {
          const active = selected.includes(tag);
          return (
            <motion.button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              aria-pressed={active}
              // Pops on select, so choosing a tag registers physically.
              {...chipInteraction(reduced, active)}
              style={{
                border: `1px solid var(--hpe-color-border-${active ? 'selected' : 'weak'})`,
                background: active
                  ? 'var(--hpe-color-background-selected-primary)'
                  : 'var(--hpe-color-background-front)',
                color: 'var(--hpe-color-text-strong)',
                borderRadius: 'var(--hpe-radius-small)',
                padding: '6px 12px',
                marginBottom: 4,
                cursor: 'pointer',
                font: 'inherit',
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 400,
                boxShadow: active ? glow.primary : 'none',
                transition: `background-color ${duration.fast}s, border-color ${duration.fast}s, box-shadow ${duration.fast}s`,
              }}
            >
              {tag}
            </motion.button>
          );
        })}
      </Box>
    </Box>
  );
}
