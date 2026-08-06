import { useState } from 'react';
import { Box, Text } from 'grommet';
import { useAccountService, type PortalUser, type WebRole } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/services/derive';
import { SkeletonRows } from '@/components/common/Skeleton';
import { useAppMotion } from '@/motion/useAppMotion';
import { AdminButton, AdminPanel, FlexRow, IdChip, Row } from './AdminShared';

/**
 * Users and roles.
 *
 * Roles are shown read-only and users are editable, which is the right way
 * round: in Power Pages a web role is a record with table permissions hanging
 * off it, so creating one is a modelling decision made in the Portal Management
 * app. Assigning an existing role to a person is the routine act, and that is
 * what this panel is for.
 *
 * Users are DISABLED rather than deleted. Meetings, incentives and monitoring
 * edits reference their author, so removing the row would strand that history.
 */
export function UsersRolesPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: roles } = useAsync(() => service.getWebRoles(), [service]);
  const { data: loaded, loading } = useAsync(() => service.getPortalUsers(), [service]);

  /**
   * Local copy so edits apply OPTIMISTICALLY.
   *
   * Writes take a few hundred milliseconds. Waiting for the round trip before
   * moving the tick meant clicking a role did nothing visible, then everything
   * jumped at once — which reads as a broken checkbox, and invites a second
   * click that undoes the first.
   *
   * The local state leads, the request follows, and a failure puts the previous
   * value back. `loaded` seeds it once the fetch resolves.
   */
  const [users, setUsers] = useState<PortalUser[] | null>(null);
  const shown = users ?? loaded ?? null;

  function apply(userId: string, patch: Partial<PortalUser>) {
    setUsers((current) =>
      (current ?? loaded ?? []).map((u) =>
        u.userId === userId ? { ...u, ...patch } : u,
      ),
    );
  }

  async function toggleRole(user: PortalUser, roleId: string) {
    const next = user.roleIds.includes(roleId)
      ? user.roleIds.filter((r) => r !== roleId)
      : [...user.roleIds, roleId];

    apply(user.userId, { roleIds: next });
    setBusy(user.userId);
    try {
      await service.setUserRoles(user.userId, next);
    } catch {
      // Put it back rather than leaving the UI claiming something untrue.
      apply(user.userId, { roleIds: user.roleIds });
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(user: PortalUser) {
    const next = user.status === 'active' ? 'disabled' : 'active';

    apply(user.userId, { status: next });
    setBusy(user.userId);
    try {
      await service.setUserStatus(user.userId, next);
    } catch {
      apply(user.userId, { status: user.status });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Box gap="medium">
      <AdminPanel
        title="Roles"
        description="Defined in the Portal Management app, because a role is only meaningful alongside the table permissions attached to it. Listed here so you can see what you are assigning."
      >
        <Box>
          {(roles ?? []).map((role, i) => (
            <Row key={role.roleId} first={i === 0}>
              <FlexRow justify="between" align="start">
                <Box gap="xxsmall" style={{ minWidth: 0, flex: '1 1 320px' }}>
                  <FlexRow gap="xsmall">
                    <Text size="small" weight={600} color="text-strong">
                      {role.name}
                    </Text>
                    {role.isAdministrator && <Badge tone="accent">Administrator</Badge>}
                    {role.isSystemManaged && <Badge tone="muted">System</Badge>}
                  </FlexRow>
                  <Text size="xsmall" color="text-weak">
                    {role.description}
                  </Text>
                </Box>
                <IdChip id={role.roleId} />
              </FlexRow>
            </Row>
          ))}
        </Box>
      </AdminPanel>

      <AdminPanel
        title="Users"
        description="Tick a role to grant it. Changes apply immediately — there is no save step, because a half-applied permission set is worse than none."
      >
        {loading && <SkeletonRows rows={4} height="72px" label="Loading users" />}

        {!loading && (
          <Box>
            {(shown ?? []).map((user, i) => (
              <Row key={user.userId} first={i === 0}>
                <FlexRow justify="between" align="start">
                  <Box gap="xxsmall" style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <FlexRow gap="xsmall">
                      <Text size="small" weight={600} color="text-strong">
                        {user.displayName}
                      </Text>
                      {user.status === 'disabled' && <Badge tone="muted">Disabled</Badge>}
                    </FlexRow>
                    <Text size="xsmall" color="text-weak">
                      {user.email} · last signed in{' '}
                      {user.lastSignIn
                        ? formatRelative(user.lastSignIn.slice(0, 10)).toLowerCase()
                        : 'never'}
                    </Text>
                  </Box>

                  <AdminButton
                    onClick={() => toggleStatus(user)}
                    tone={user.status === 'active' ? 'danger' : 'neutral'}
                    reduced={reduced}
                    title={
                      user.status === 'active'
                        ? 'Disable sign-in. Their history is kept.'
                        : 'Restore sign-in.'
                    }
                  >
                    {user.status === 'active' ? 'Disable' : 'Enable'}
                  </AdminButton>
                </FlexRow>

                <FlexRow gap="xsmall">
                  {(roles ?? []).map((role) => (
                    <RoleToggle
                      key={role.roleId}
                      role={role}
                      user={user}
                      busy={busy === user.userId}
                      onToggle={() => toggleRole(user, role.roleId)}
                    />
                  ))}
                </FlexRow>
              </Row>
            ))}
          </Box>
        )}
      </AdminPanel>
    </Box>
  );
}

function RoleToggle({
  role,
  user,
  busy,
  onToggle,
}: {
  role: WebRole;
  user: PortalUser;
  busy: boolean;
  onToggle: () => void;
}) {
  const granted = user.roleIds.includes(role.roleId);
  // Power Pages maintains this one itself, so it is shown but not editable.
  const locked = role.isSystemManaged;

  return (
    <label
      title={
        locked
          ? 'Applied automatically to everyone who signs in — Power Pages maintains this.'
          : role.description
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.75rem',
        cursor: locked ? 'not-allowed' : 'pointer',
        background: granted
          ? 'var(--hpe-color-background-active)'
          : 'var(--hpe-color-background-back)',
        border: `1px solid ${
          granted ? 'var(--saip-accent)' : 'var(--hpe-color-border-weak)'
        }`,
        color: locked ? 'var(--hpe-color-text-disabled)' : 'var(--hpe-color-text-strong)',
        // Dimmed while the write is in flight, but still interactive — the tick
        // has already moved, so blocking a second click would be surprising.
        opacity: busy ? 0.75 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={granted}
        disabled={locked}
        onChange={onToggle}
        aria-label={`${role.name} for ${user.displayName}`}
      />
      {role.name}
    </label>
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
