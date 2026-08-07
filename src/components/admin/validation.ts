import type {
  OptionSet,
  QuestionDefinition,
  QuestionSection,
} from '@/services';

/**
 * Integrity checks for the admin portal's editable records.
 *
 * PURE FUNCTIONS, ON PURPOSE. Every rule here is a statement about the data, so
 * keeping them out of the components means they can be reasoned about — and
 * eventually reused by the Dataverse plug-in that has to enforce the same thing
 * server-side. The UI only renders what these return.
 *
 * TWO LEVELS, AND THE DIFFERENCE MATTERS
 *
 *   error   — the save is blocked. Something would break, or the record would
 *             be meaningless.
 *   warning — the save goes ahead. Something is worth knowing before you commit
 *             to it, usually because existing data already uses the old value.
 *
 * The rule of thumb: block when the change would break the APP, warn when it
 * would only affect how existing DATA reads. An admin is allowed to make a
 * mess of their own labels; they are not allowed to detach a notification from
 * the question that feeds it.
 */

export interface Issue {
  level: 'error' | 'warning';
  message: string;
}

const blank = (v: string) => v.trim().length === 0;

/** Case-insensitive duplicate detection — "Teams" and "teams" are one option. */
function findDuplicates(values: string[]): string[] {
  const seen = new Map<string, number>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

/**
 * Validates a section and the questions inside it, against how they started.
 *
 * `original` is null for a section that has not been saved yet, which turns off
 * every "you are changing an existing thing" rule — nothing can reference a
 * record that has never existed.
 */
export function validateSectionDraft(
  draft: QuestionSection,
  questions: QuestionDefinition[],
  originalQuestions: QuestionDefinition[],
  optionSets: OptionSet[],
  deletedQuestionIds: string[],
): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(originalQuestions.map((q) => [q.questionId, q]));

  if (blank(draft.title)) {
    issues.push({ level: 'error', message: 'Section title cannot be empty.' });
  }

  const duplicateLabels = findDuplicates(questions.map((q) => q.label));
  if (duplicateLabels.length > 0) {
    issues.push({
      level: 'error',
      message: `Two questions share the label "${duplicateLabels[0]}". They would be indistinguishable on the form.`,
    });
  }

  for (const question of questions) {
    const before = byId.get(question.questionId);
    const label = question.label.trim() || question.questionId;

    if (blank(question.label)) {
      issues.push({
        level: 'error',
        message: `A question in this section has no label (${question.questionId}).`,
      });
    }

    // A choice control with no list behind it renders an empty picker.
    if (
      (question.inputType === 'choice' || question.inputType === 'multichoice') &&
      !question.optionSetId
    ) {
      issues.push({
        level: 'error',
        message: `"${label}" is a dropdown question but no list is selected.`,
      });
    }

    if (
      question.optionSetId &&
      !optionSets.some((o) => o.optionSetId === question.optionSetId)
    ) {
      issues.push({
        level: 'error',
        message: `"${label}" points at a dropdown that no longer exists.`,
      });
    }

    // ── Rules that only apply to a question something already depends on ──
    const references = before?.systemReferences ?? [];
    if (references.length > 0) {
      if (!question.enabled) {
        issues.push({
          level: 'error',
          message: `"${label}" cannot be hidden — ${references.join(', ')} depends on it.`,
        });
      }
      if (before && question.inputType !== before.inputType) {
        issues.push({
          level: 'error',
          message: `"${label}" cannot change type — ${references.join(', ')} reads it as ${before.inputType}.`,
        });
      }
    }

    // Making an existing optional question required does not retrofit answers,
    // so old records stay incomplete. Worth saying, not worth blocking.
    if (before && question.required && !before.required) {
      issues.push({
        level: 'warning',
        message: `"${label}" is now required. Records saved before this change will still have it empty.`,
      });
    }
  }

  for (const questionId of deletedQuestionIds) {
    const before = byId.get(questionId);
    if (!before) continue;
    if (before.systemReferences.length > 0) {
      issues.push({
        level: 'error',
        message: `"${before.label}" cannot be deleted — ${before.systemReferences.join(', ')} depends on it. Hide it instead if it should come off the form.`,
      });
    } else {
      issues.push({
        level: 'warning',
        message: `"${before.label}" will be deleted. Answers already stored against it are orphaned; hiding it keeps them readable.`,
      });
    }
  }

  // A visible section with nothing in it renders as a stray heading.
  if (draft.enabled && questions.filter((q) => q.enabled).length === 0) {
    issues.push({
      level: 'warning',
      message: 'This section is shown but has no visible questions, so it will render as an empty heading.',
    });
  }

  return issues;
}

