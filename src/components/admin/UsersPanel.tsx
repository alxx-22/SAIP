import { useEffect, useState } from 'react';
import { Box, Text } from 'grommet';
import { useAccountService, type PortalUser } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { formatRelative } from '@/services/derive';
import { SkeletonRows } from '@/components/common/Skeleton';
import { useAppMotion } from '@/motion/useAppMotion';
import { AdminButton, AdminPanel } from './AdminShared';

/**
 * Users — a table of people, not a permissions editor.
 *
 * THE SHAPE OF THE ROW mirrors how the business actually talks about access:
 * an "SAIP Admin" tickbox, and one job role from a dropdown. Underneath, a user
 * still holds a SET of roles — that is what Dataverse stores and what lets a
 * role be granted outside these two controls later — but presenting the set
 * directly made people reason about six checkboxes when they only ever meant
 * two things.
 *
 * ADMIN IS ADDITIVE, NOT A JOB ROLE. An administrator is still an account
 * manager or a BD lead, so the tickbox adds `role-admin` alongside whatever the
 * dropdown says rather than replacing it.
 *
 * Users are DISABLED rather than deleted: meetings, incentives and monitoring
 * edits reference their author, so removing the row would strand that history.
 */
export function UsersPanel() {
  const service = useAccountService();
  const { reduced } = useAppMotion();

  const { data: roles } = useAsync(() => service.getWebRoles(), [service]);
  const { data: loaded, loading } = useAsync(() => service.getPortalUsers(), [service]);

  /**
   * Local copy so edits apply OPTIMISTICALLY. A write takes a few hundred
   * milliseconds; waiting for it meant a tick did not move until everything
   * jumped at once, which reads as a broken control and invites a second click
   * that undoes the first.
   */
  const [users, setUsers] = useState<PortalUser[] | null>(null);
  const shown = users ?? loaded ?? null;

  useEffect(() => {
    if (loaded) setUsers(loaded);
  }, [loaded]);

  /** Job roles are everything a person can be — admin and the system role aside. */
  const jobRoles = (roles ?? []).filter((r) => !r.isAdministrator && !r.isSystemManaged);
  const adminRoleId = (roles ?? []).find((r) => r.isAdministrator)?.roleId;
  const systemRoleIds = (roles ?? [])
    .filter((r) => r.isSystemManaged)
    .map((r) => r.roleId);

  function apply(userId: string, patch: Partial<PortalUser>) {
    setUsers((current) =>
      (current ?? loaded ?? []).map((u) => (u.userId === userId ? { ...u, ...patch } : u)),
    );
  }

  async function write(user: PortalUser, roleIds: string[]) {
    apply(user.userId, { roleIds });
    try {
      await service.setUserRoles(user.userId, roleIds);
    } catch {
      apply(user.userId, { roleIds: user.roleIds });
    }
  }

  function setAdmin(user: PortalUser, isAdmin: boolean) {
    if (!adminRoleId) return;
    const roleIds = isAdmin
      ? [...user.roleIds, adminRoleId]
      : user.roleIds.filter((r) => r !== adminRoleId);
    write(user, roleIds);
  }

  function setJobRole(user: PortalUser, roleId: string) {
    // Keep the system role and the admin role; replace only the job role, so
    // the dropdown behaves like a single choice even though the store is a set.
    const kept = user.roleIds.filter(
      (r) => systemRoleIds.includes(r) || r === adminRoleId,
    );
    write(user, roleId ? [...kept, roleId] : kept);
  }

  async function toggleStatus(user: PortalUser) {
    const next = user.status === 'active' ? 'disabled' : 'active';
    apply(user.userId, { status: next });
    try {
      await service.setUserStatus(user.userId, next);
    } catch {
      apply(user.userId, { status: user.status });
    }
  }

  return (
    <AdminPanel
      title="Users"
      description="Everyone who can sign in. Changes apply immediately — there is no save step, because a half-applied permission set is worse than none."
    >
      {loading && <SkeletonRows rows={5} height="56px" label="Loading users" />}

      {!loading && (
        <Box round="small" border={{ color: 'border-weak' }} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <caption className="saip-visually-hidden">
              Portal users, their roles and last activity
            </caption>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Last active</Th>
                <Th align="center">SAIP Admin</Th>
                <Th>Role</Th>
                <Th align="right">Access</Th>
              </tr>
            </thead>
            <tbody>
              {(shown ?? []).map((user) => {
                const isAdmin = adminRoleId ? user.roleIds.includes(adminRoleId) : false;
                const jobRoleId =
                  jobRoles.find((r) => user.roleIds.includes(r.roleId))?.roleId ?? '';

                return (
                  <tr
                    key={user.userId}
                    style={{
                      borderTop: '1px solid var(--hpe-color-border-weak)',
                      // A disabled user stays legible but visibly inactive.
                      opacity: user.status === 'disabled' ? 0.55 : 1,
                    }}
                  >
                    <Td>
                      <Text size="small" weight={600} color="text-strong">
                        {user.displayName}
                      </Text>
                    </Td>
                    <Td>
                      <Text size="small" color="text-weak">
                        {user.email}
                      </Text>
                    </Td>
                    <Td>
                      <Text
                        size="small"
                        color="text-weak"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {user.lastSignIn
                          ? formatRelative(user.lastSignIn.slice(0, 10))
                          : 'Never'}
                      </Text>
                    </Td>
                    <Td align="center">
                      <input
                        type="checkbox"
                        checked={isAdmin}
                        aria-label={`SAIP Admin for ${user.displayName}`}
                        onChange={(e) => setAdmin(user, e.target.checked)}
                      />
                    </Td>
                    <Td>
                      <select
                        value={jobRoleId}
                        aria-label={`Role for ${user.displayName}`}
                        onChange={(e) => setJobRole(user, e.target.value)}
                        style={{
                          font: 'inherit',
                          fontSize: '0.8125rem',
                          padding: '5px 8px',
                          borderRadius: 'var(--hpe-radius-xsmall)',
                          background: 'var(--hpe-color-background-back)',
                          color: 'var(--hpe-color-text-strong)',
                          border: '1px solid var(--hpe-color-border-weak)',
                          maxWidth: 220,
                        }}
                      >
                        <option value="">No role</option>
                        {jobRoles.map((role) => (
                          <option key={role.roleId} value={role.roleId}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td align="right">
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
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      )}

      <Text size="xsmall" color="text-weak">
        SAIP Admin is held <em>alongside</em> a job role, not instead of one — an
        administrator is still an account manager or a BD lead.
      </Text>
    </AdminPanel>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: 'var(--hpe-spacing-small)',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--hpe-color-text-weak)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: 'var(--hpe-spacing-small)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}
