import { useMemo, useState } from 'react';
import { Box, Text } from 'grommet';
import { Add, Down, Trash, Up } from 'grommet-icons';
import {
  QUESTION_INPUT_LABELS,
  QUESTION_INPUT_TYPES,
  useAccountService,
  type OptionSet,
  type QuestionDefinition,
  type QuestionInputType,
  type QuestionSection,
} from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { SkeletonRows } from '@/components/common/Skeleton';
import { useAppMotion } from '@/motion/useAppMotion';
import { AdminButton, AdminInput, AdminPanel, FlexRow, IdChip, Row } from './AdminShared';

/** Input types that need a dropdown behind them. */
const CHOICE_TYPES: QuestionInputType[] = ['choice', 'multichoice'];

/**
 * Question and feedback areas.
 *
 * Every question the app asks — the Account Monitoring dates, the meeting log
 * fields — becomes a record here instead of markup. Wording, help text, whether
 * something is required, the order it appears in and which dropdown feeds it
 * are all editable without touching the front end.
 *
 * Ids are shown and NOT editable. They are what the code, the notification
 * deep-links and the database all join on, so a rename here would break the
 * link between a stored answer and the question it answers. Renaming the LABEL
 * is safe and is the thing people actually want.
 */
export function QuestionsPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: sections } = useAsync(
    () => service.getQuestionSections(),
    [service, refreshKey],
  );
  const { data: optionSets } = useAsync(() => service.getOptionSets(), [service]);
  const { data: questions, loading } = useAsync(
    () => service.getQuestions(),
    [service, refreshKey],
  );

  const bySection = useMemo(() => {
    const map = new Map<string, QuestionDefinition[]>();
    for (const q of questions ?? []) {
      const list = map.get(q.sectionId) ?? [];
      list.push(q);
      map.set(q.sectionId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [questions]);

  async function save(question: QuestionDefinition) {
    setSaving(true);
    await service.saveQuestion(question);
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function remove(questionId: string) {
    setSaving(true);
    await service.deleteQuestion(questionId);
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  /** Swaps a question with its neighbour, so ordering is a two-record write. */
  async function move(section: QuestionSection, question: QuestionDefinition, by: -1 | 1) {
    const list = bySection.get(section.sectionId) ?? [];
    const index = list.findIndex((q) => q.questionId === question.questionId);
    const target = list[index + by];
    if (!target) return;
    setSaving(true);
    await service.saveQuestion({ ...question, order: target.order });
    await service.saveQuestion({ ...target, order: question.order });
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function saveSection(section: QuestionSection) {
    setSaving(true);
    setError(null);
    await service.saveQuestionSection(section);
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function deleteSection(sectionId: string) {
    setSaving(true);
    setError(null);
    try {
      await service.deleteQuestionSection(sectionId);
    } catch (e) {
      // The service refuses while the section still holds questions. Surfacing
      // its message is better than a generic failure — it says what to do next.
      setError(e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function addSection() {
    const list = sections ?? [];
    const nextOrder = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 1;
    await saveSection({
      sectionId: `sec-${Date.now().toString(36)}`,
      title: 'New section',
      description: '',
      // Account Monitoring is where a new group of questions almost always
      // belongs; the picker on the section lets it be moved.
      area: 'account-monitoring',
      order: nextOrder,
      // Off until it has been named and filled — an empty titled section
      // appearing on a live form would be worse than not having it.
      enabled: false,
    });
  }

  /** Swaps a section with its neighbour, matching how questions reorder. */
  async function moveSection(section: QuestionSection, by: -1 | 1) {
    const ordered = [...(sections ?? [])].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((s) => s.sectionId === section.sectionId);
    const target = ordered[index + by];
    if (!target) return;
    setSaving(true);
    await service.saveQuestionSection({ ...section, order: target.order });
    await service.saveQuestionSection({ ...target, order: section.order });
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function add(section: QuestionSection) {
    const list = bySection.get(section.sectionId) ?? [];
    const nextOrder = list.length ? Math.max(...list.map((q) => q.order)) + 1 : 1;
    await save({
      // Prefixed with the section so a new id reads like the seeded ones.
      questionId: `${section.sectionId.replace(/^sec-/, '')}-q${Date.now().toString(36)}`,
      sectionId: section.sectionId,
      label: 'New question',
      helpText: '',
      inputType: 'date',
      required: false,
      order: nextOrder,
      enabled: false,
      optionSetId: null,
      // A brand new question has not been agreed with anyone yet.
      nameProvisional: true,
    });
  }

  if (loading) {
    return <SkeletonRows rows={5} height="88px" label="Loading questions" />;
  }

  const ordered = [...(sections ?? [])].sort((a, b) => a.order - b.order);

  return (
    <Box gap="medium">
      <FlexRow justify="between">
        <Text size="small" color="text-weak">
          Sections group the questions on a form. Both are records — renaming
          either one changes the app without a deploy.
        </Text>
        <AdminButton onClick={addSection} reduced={reduced} disabled={saving} tone="accent">
          <Add size="small" />
          Add section
        </AdminButton>
      </FlexRow>

      {error && (
        <Box
          pad="small"
          round="small"
          background="background-critical"
          border={{ color: 'border-critical' }}
          role="alert"
        >
          <Text size="small" color="text-strong">
            {error}
          </Text>
        </Box>
      )}

      {ordered.map((section, sectionIndex) => (
        <AdminPanel
          key={section.sectionId}
          title={section.title}
          description={section.description || 'No description.'}
          action={
            <AdminButton onClick={() => add(section)} reduced={reduced} disabled={saving}>
              <Add size="small" />
              Add question
            </AdminButton>
          }
        >
          <SectionHeaderEditor
            section={section}
            saving={saving}
            reduced={reduced}
            questionCount={(bySection.get(section.sectionId) ?? []).length}
            isFirst={sectionIndex === 0}
            isLast={sectionIndex === ordered.length - 1}
            onSave={saveSection}
            onDelete={() => deleteSection(section.sectionId)}
            onMove={(by) => moveSection(section, by)}
          />

          <Box>
            {(bySection.get(section.sectionId) ?? []).map((question, i, list) => (
              <Row key={question.questionId} first={i === 0}>
                <QuestionRow
                  question={question}
                  optionSets={optionSets ?? []}
                  saving={saving}
                  reduced={reduced}
                  isFirst={i === 0}
                  isLast={i === list.length - 1}
                  onChange={save}
                  onDelete={() => remove(question.questionId)}
                  onMove={(by) => move(section, question, by)}
                />
              </Row>
            ))}
            {(bySection.get(section.sectionId) ?? []).length === 0 && (
              <Text size="small" color="text-weak">
                No questions in this section yet.
              </Text>
            )}
          </Box>
        </AdminPanel>
      ))}
    </Box>
  );
}

/**
 * Editable section header.
 *
 * `sectionId` is shown but fixed, exactly as question ids are: it is what the
 * questions join on, so renaming it would detach every question in the group.
 * The TITLE is free to change, and that is the thing anyone actually wants.
 */
function SectionHeaderEditor({
  section,
  saving,
  reduced,
  questionCount,
  isFirst,
  isLast,
  onSave,
  onDelete,
  onMove,
}: {
  section: QuestionSection;
  saving: boolean;
  reduced: boolean;
  questionCount: number;
  isFirst: boolean;
  isLast: boolean;
  onSave: (s: QuestionSection) => void;
  onDelete: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description);
  const dirty = title !== section.title || description !== section.description;

  return (
    <Box
      gap="small"
      pad={{ bottom: 'small' }}
      border={{ side: 'bottom', color: 'border-weak' }}
    >
      <FlexRow justify="between" align="start">
        <Box gap="xxsmall" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <AdminInput
            value={title}
            onChange={setTitle}
            ariaLabel={`Section title for ${section.sectionId}`}
            placeholder="Section title"
          />
          <AdminInput
            value={description}
            onChange={setDescription}
            ariaLabel={`Section description for ${section.sectionId}`}
            placeholder="Description (optional)"
          />
        </Box>

        <FlexRow gap="xsmall" align="start">
          <AdminButton
            onClick={() => onMove(-1)}
            disabled={isFirst || saving}
            reduced={reduced}
            title="Move section up"
          >
            <Up size="small" />
          </AdminButton>
          <AdminButton
            onClick={() => onMove(1)}
            disabled={isLast || saving}
            reduced={reduced}
            title="Move section down"
          >
            <Down size="small" />
          </AdminButton>
          <AdminButton
            onClick={onDelete}
            // Blocked while it still holds questions — deleting would leave them
            // rendering nowhere. The service enforces this too.
            disabled={saving || questionCount > 0}
            tone="danger"
            reduced={reduced}
            title={
              questionCount > 0
                ? `Move or delete this section's ${questionCount} question(s) first.`
                : 'Delete this empty section.'
            }
          >
            <Trash size="small" />
          </AdminButton>
        </FlexRow>
      </FlexRow>

      <FlexRow gap="small">
        <IdChip id={section.sectionId} />

        <Select
          ariaLabel={`Area for ${section.sectionId}`}
          value={section.area}
          onChange={(v) =>
            onSave({
              ...section,
              title,
              description,
              area: v as QuestionSection['area'],
            })
          }
          options={[
            { value: 'account-monitoring', label: 'Account Monitoring' },
            { value: 'meeting-log', label: 'Meeting log' },
          ]}
        />

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            color: 'var(--hpe-color-text-strong)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={section.enabled}
            disabled={saving}
            onChange={(e) =>
              onSave({ ...section, title, description, enabled: e.target.checked })
            }
          />
          Shown
        </label>

        <Text size="xsmall" color="text-weak">
          {questionCount} question{questionCount === 1 ? '' : 's'}
        </Text>

        {dirty && (
          <AdminButton
            onClick={() => onSave({ ...section, title, description })}
            tone="accent"
            reduced={reduced}
            disabled={saving}
          >
            Save section
          </AdminButton>
        )}
      </FlexRow>
    </Box>
  );
}

function QuestionRow({
  question,
  optionSets,
  saving,
  reduced,
  isFirst,
  isLast,
  onChange,
  onDelete,
  onMove,
}: {
  question: QuestionDefinition;
  optionSets: OptionSet[];
  saving: boolean;
  reduced: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChange: (q: QuestionDefinition) => void;
  onDelete: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const [label, setLabel] = useState(question.label);
  const [helpText, setHelpText] = useState(question.helpText);
  const needsOptions = CHOICE_TYPES.includes(question.inputType);

  return (
    <Box gap="small">
      <FlexRow justify="between" align="start">
        <Box gap="xxsmall" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <AdminInput
            value={label}
            onChange={setLabel}
            ariaLabel={`Label for ${question.questionId}`}
            placeholder="Question label"
          />
          <AdminInput
            value={helpText}
            onChange={setHelpText}
            ariaLabel={`Help text for ${question.questionId}`}
            placeholder="Help text (optional)"
          />
        </Box>

        <FlexRow gap="xsmall" align="start">
          <AdminButton
            onClick={() => onMove(-1)}
            disabled={isFirst || saving}
            reduced={reduced}
            title="Move up"
          >
            <Up size="small" />
          </AdminButton>
          <AdminButton
            onClick={() => onMove(1)}
            disabled={isLast || saving}
            reduced={reduced}
            title="Move down"
          >
            <Down size="small" />
          </AdminButton>
          <AdminButton
            onClick={onDelete}
            disabled={saving}
            tone="danger"
            reduced={reduced}
            title="Delete this question. Answers already stored against it are orphaned — disable it instead if you only want it off the form."
          >
            <Trash size="small" />
          </AdminButton>
        </FlexRow>
      </FlexRow>

      <FlexRow gap="small">
        <IdChip id={question.questionId} />

        <Select
          ariaLabel={`Input type for ${question.questionId}`}
          value={question.inputType}
          onChange={(v) => {
            const inputType = v as QuestionInputType;
            onChange({
              ...question,
              label,
              helpText,
              inputType,
              // Moving away from a choice type must clear the dropdown, or the
              // record keeps a dangling reference that means nothing.
              optionSetId: CHOICE_TYPES.includes(inputType)
                ? (question.optionSetId ?? optionSets[0]?.optionSetId ?? null)
                : null,
            });
          }}
          options={QUESTION_INPUT_TYPES.map((t) => ({
            value: t,
            label: QUESTION_INPUT_LABELS[t],
          }))}
        />

        {needsOptions && (
          <Select
            ariaLabel={`Dropdown for ${question.questionId}`}
            value={question.optionSetId ?? ''}
            onChange={(v) => onChange({ ...question, label, helpText, optionSetId: v })}
            options={optionSets.map((o) => ({ value: o.optionSetId, label: o.name }))}
          />
        )}

        <Toggle
          label="Required"
          checked={question.required}
          disabled={saving}
          onChange={(required) => onChange({ ...question, label, helpText, required })}
        />
        <Toggle
          label="Shown"
          checked={question.enabled}
          disabled={saving}
          onChange={(enabled) => onChange({ ...question, label, helpText, enabled })}
        />
        <Toggle
          label="Name TBC"
          checked={question.nameProvisional}
          disabled={saving}
          onChange={(nameProvisional) =>
            onChange({ ...question, label, helpText, nameProvisional })
          }
        />

        {(label !== question.label || helpText !== question.helpText) && (
          <AdminButton
            onClick={() => onChange({ ...question, label, helpText })}
            tone="accent"
            reduced={reduced}
            disabled={saving}
          >
            Save wording
          </AdminButton>
        )}
      </FlexRow>
    </Box>
  );
}

function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      style={{
        font: 'inherit',
        fontSize: '0.75rem',
        padding: '5px 8px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        background: 'var(--hpe-color-background-back)',
        color: 'var(--hpe-color-text-strong)',
        border: '1px solid var(--hpe-color-border-weak)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.75rem',
        color: 'var(--hpe-color-text-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
