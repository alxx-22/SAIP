import { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'grommet';
import { Group, User } from 'grommet-icons';
import { useAccountService, type Incentive } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useAppMotion } from '@/motion/useAppMotion';
import { FlexRow, SaveBar } from '@/components/admin/AdminShared';
import type { Issue } from '@/components/admin/validation';

/**
 * Who an incentive is assigned to.
 *
 * ASSIGNED IS NOT NOMINATED, and the two sit in separate panels because they
 * answer different questions. A nominated ACCOUNT is a target of the campaign;
 * an assigned PERSON is responsible for acting on it. A Sales Training
 * incentive usually has no accounts at all and several assignees.
 *
 * Assigning by ROLE is the more useful of the two: everyone holding the role
 * picks it up, including people who join it later. Assigning by name is for the
 * exceptions.
 */
export function IncentiveAssignment({
  incentive,
  onSaved,
}: {
  incentive: Incentive;
  onSaved: () => void;
}) {
  const service = useAccountService();
  const { reduced } = useAppMotion();

  const { data: users } = useAsync(() => service.getPortalUsers(), [service]);
  const { data: roles } = useAsync(() => service.getWebRoles(), [service]);

  const [userIds, setUserIds] = useState<string[]>(incentive.assignedUserIds);
  const [roleIds, setRoleIds] = useState<string[]>(incentive.assignedRoleIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUserIds(incentive.assignedUserIds);
    setRoleIds(incentive.assignedRoleIds);
  }, [incentive]);

  const dirty =
    JSON.stringify([...userIds].sort()) !==
      JSON.stringify([...incentive.assignedUserIds].sort()) ||
    JSON.stringify([...roleIds].sort()) !==
      JSON.stringify([...incentive.assignedRoleIds].sort());

  /** Everyone who ends up seeing this, once roles are expanded to people. */
  const reach = useMemo(() => {
    const people = new Set(userIds);
    for (const user of users ?? []) {
      if (user.roleIds.some((r) => roleIds.includes(r))) people.add(user.userId);
    }
    // A disabled user cannot sign in, so they are not really reached.
    const active = (users ?? []).filter(
      (u) => people.has(u.userId) && u.status === 'active',
    );
    return active.length;
  }, [userIds, roleIds, users]);

  const issues = useMemo<Issue[]>(() => {
    if (!dirty) return [];
    const found: Issue[] = [];
    if (userIds.length === 0 && roleIds.length === 0) {
      found.push({
        level: 'warning',
        message: 'Nobody will be assigned, so this will not appear on anyone’s My Incentives.',
      });
    }
    // Named people who are also covered by a chosen role are redundant — worth
    // saying, because the list will look longer than it is.
    const covered = (users ?? []).filter(
      (u) => userIds.includes(u.userId) && u.roleIds.some((r) => roleIds.includes(r)),
    );
    if (covered.length > 0) {
      found.push({
        level: 'warning',
        message: `${covered.map((u) => u.displayName).join(', ')} ${covered.length === 1 ? 'is' : 'are'} already covered by a role you have selected.`,
      });
    }
    return found;
  }, [dirty, userIds, roleIds, users]);

  async function save() {
    setSaving(true);
    await service.setIncentiveAssignment(incentive.incentiveId, { userIds, roleIds });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  const activeUsers = (users ?? []).filter((u) => u.status === 'active');

  return (
    <Box gap="small">
      <FlexRow justify="between">
        <Text as="h2" size="medium" weight={600} color="text-strong" margin="none">
          Assigned to
        </Text>
        <Text size="xsmall" color="text-weak">
          {reach} {reach === 1 ? 'person' : 'people'} will see this
        </Text>
      </FlexRow>
      <Text size="small" color="text-weak" style={{ maxWidth: '72ch' }}>
        Assigned people find this under <strong>My Incentives</strong>. Assigning
        a role covers everyone who holds it, including anyone who joins it later.
      </Text>

      <Box gap="xsmall">
        <FlexRow gap="xsmall">
          <Group size="small" color="icon-default" />
          <Text size="small" weight={600} color="text-strong">
            Roles
          </Text>
        </FlexRow>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--hpe-spacing-xsmall)',
          }}
        >
          {(roles ?? [])
            // The system role is everyone, so offering it would be a way of
            // assigning to the whole portal by accident.
            .filter((r) => !r.isSystemManaged)
            .map((role) => (
              <Pill
                key={role.roleId}
                label={role.name}
                title={role.description}
                selected={roleIds.includes(role.roleId)}
                disabled={saving}
                onToggle={(on) => {
                  setSaved(false);
                  setRoleIds((current) =>
                    on
                      ? [...current, role.roleId]
                      : current.filter((r) => r !== role.roleId),
                  );
                }}
              />
            ))}
        </div>
      </Box>

      <Box gap="xsmall">
        <FlexRow gap="xsmall">
          <User size="small" color="icon-default" />
          <Text size="small" weight={600} color="text-strong">
            Specific people
          </Text>
        </FlexRow>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--hpe-spacing-xsmall)',
          }}
        >
          {activeUsers.map((user) => (
            <Pill
              key={user.userId}
              label={user.displayName}
              title={user.email}
              selected={userIds.includes(user.userId)}
              disabled={saving}
              onToggle={(on) => {
                setSaved(false);
                setUserIds((current) =>
                  on ? [...current, user.userId] : current.filter((u) => u !== user.userId),
                );
              }}
            />
          ))}
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
          setUserIds(incentive.assignedUserIds);
          setRoleIds(incentive.assignedRoleIds);
          setSaved(false);
        }}
        saveLabel="Save assignment"
      />
    </Box>
  );
}

function Pill({
  label,
  title,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  title?: string;
  selected: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <label
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 'var(--hpe-radius-xsmall)',
        fontSize: '0.8125rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: selected
          ? 'var(--hpe-color-background-active)'
          : 'var(--hpe-color-background-back)',
        border: `1px solid ${
          selected ? 'var(--saip-accent)' : 'var(--hpe-color-border-weak)'
        }`,
        color: 'var(--hpe-color-text-strong)',
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onToggle(e.target.checked)}
      />
      {label}
    </label>
  );
}
