import { useState } from 'react';
import { Box, Text } from 'grommet';
import { Add, Down, Trash, Up } from 'grommet-icons';
import { useAccountService, type OptionSet, type OptionSetOption } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { SkeletonRows } from '@/components/common/Skeleton';
import { useAppMotion } from '@/motion/useAppMotion';
import {
  AdminButton,
  AdminInput,
  AdminPanel,
  CodeDependentNote,
  FlexRow,
  IdChip,
  Row,
} from './AdminShared';

/**
 * Dropdown sections — the reusable lists that feed choice questions.
 *
 * Each of these is a Dataverse choice column, or a lookup table in SQL. Adding
 * a meeting tag or retiring an SLA tier happens here rather than in a
 * TypeScript literal.
 *
 * OPTIONS ARE DISABLED, NOT DELETED, where anything might already reference
 * them. Deleting "Workshop" would leave every meeting tagged with it pointing
 * at nothing; disabling removes it from the picker and leaves history readable.
 * Delete stays available for options nobody has used yet, which is why it is
 * marked destructive rather than hidden.
 */
export function OptionSetsPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: optionSets, loading } = useAsync(
    () => service.getOptionSets(),
    [service, refreshKey],
  );
  // Only needed to know which dropdowns are still referenced, so delete can say
  // why it is unavailable instead of just failing.
  const { data: questions } = useAsync(() => service.getQuestions(), [service, refreshKey]);

  async function save(next: OptionSet) {
    setSaving(true);
    setError(null);
    await service.saveOptionSet(next);
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function remove(optionSetId: string) {
    setSaving(true);
    setError(null);
    try {
      await service.deleteOptionSet(optionSetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function addSet() {
    await save({
      optionSetId: `opt-${Date.now().toString(36)}`,
      name: 'New dropdown',
      description: '',
      usage: '',
      // Nothing in the code matches a list that did not exist a moment ago.
      codeDependent: false,
      options: [],
    });
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
        <AdminButton onClick={addSet} reduced={reduced} disabled={saving} tone="accent">
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
          saving={saving}
          reduced={reduced}
          usedBy={(questions ?? []).filter((q) => q.optionSetId === set.optionSetId).length}
          onSave={save}
          onDelete={() => remove(set.optionSetId)}
        />
      ))}
    </Box>
  );
}

function OptionSetCard({
  set,
  saving,
  reduced,
  usedBy,
  onSave,
  onDelete,
}: {
  set: OptionSet;
  saving: boolean;
  reduced: boolean;
  /** How many questions point at this list. Drives the delete guard. */
  usedBy: number;
  onSave: (set: OptionSet) => void;
  onDelete: () => void;
}) {
  const sorted = [...set.options].sort((a, b) => a.order - b.order);
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description);
  const [usage, setUsage] = useState(set.usage);
  const headerDirty =
    name !== set.name || description !== set.description || usage !== set.usage;

  function withOptions(options: OptionSetOption[]) {
    onSave({ ...set, options });
  }

  function update(optionId: string, patch: Partial<OptionSetOption>) {
    withOptions(
      set.options.map((o) => (o.optionId === optionId ? { ...o, ...patch } : o)),
    );
  }

  function move(optionId: string, by: -1 | 1) {
    const index = sorted.findIndex((o) => o.optionId === optionId);
    const target = sorted[index + by];
    if (!target) return;
    const current = sorted[index];
    withOptions(
      set.options.map((o) => {
        if (o.optionId === current.optionId) return { ...o, order: target.order };
        if (o.optionId === target.optionId) return { ...o, order: current.order };
        return o;
      }),
    );
  }

  function add() {
    const nextOrder = sorted.length ? Math.max(...sorted.map((o) => o.order)) + 1 : 1;
    withOptions([
      ...set.options,
      {
        optionId: `${set.optionSetId}-${Date.now().toString(36)}`,
        label: 'New option',
        order: nextOrder,
        // Off until someone names it, so a placeholder never reaches a picker.
        enabled: false,
      },
    ]);
  }

  return (
    <AdminPanel
      title={set.name}
      description={
        set.usage ? `${set.description} Used in: ${set.usage}.` : set.description
      }
      action={
        <AdminButton onClick={add} reduced={reduced} disabled={saving}>
          <Add size="small" />
          Add option
        </AdminButton>
      }
    >
      {/*
        Editable header. `optionSetId` is fixed and shown, like every other id
        here — questions point at it, so renaming it would detach them. The NAME
        is free to change.
      */}
      <Box
        gap="small"
        pad={{ bottom: 'small' }}
        border={{ side: 'bottom', color: 'border-weak' }}
      >
        <FlexRow justify="between" align="start">
          <Box gap="xxsmall" style={{ flex: '1 1 340px', minWidth: 0 }}>
            <AdminInput
              value={name}
              onChange={setName}
              ariaLabel={`Name for ${set.optionSetId}`}
              placeholder="Dropdown name"
            />
            <AdminInput
              value={description}
              onChange={setDescription}
              ariaLabel={`Description for ${set.optionSetId}`}
              placeholder="Description (optional)"
            />
            <AdminInput
              value={usage}
              onChange={setUsage}
              ariaLabel={`Usage note for ${set.optionSetId}`}
              placeholder="Where it is used (optional note)"
            />
          </Box>

          <FlexRow gap="xsmall" align="start">
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
          </FlexRow>
        </FlexRow>

        <FlexRow gap="small">
          <IdChip id={set.optionSetId} />
          <Text size="xsmall" color="text-weak">
            {sorted.length} option{sorted.length === 1 ? '' : 's'} · used by {usedBy}{' '}
            question{usedBy === 1 ? '' : 's'}
          </Text>
          {headerDirty && (
            <AdminButton
              onClick={() => onSave({ ...set, name, description, usage })}
              tone="accent"
              reduced={reduced}
              disabled={saving}
            >
              Save dropdown
            </AdminButton>
          )}
        </FlexRow>
      </Box>

      {set.codeDependent && (
        <CodeDependentNote>
          The front end still matches these values by their exact text — colour
          coding and business rules key off them. Adding and reordering is safe;
          renaming an existing option will not take effect until the app reads
          this list at runtime, which is the next step.
        </CodeDependentNote>
      )}

      <Box>
        {sorted.map((option, i) => (
          <Row key={option.optionId} first={i === 0}>
            <FlexRow justify="between" align="start">
              <Box style={{ flex: '1 1 280px', minWidth: 0 }}>
                <AdminInput
                  value={option.label}
                  onChange={(label) => update(option.optionId, { label })}
                  ariaLabel={`Label for ${option.optionId}`}
                />
              </Box>

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
                      update(option.optionId, { enabled: e.target.checked })
                    }
                  />
                  Selectable
                </label>
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
                  onClick={() =>
                    withOptions(set.options.filter((o) => o.optionId !== option.optionId))
                  }
                  disabled={saving}
                  tone="danger"
                  reduced={reduced}
                  title="Delete permanently. Anything already saved with this value will point at nothing — untick Selectable instead to retire it safely."
                >
                  <Trash size="small" />
                </AdminButton>
              </FlexRow>
            </FlexRow>
          </Row>
        ))}

        {sorted.length === 0 && (
          <Text size="small" color="text-weak">
            This dropdown has no options yet.
          </Text>
        )}
      </Box>
    </AdminPanel>
  );
}
