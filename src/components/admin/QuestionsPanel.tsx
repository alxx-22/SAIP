import { useEffect, useMemo, useState } from 'react';
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
import {
  AdminButton,
  AdminInput,
  CollapsibleCard,
  FlexRow,
  IdChip,
  Row,
  SaveBar,
  SortableList,
  StatusChip,
} from './AdminShared';
import { validateSectionDraft } from './validation';

/** Input types that need a dropdown behind them. */
const CHOICE_TYPES: QuestionInputType[] = ['choice', 'multichoice'];

/** Where a section can appear. Read on the collapsed header and in the picker. */
const AREA_LABELS: Record<QuestionSection['area'], string> = {
  'account-monitoring': 'Account Monitoring',
  'meeting-log': 'Meeting log',
};

/**
 * Question and feedback areas.
 *
 * Each SECTION is one editable card with a single Save at the bottom: its own
 * title and description, every question inside it, and any deletions queued
 * along the way. Nothing reaches the service until Save is pressed, so a
 * half-typed label is never written and a reorder is one write rather than two.
 *
 * Ids are shown and never editable. They are what the code, the notification
 * deep-links and the database all join on, so a rename would break the link
 * between a stored answer and the question it answers. Renaming the LABEL is
 * safe and is the thing people actually want.
 */
export function QuestionsPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: sections } = useAsync(
    () => service.getQuestionSections(),
    [service, refreshKey],
  );
  const { data: optionSets } = useAsync(
    () => service.getOptionSets(),
    [service, refreshKey],
  );
  const { data: questions, loading } = useAsync(
    () => service.getQuestions(),
    [service, refreshKey],
  );

  async function deleteSection(sectionId: string) {
    setError(null);
    try {
      await service.deleteQuestionSection(sectionId);
    } catch (e) {
      // The service refuses while the section still holds questions. Surfacing
      // its message is better than a generic failure — it says what to do next.
      setError(e instanceof Error ? e.message : String(e));
    }
    setRefreshKey((k) => k + 1);
  }

  async function addSection() {
    const list = sections ?? [];
    const nextOrder = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 1;
    await service.saveQuestionSection({
      sectionId: `sec-${Date.now().toString(36)}`,
      title: 'New section',
      description: '',
      area: 'account-monitoring',
      order: nextOrder,
      // Off until it has been named and filled — an empty titled section on a
      // live form would be worse than not having it.
      enabled: false,
    });
    setRefreshKey((k) => k + 1);
  }

  /** Section order is a two-record swap, applied immediately rather than drafted. */
  async function moveSection(section: QuestionSection, by: -1 | 1) {
    const ordered = [...(sections ?? [])].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((s) => s.sectionId === section.sectionId);
    const target = ordered[index + by];
    if (!target) return;
    await service.saveQuestionSection({ ...section, order: target.order });
    await service.saveQuestionSection({ ...target, order: section.order });
    setRefreshKey((k) => k + 1);
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
        <AdminButton onClick={addSection} reduced={reduced} tone="accent">
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

      {ordered.map((section, index) => (
        <SectionCard
          key={section.sectionId}
          section={section}
          questions={(questions ?? []).filter((q) => q.sectionId === section.sectionId)}
          optionSets={optionSets ?? []}
          reduced={reduced}
          isFirst={index === 0}
          isLast={index === ordered.length - 1}
          onSaved={() => setRefreshKey((k) => k + 1)}
          onDelete={() => deleteSection(section.sectionId)}
          onMove={(by) => moveSection(section, by)}
        />
      ))}
    </Box>
  );
}

/* ─── One section, edited as a whole ────────────────────────────────────── */