/**
 * Validates a dropdown and its options.
 *
 * The sharp rule here is renaming an option on a `codeDependent` list. The front
 * end matches those by their exact text — a meeting tag's colour, an SLA tier's
 * treatment — so a rename does not fail loudly, it just stops matching. That is
 * precisely the change an admin would expect to be safe, which is why it blocks
 * rather than warns.
 */
export function validateOptionSetDraft(
  draft: OptionSet,
  original: OptionSet | null,
  usedByQuestions: number,
): Issue[] {
  const issues: Issue[] = [];
  const before = new Map((original?.options ?? []).map((o) => [o.optionId, o]));

  if (blank(draft.name)) {
    issues.push({ level: 'error', message: 'Dropdown name cannot be empty.' });
  }

  const blankOptions = draft.options.filter((o) => blank(o.label)).length;
  if (blankOptions > 0) {
    issues.push({
      level: 'error',
      message: `${blankOptions} option${blankOptions === 1 ? ' has' : 's have'} no label.`,
    });
  }

  const duplicates = findDuplicates(draft.options.map((o) => o.label));
  if (duplicates.length > 0) {
    issues.push({
      level: 'error',
      message: `"${duplicates[0]}" appears more than once. Options must be distinguishable.`,
    });
  }

  if (original?.codeDependent) {
    for (const option of draft.options) {
      const previous = before.get(option.optionId);
      if (!previous) continue;

      if (previous.label.trim() !== option.label.trim()) {
        issues.push({
          level: 'error',
          message: `"${previous.label}" cannot be renamed — the front end still matches this list by its exact text, so the rename would silently stop matching. Editable once the app reads this list at runtime.`,
        });
      }
      if (previous.enabled && !option.enabled) {
        issues.push({
          level: 'warning',
          message: `"${previous.label}" will stop being selectable. Records that already use it keep it.`,
        });
      }
    }

    const removed = (original?.options ?? []).filter(
      (o) => !draft.options.some((d) => d.optionId === o.optionId),
    );
    for (const option of removed) {
      issues.push({
        level: 'error',
        message: `"${option.label}" cannot be removed from a list the front end matches by value. Untick Selectable to retire it instead.`,
      });
    }
  } else {
    // Not code-dependent, so removal is allowed — but existing rows may still
    // point at it, and this prototype cannot see them.
    const removed = (original?.options ?? []).filter(
      (o) => !draft.options.some((d) => d.optionId === o.optionId),
    );
    for (const option of removed) {
      issues.push({
        level: 'warning',
        message: `"${option.label}" will be removed. Anything already saved with it will point at nothing.`,
      });
    }
  }

  if (draft.options.length === 0 && usedByQuestions > 0) {
    issues.push({
      level: 'error',
      message: `${usedByQuestions} question${usedByQuestions === 1 ? '' : 's'} use${usedByQuestions === 1 ? 's' : ''} this list, so it cannot be left with no options.`,
    });
  }

  if (draft.options.length > 0 && draft.options.every((o) => !o.enabled)) {
    issues.push({
      level: 'warning',
      message: 'No option is selectable, so the picker will be empty.',
    });
  }

  return issues;
}

/** True when nothing blocks the save. Warnings do not block. */
export function canSave(issues: Issue[]): boolean {
  return !issues.some((i) => i.level === 'error');
}
