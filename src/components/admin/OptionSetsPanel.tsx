import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'grommet';
import { Add, Down, Trash, Up } from 'grommet-icons';
import { useAccountService, type OptionSet, type OptionSetOption } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { SkeletonRows } from '@/components/common/Skeleton';
import { useAppMotion } from '@/motion/useAppMotion';
import {
  AdminButton,
  AdminInput,
  CodeDependentNote,
  CollapsibleCard,
  FlexRow,
  IdChip,
  Row,
  SaveBar,
  SortableList,
  StatusChip,
} from './AdminShared';
import { validateOptionSetDraft } from './validation';

/**
 * Dropdown lists — the reusable option sets that feed choice questions.
 *
 * EDITS ARE A DRAFT UNTIL SAVED. Every card holds its own local copy and only
 * writes when its Save button is pressed. That is not just tidiness: the earlier
 * version called the service on every keystroke in an option label, so typing
 * "Customer Site" was fifteen writes and fifteen re-renders.
 *
 * Options are retired by unticking Selectable rather than deleted, wherever
 * anything might already reference them: removing "Workshop" leaves every
 * meeting tagged with it pointing at nothing, while unticking takes it out of
 * the picker and keeps history readable.
 */
export function OptionSetsPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: optionSets, loading } = useAsync(
    () => service.getOptionSets(),
    [service, refreshKey],
  );
  // Needed to know which lists are still referenced, so a delete can explain
  // itself rather than simply failing.
  const { data: questions } = useAsync(
    () => service.getQuestions(),
    [service, refreshKey],
  );

  async function remove(optionSetId: string) {
    setError(null);
    try {
      await service.deleteOptionSet(optionSetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setRefreshKey((k) => k + 1);
  }

  async function addSet() {
    await service.saveOptionSet({
      optionSetId: `opt-${Date.now().toString(36)}`,
      name: 'New dropdown',
      description: '',
      usage: '',
      // Nothing in the code matches a list that did not exist a moment ago.
      codeDependent: false,
      options: [],
    });
    setRefreshKey((k) => k + 1);
  }

  if (loading) {
    return <SkeletonRows rows={4} height="120px" label="Loading dropdowns" />;
  }

  return (
    <Box gap="medium">
      <FlexRow justify="between">
        <Text size="small" color="text-weak">
          Reusable lists. A choice question points at one of these rather than
          carrying its own options.
        </Text>
        <AdminButton onClick={addSet} reduced={reduced} tone="accent">
          <Add size="small" />
          Add dropdown
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

      {(optionSets ?? []).map((set) => (
        <OptionSetCard
          key={set.optionSetId}
          set={set}
          reduced={reduced}
          usedBy={
            (questions ?? []).filter((q) => q.optionSetId === set.optionSetId).length
          }
          onSaved={() => setRefreshKey((k) => k + 1)}
          onDelete={() => remove(set.optionSetId)}
        />
      ))}
    </Box>
  );
}

function OptionSetCard({
  set,
  reduced,
  usedBy,
  onSaved,
  onDelete,
}: {
  set: OptionSet;
  reduced: boolean;
  /** How many questions point at this list. Drives the delete guard. */
  usedBy: number;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const service = useAccountService();
  const [draft, setDraft] = useState<OptionSet>(set);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-seed when the saved record changes underneath — after a save, or when
  // another card's write refreshes the list.
  useEffect(() => {
    setDraft(set);
  }, [set]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(set),
    [draft, set],
  );
  const issues = useMemo(
    () => (dirty ? validateOptionSetDraft(draft, set, usedBy) : []),
    [draft, set, usedBy, dirty],
  );

  const sorted = useMemo(
    () => [...draft.options].sort((a, b) => a.order - b.order),
    [draft.options],
  );

  function patch(next: Partial<OptionSet>) {
    setSaved(false);
    setDraft((d) => ({ ...d, ...next }));
  }

  /**
   * Commits a drag-reordered list.
   *
   * Renumbers from the array index rather than swapping the two `order` values
   * the way the arrow buttons do. A drag can move a row past several others at
   * once, so there is no pair to swap — and renumbering keeps the stored
   * sequence dense (1, 2, 3…) instead of accumulating the gaps that repeated
   * swapping leaves behind.
   */
  function reorder(next: OptionSetOption[]) {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      options: next.map((o, i) => ({ ...o, order: i + 1 })),
    }));
  }

  function updateOption(optionId: string, next: Partial<OptionSetOption>) {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      options: d.options.map((o) => (o.optionId === optionId ? { ...o, ...next } : o)),
    }));
  }

  function move(optionId: string, by: -1 | 1) {
    const index = sorted.findIndex((o) => o.optionId === optionId);
    const target = sorted[index + by];
    if (!target) return;
    const current = sorted[index];
    setSaved(false);
    setDraft((d) => ({
      ...d,
      options: d.options.map((o) => {
        if (o.optionId === current.optionId) return { ...o, order: target.order };
        if (o.optionId === target.optionId) return { ...o, order: current.order };
        return o;
      }),
    }));
  }

  function addOption() {
    const nextOrder = sorted.length ? Math.max(...sorted.map((o) => o.order)) + 1 : 1;
    setSaved(false);
    setDraft((d) => ({
      ...d,
      options: [
        ...d.options,
        {
          optionId: `${d.optionSetId}-${Date.now().toString(36)}`,
          label: '',
          order: nextOrder,
          // Off until it is named — validation blocks an empty label anyway.
          enabled: false,
        },
      ],
    }));
  }

  function removeOption(optionId: string) {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      options: d.options.filter((o) => o.optionId !== optionId),
    }));
  }

  async function save() {
    setSaving(true);
    await service.saveOptionSet({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      usage: draft.usage.trim(),
      options: draft.options.map((o) => ({ ...o, label: o.label.trim() })),
    });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  return (
    <CollapsibleCard
      reduced={reduced}
      title={draft.name || 'Untitled dropdown'}
      summary={
        <>
          {sorted.length} option{sorted.length === 1 ? '' : 's'} · used by {usedBy}{' '}
          question{usedBy === 1 ? '' : 's'}
          {set.description && <> · {set.description}</>}
        </>
      }
      badge={
        <>
          {/* Draft state lives in this component, not inside the collapse, so
              closing a card never discards an edit. This says so out loud —
              otherwise unsaved work would be invisible from the list. */}
          {dirty && <StatusChip tone="warning">Unsaved changes</StatusChip>}
          {set.codeDependent && <StatusChip tone="info">Matched by name</StatusChip>}
        </>
      }
      actions={
        /* Delete stays on the closed header: removing a whole dropdown is a
           decision made from the list, not one worth expanding to reach. */
        <AdminButton
          onClick={onDelete}
          /*
            Two independent blocks:
              - a question points here, so its control would render nothing
              - the front end still matches these values by name, which no
                question reference would have revealed
            Both are enforced in the service too; this only explains why.
          */
          disabled={saving || usedBy > 0 || set.codeDependent}
          tone="danger"
          reduced={reduced}
          title={
            set.codeDependent
              ? 'Still matched by value in the front end — removable once the app reads this list at runtime.'
              : usedBy > 0
                ? `Used by ${usedBy} question(s). Point them at another list first.`
                : 'Delete this dropdown.'
          }
        >
          <Trash size="small" />
        </AdminButton>
      }
    >
      {/*
        `optionSetId` is fixed and shown, like every other id here — questions
        point at it, so renaming it would detach them. The NAME is free.
      */}
      <Box
        gap="small"
        pad={{ bottom: 'small' }}
        border={{ side: 'bottom', color: 'border-weak' }}
      >
        <Box gap="xxsmall" style={{ minWidth: 0 }}>
          <AdminInput
            value={draft.name}
            onChange={(name) => patch({ name })}
            ariaLabel={`Name for ${set.optionSetId}`}
            placeholder="Dropdown name"
          />
          <AdminInput
            value={draft.description}
            onChange={(description) => patch({ description })}
            ariaLabel={`Description for ${set.optionSetId}`}
            placeholder="Description (optional)"
          />
          <AdminInput
            value={draft.usage}
            onChange={(usage) => patch({ usage })}
            ariaLabel={`Usage note for ${set.optionSetId}`}
            placeholder="Where it is used (optional note)"
          />
        </Box>

        <FlexRow gap="small" justify="between">
          <IdChip id={set.optionSetId} />
          <AdminButton onClick={addOption} reduced={reduced} disabled={saving}>
            <Add size="small" />
            Add option
          </AdminButton>
        </FlexRow>
      </Box>

      {set.codeDependent && (
        <CodeDependentNote>
          The front end still matches these values by their exact text — colour
          coding and business rules key off them. Adding and reordering is safe;
          renaming or removing an existing option is blocked until the app reads
          this list at runtime.
        </CodeDependentNote>
      )}

      <Box>
        <SortableList
          values={sorted}
          getKey={(o) => o.optionId}
          onReorder={reorder}
          reduced={reduced}
          renderItem={(option, i, handle) => (
            <Row first={i === 0}>
              <FlexRow justify="between" align="start">
                <FlexRow gap="xsmall" align="start" grow>
                  {handle}
                  <Box style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <AdminInput
                      value={option.label}
                      onChange={(label) => updateOption(option.optionId, { label })}
                      ariaLabel={`Label for ${option.optionId}`}
                      placeholder="Option label"
                    />
                  </Box>
                </FlexRow>

                <FlexRow gap="xsmall">
                  <IdChip id={option.optionId} />
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
                      checked={option.enabled}
                      disabled={saving}
                      onChange={(e) =>
                        updateOption(option.optionId, { enabled: e.target.checked })
                      }
                    />
                    Selectable
                  </label>
                  {/* The keyboard path. The drag handle is pointer-only, so
                      these are not redundant — they are the accessible route. */}
                  <AdminButton
                    onClick={() => move(option.optionId, -1)}
                    disabled={i === 0 || saving}
                    reduced={reduced}
                    title="Move up"
                  >
                    <Up size="small" />
                  </AdminButton>
                  <AdminButton
                    onClick={() => move(option.optionId, 1)}
                    disabled={i === sorted.length - 1 || saving}
                    reduced={reduced}
                    title="Move down"
                  >
                    <Down size="small" />
                  </AdminButton>
                  <AdminButton
                    onClick={() => removeOption(option.optionId)}
                    disabled={saving}
                    tone="danger"
                    reduced={reduced}
                    title={
                      set.codeDependent
                        ? 'Removal is blocked on this list — untick Selectable to retire it instead.'
                        : 'Remove this option. Anything already saved with it will point at nothing.'
                    }
                  >
                    <Trash size="small" />
                  </AdminButton>
                </FlexRow>
              </FlexRow>
            </Row>
          )}
        />

        {sorted.length === 0 && (
          <Text size="small" color="text-weak">
            This dropdown has no options yet.
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
          setDraft(set);
          setSaved(false);
        }}
        saveLabel="Save dropdown"
      />
    </CollapsibleCard>
  );
}
