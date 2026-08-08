import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'grommet';
import { Add, Trash } from 'grommet-icons';
import {
  CAPABILITIES,
  useAccountService,
  type Capability,
  type WebRole,
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
  SaveBar,
  StatusChip,
} from './AdminShared';
import type { Issue } from './validation';

/**
 * Roles and what they can reach.
 *
 * A role is a name plus a set of capabilities, and the capability list is a
 * closed catalogue (`CAPABILITIES` in services/types.ts) rather than free text.
 * That is the point: a permission can only be granted if the app actually has
 * something to protect, so the roles table can never drift into describing
 * access that does not exist.
 *
 * In Power Pages each capability becomes a set of table permissions hung off
 * the web role. The tick here is the intent; the table permission is the gate.
 */
export function RolesPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: roles, loading } = useAsync(
    () => service.getWebRoles(),
    [service, refreshKey],
  );
  const { data: users } = useAsync(() => service.getPortalUsers(), [service, refreshKey]);

  async function addRole() {
    await service.saveWebRole({
      roleId: `role-${Date.now().toString(36)}`,
      name: 'New role',
      description: '',
      isAdministrator: false,
      isSystemManaged: false,
      // Everyone can at least see Home; a role with nothing at all is a role
      // that cannot sign in usefully.
      capabilities: ['home.view'],
    });
    setRefreshKey((k) => k + 1);
  }

  async function remove(roleId: string) {
    setError(null);
    try {
      await service.deleteWebRole(roleId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setRefreshKey((k) => k + 1);
  }

  if (loading) {
    return <SkeletonRows rows={4} height="140px" label="Loading roles" />;
  }

  return (
    <Box gap="medium">
      <FlexRow justify="between">
        <Text size="small" color="text-weak">
          What each role can reach. Capabilities come from a fixed list, so a
          role can only be granted access to something the app actually has.
        </Text>
        <AdminButton onClick={addRole} reduced={reduced} tone="accent">
          <Add size="small" />
          Add role
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

      {(roles ?? []).map((role) => (
        <RoleCard
          key={role.roleId}
          role={role}
          heldBy={(users ?? []).filter((u) => u.roleIds.includes(role.roleId)).length}
          reduced={reduced}
          onSaved={() => setRefreshKey((k) => k + 1)}
          onDelete={() => remove(role.roleId)}
        />
      ))}
    </Box>
  );
}

function RoleCard({
  role,
  heldBy,
  reduced,
  onSaved,
  onDelete,
}: {
  role: WebRole;
  heldBy: number;
  reduced: boolean;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const service = useAccountService();
  const [draft, setDraft] = useState(role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(role), [role]);

  const locked = role.isSystemManaged;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(role),
    [draft, role],
  );

  const issues = useMemo<Issue[]>(() => {
    if (!dirty) return [];
    const found: Issue[] = [];

    if (draft.name.trim().length === 0) {
      found.push({ level: 'error', message: 'Role name cannot be empty.' });
    }
    if (draft.capabilities.length === 0) {
      found.push({
        level: 'error',
        message: 'A role must grant at least one capability, or nobody holding it can do anything.',
      });
    }
    // Losing admin access on the role that is meant to grant it would lock
    // everyone out of this very screen.
    if (role.isAdministrator && !draft.capabilities.includes('admin.access')) {
      found.push({
        level: 'error',
        message: 'The administrator role must keep Admin portal access — removing it would lock everyone out of this screen.',
      });
    }
    if (heldBy > 0) {
      const removed = role.capabilities.filter((c) => !draft.capabilities.includes(c));
      if (removed.length > 0) {
        found.push({
          level: 'warning',
          message: `${heldBy} user${heldBy === 1 ? '' : 's'} hold this role and will immediately lose: ${removed
            .map((c) => CAPABILITIES.find((x) => x.id === c)?.label ?? c)
            .join(', ')}.`,
        });
      }
    }
    return found;
  }, [dirty, draft, role, heldBy]);

  function toggle(capability: Capability, on: boolean) {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      capabilities: on
        ? [...d.capabilities, capability]
        : d.capabilities.filter((c) => c !== capability),
    }));
  }

  async function save() {
    setSaving(true);
    await service.saveWebRole({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
    });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  return (
    <CollapsibleCard
      reduced={reduced}
      title={draft.name || 'Untitled role'}
      summary={
        <>
          {draft.capabilities.length} capabilit
          {draft.capabilities.length === 1 ? 'y' : 'ies'} · held by {heldBy} user
          {heldBy === 1 ? '' : 's'}
          {role.description && <> · {role.description}</>}
        </>
      }
      badge={
        <>
          {/* The draft lives in this component rather than inside the collapse,
              so closing a card keeps the edit. Saying so is the point of the
              chip — otherwise unsaved work is invisible from the list. */}
          {dirty && <StatusChip tone="warning">Unsaved changes</StatusChip>}
          {role.isAdministrator && <StatusChip tone="info">SAIP Admin</StatusChip>}
          {locked && <StatusChip tone="muted">Power Pages</StatusChip>}
        </>
      }
      actions={
        /* Delete stays reachable while collapsed — it is a decision made from
           the list, not one worth expanding a role to reach. */
        <AdminButton
          onClick={onDelete}
          // A role Power Pages owns, or one still in use, cannot go. The service
          // enforces both; this only explains which applies.
          disabled={locked || heldBy > 0 || saving}
          tone="danger"
          reduced={reduced}
          title={
            locked
              ? 'Maintained by Power Pages — it cannot be edited or deleted here.'
              : heldBy > 0
                ? `${heldBy} user(s) still hold this role. Move them first.`
                : 'Delete this role.'
          }
        >
          <Trash size="small" />
        </AdminButton>
      }
    >
      <Box
        gap="small"
        pad={{ bottom: 'small' }}
        border={{ side: 'bottom', color: 'border-weak' }}
      >
        {locked ? (
          <Text size="small" color="text-weak">
            Power Pages creates and maintains this role, so its name and
            capabilities are read-only here.
          </Text>
        ) : (
          <Box gap="xxsmall">
            <AdminInput
              value={draft.name}
              onChange={(name) => {
                setSaved(false);
                setDraft((d) => ({ ...d, name }));
              }}
              ariaLabel={`Name for ${role.roleId}`}
              placeholder="Role name"
            />
            <AdminInput
              value={draft.description}
              onChange={(description) => {
                setSaved(false);
                setDraft((d) => ({ ...d, description }));
              }}
              ariaLabel={`Description for ${role.roleId}`}
              placeholder="What this role is for"
            />
          </Box>
        )}

        <FlexRow gap="small">
          <IdChip id={role.roleId} />
          {role.isAdministrator && (
            <Badge tone="accent">Grants the SAIP Admin tickbox</Badge>
          )}
          {locked && <Badge tone="muted">Maintained by Power Pages</Badge>}
          <Text size="xsmall" color="text-weak">
            held by {heldBy} user{heldBy === 1 ? '' : 's'}
          </Text>
        </FlexRow>
      </Box>

      <Box gap="xsmall">
        <Text size="small" weight={600} color="text-strong">
          Can access
        </Text>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--hpe-spacing-xsmall)',
          }}
        >
          {CAPABILITIES.map((capability) => {
            const on = draft.capabilities.includes(capability.id);
            return (
              <label
                key={capability.id}
                title={capability.description}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--hpe-spacing-xsmall)',
                  padding: 'var(--hpe-spacing-xsmall)',
                  borderRadius: 'var(--hpe-radius-xsmall)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  background: on
                    ? 'var(--hpe-color-background-active)'
                    : 'var(--hpe-color-background-back)',
                  border: `1px solid ${
                    on ? 'var(--saip-accent)' : 'var(--hpe-color-border-weak)'
                  }`,
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked || saving}
                  aria-label={`${capability.label} for ${role.name}`}
                  onChange={(e) => toggle(capability.id, e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ minWidth: 0 }}>
                  <Text size="small" weight={on ? 600 : 400} color="text-strong" as="div">
                    {capability.label}
                  </Text>
                  <Text size="xsmall" color="text-weak" as="div">
                    {capability.description}
                  </Text>
                </span>
              </label>
            );
          })}
        </div>
      </Box>

      <SaveBar
        issues={issues}
        dirty={dirty}
        saving={saving}
        saved={saved}
        reduced={reduced}
        onSave={save}
        onDiscard={() => {
          setDraft(role);
          setSaved(false);
        }}
        saveLabel="Save role"
      />
    </CollapsibleCard>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'accent' | 'muted';
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background:
          tone === 'accent'
            ? 'var(--hpe-color-background-active)'
            : 'var(--hpe-color-background-back)',
        color: 'var(--hpe-color-text-weak)',
        border: `1px solid ${
          tone === 'accent' ? 'var(--saip-accent)' : 'var(--hpe-color-border-weak)'
        }`,
      }}
    >
      {children}
    </span>
  );
}