function SectionCard({
  section,
  questions,
  optionSets,
  reduced,
  isFirst,
  isLast,
  onSaved,
  onDelete,
  onMove,
}: {
  section: QuestionSection;
  questions: QuestionDefinition[];
  optionSets: OptionSet[];
  reduced: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSaved: () => void;
  onDelete: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const service = useAccountService();

  const original = useMemo(
    () => [...questions].sort((a, b) => a.order - b.order),
    [questions],
  );

  const [draftSection, setDraftSection] = useState(section);
  const [draftQuestions, setDraftQuestions] = useState(original);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-seed whenever the saved records change underneath.
  useEffect(() => {
    setDraftSection(section);
    setDraftQuestions(original);
    setDeleted([]);
  }, [section, original]);

  const dirty =
    JSON.stringify(draftSection) !== JSON.stringify(section) ||
    JSON.stringify(draftQuestions) !== JSON.stringify(original) ||
    deleted.length > 0;

  const issues = useMemo(
    () =>
      dirty
        ? validateSectionDraft(
            draftSection,
            draftQuestions,
            original,
            optionSets,
            deleted,
          )
        : [],
    [dirty, draftSection, draftQuestions, original, optionSets, deleted],
  );

  const sorted = [...draftQuestions].sort((a, b) => a.order - b.order);

  function patchSection(next: Partial<QuestionSection>) {
    setSaved(false);
    setDraftSection((d) => ({ ...d, ...next }));
  }

  function patchQuestion(questionId: string, next: Partial<QuestionDefinition>) {
    setSaved(false);
    setDraftQuestions((list) =>
      list.map((q) => (q.questionId === questionId ? { ...q, ...next } : q)),
    );
  }

  function moveQuestion(questionId: string, by: -1 | 1) {
    const index = sorted.findIndex((q) => q.questionId === questionId);
    const target = sorted[index + by];
    if (!target) return;
    const current = sorted[index];
    setSaved(false);
    setDraftQuestions((list) =>
      list.map((q) => {
        if (q.questionId === current.questionId) return { ...q, order: target.order };
        if (q.questionId === target.questionId) return { ...q, order: current.order };
        return q;
      }),
    );
  }

  /**
   * Commits a drag-reordered question list.
   *
   * Renumbers from the array index rather than swapping a pair the way the
   * arrow buttons do — a drag can cross several rows at once, so there is no
   * pair to swap. It also keeps the stored sequence dense instead of
   * accumulating the gaps repeated swapping leaves behind.
   */
  function reorderQuestions(next: QuestionDefinition[]) {
    setSaved(false);
    setDraftQuestions(next.map((q, i) => ({ ...q, order: i + 1 })));
  }

  function addQuestion() {
    const nextOrder = sorted.length ? Math.max(...sorted.map((q) => q.order)) + 1 : 1;
    setSaved(false);
    setDraftQuestions((list) => [
      ...list,
      {
        // Prefixed with the section so a new id reads like the seeded ones.
        questionId: `${section.sectionId.replace(/^sec-/, '')}-q${Date.now().toString(36)}`,
        sectionId: section.sectionId,
        label: '',
        helpText: '',
        inputType: 'date',
        required: false,
        order: nextOrder,
        enabled: false,
        optionSetId: null,
        // Nothing new has been agreed with anyone yet.
        nameProvisional: true,
        systemReferences: [],
      },
    ]);
  }

  function removeQuestion(questionId: string) {
    setSaved(false);
    // A question that was never saved just disappears; an existing one is queued
    // for deletion so validation can warn about the answers it strands.
    const existed = original.some((q) => q.questionId === questionId);
    setDraftQuestions((list) => list.filter((q) => q.questionId !== questionId));
    if (existed) setDeleted((d) => [...d, questionId]);
  }

  async function save() {
    setSaving(true);
    await service.saveQuestionSection({
      ...draftSection,
      title: draftSection.title.trim(),
      description: draftSection.description.trim(),
    });
    for (const question of draftQuestions) {
      await service.saveQuestion({
        ...question,
        label: question.label.trim(),
        helpText: question.helpText.trim(),
      });
    }
    for (const questionId of deleted) {
      await service.deleteQuestion(questionId);
    }
    setSaving(false);
    setSaved(true);
    setDeleted([]);
    onSaved();
  }

  return (
    <CollapsibleCard
      reduced={reduced}
      title={draftSection.title || 'Untitled section'}
      summary={
        <>
          {AREA_LABELS[draftSection.area]} · {sorted.length} question
          {sorted.length === 1 ? '' : 's'}
          {section.description && <> · {section.description}</>}
        </>
      }
      badge={
        <>
          {/* The draft lives out here rather than inside the collapse, so
              closing a section keeps the edit — and this is what says so. */}
          {dirty && <StatusChip tone="warning">Unsaved changes</StatusChip>}
          {!draftSection.enabled && <StatusChip tone="muted">Hidden</StatusChip>}
        </>
      }
      actions={
        /*
          Reordering and deleting stay on the closed header. Moving a section is
          a decision about the list, so needing to open one to move it would be
          backwards — and with sections collapsed you can finally see the whole
          running order at once, which is when reordering makes sense at all.
        */
        <>
          <AdminButton
            onClick={() => onMove(-1)}
            disabled={isFirst || saving || dirty}
            reduced={reduced}
            title={dirty ? 'Save or discard your changes first.' : 'Move section up'}
          >
            <Up size="small" />
          </AdminButton>
          <AdminButton
            onClick={() => onMove(1)}
            disabled={isLast || saving || dirty}
            reduced={reduced}
            title={dirty ? 'Save or discard your changes first.' : 'Move section down'}
          >
            <Down size="small" />
          </AdminButton>
          <AdminButton
            onClick={onDelete}
            // Blocked while it still holds questions — they would render
            // nowhere. The service enforces this too.
            disabled={saving || original.length > 0}
            tone="danger"
            reduced={reduced}
            title={
              original.length > 0
                ? `Move or delete this section's ${original.length} question(s) first.`
                : 'Delete this empty section.'
            }
          >
            <Trash size="small" />
          </AdminButton>
        </>
      }
    >
      <Box
        gap="small"
        pad={{ bottom: 'small' }}
        border={{ side: 'bottom', color: 'border-weak' }}
      >
        <Box gap="xxsmall" style={{ minWidth: 0 }}>
          <AdminInput
            value={draftSection.title}
            onChange={(title) => patchSection({ title })}
            ariaLabel={`Section title for ${section.sectionId}`}
            placeholder="Section title"
          />
          <AdminInput
            value={draftSection.description}
            onChange={(description) => patchSection({ description })}
            ariaLabel={`Section description for ${section.sectionId}`}
            placeholder="Description (optional)"
          />
        </Box>

        <FlexRow gap="small" justify="between">
          <FlexRow gap="small">
            <IdChip id={section.sectionId} />
            {/* WHERE THE SECTION APPEARS. Changing this moves every question in
                it to the other form — which is the point, and why it is drafted
                and validated like any other edit rather than applied on pick. */}
            <Select
              ariaLabel={`Area for ${section.sectionId}`}
              value={draftSection.area}
              onChange={(v) => patchSection({ area: v as QuestionSection['area'] })}
              options={[
                { value: 'account-monitoring', label: 'Account Monitoring' },
                { value: 'meeting-log', label: 'Meeting log' },
              ]}
            />
            <Toggle
              label="Shown"
              checked={draftSection.enabled}
              disabled={saving}
              onChange={(enabled) => patchSection({ enabled })}
            />
          </FlexRow>

          <AdminButton onClick={addQuestion} reduced={reduced} disabled={saving}>
            <Add size="small" />
            Add question
          </AdminButton>
        </FlexRow>
      </Box>

      <Box>
        <SortableList
          values={sorted}
          getKey={(q) => q.questionId}
          onReorder={reorderQuestions}
          reduced={reduced}
          renderItem={(question, i, handle) => (
            <Row first={i === 0}>
              <QuestionRow
                question={question}
                optionSets={optionSets}
                saving={saving}
                reduced={reduced}
                isFirst={i === 0}
                isLast={i === sorted.length - 1}
                handle={handle}
                onPatch={(next) => patchQuestion(question.questionId, next)}
                onRemove={() => removeQuestion(question.questionId)}
                onMove={(by) => moveQuestion(question.questionId, by)}
              />
            </Row>
          )}
        />
        {sorted.length === 0 && (
          <Text size="small" color="text-weak">
            No questions in this section yet.
          </Text>
        )}
      </Box>

      <SaveBar
        issues={issues}
        dirty={dirty}
        saving={saving}
        saved={saved}
        reduced={reduced}
        onSave={save}
        onDiscard={() => {
          setDraftSection(section);
          setDraftQuestions(original);
          setDeleted([]);
          setSaved(false);
        }}
        saveLabel="Save section"
      />
    </CollapsibleCard>
  );
}

function QuestionRow({
  question,
  optionSets,
  saving,
  reduced,
  isFirst,
  isLast,
  handle,
  onPatch,
  onRemove,
  onMove,
}: {
  question: QuestionDefinition;
  optionSets: OptionSet[];
  saving: boolean;
  reduced: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** Drag grip supplied by SortableList. Pointer-only; the arrows are the
      keyboard path. */
  handle: React.ReactNode;
  onPatch: (next: Partial<QuestionDefinition>) => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const needsOptions = CHOICE_TYPES.includes(question.inputType);
  const locked = question.systemReferences.length > 0;

  return (
    <Box gap="small">
      <FlexRow justify="between" align="start">
        <FlexRow gap="xsmall" align="start">
          {handle}
          <Box gap="xxsmall" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <AdminInput
            value={question.label}
            onChange={(label) => onPatch({ label })}
            ariaLabel={`Label for ${question.questionId}`}
            placeholder="Question label"
          />
          <AdminInput
            value={question.helpText}
            onChange={(helpText) => onPatch({ helpText })}
            ariaLabel={`Help text for ${question.questionId}`}
            placeholder="Help text (optional)"
          />
          </Box>
        </FlexRow>

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
            onClick={onRemove}
            disabled={saving}
            tone="danger"
            reduced={reduced}
            title={
              locked
                ? `Blocked on save — ${question.systemReferences.join(', ')} depends on this.`
                : 'Remove this question. Answers stored against it are orphaned.'
            }
          >
            <Trash size="small" />
          </AdminButton>
        </FlexRow>
      </FlexRow>

      <FlexRow gap="small">
        <IdChip id={question.questionId} />

        {locked && (
          <span
            title={`Depended on by: ${question.systemReferences.join(', ')}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 6px',
              borderRadius: 'var(--hpe-radius-xsmall)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: 'var(--hpe-color-background-warning)',
              color: 'var(--hpe-color-text-strong)',
              border: '1px solid var(--hpe-color-border-warning)',
            }}
          >
            In use by the app
          </span>
        )}

        <Select
          ariaLabel={`Input type for ${question.questionId}`}
          value={question.inputType}
          onChange={(v) => {
            const inputType = v as QuestionInputType;
            onPatch({
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
            onChange={(optionSetId) => onPatch({ optionSetId })}
            options={[
              { value: '', label: 'Choose a list…' },
              ...optionSets.map((o) => ({ value: o.optionSetId, label: o.name })),
            ]}
          />
        )}

        <Toggle
          label="Required"
          checked={question.required}
          disabled={saving}
          onChange={(required) => onPatch({ required })}
        />
        <Toggle
          label="Shown"
          checked={question.enabled}
          disabled={saving}
          onChange={(enabled) => onPatch({ enabled })}
        />
        <Toggle
          label="Name TBC"
          checked={question.nameProvisional}
          disabled={saving}
          onChange={(nameProvisional) => onPatch({ nameProvisional })}
        />
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
