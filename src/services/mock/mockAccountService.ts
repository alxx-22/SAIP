/**
 * Mock implementation of `AccountService`.
 *
 * PLACEHOLDER DATA — every value returned here comes from `mockData.ts` and is
 * invented. Replace this module with a Dataverse-backed implementation and
 * register it in `services/index.ts`; no component changes are required.
 *
 * The artificial latency below is deliberate: it keeps the loading skeletons on
 * a real code path so they can't silently rot. A real implementation will have
 * latency of its own, so this is representative rather than wasteful.
 */

import type {
  Account,
  AccountMonitoring,
  AccountOpportunity,
  AccountService,
  AppNotification,
  CurrentUser,
  MeetingLog,
  Incentive,
  IncentiveDraft,
  OptionSet,
  PortalUser,
  QuestionDefinition,
  QuestionSection,
  WebRole,
  MeetingLogDraft,
  NotificationQuery,
  Score,
  ServiceContract,
  SlaCoverageModel,
  SlaSpendSlice,
  SlaTier,
  ValueOverview,
} from '../types';
import {
  MOCK_ACCOUNTS,
  MOCK_ACCOUNT_SCORES,
  MOCK_CONTRACTS,
  MOCK_COVERAGE_MODEL,
  MOCK_CURRENT_USER,
  MOCK_DEFAULT_COVERAGE_MODEL,
  MOCK_DEFAULT_ACCOUNT_SCORES,
  MOCK_DEFAULT_CONTRACTS,
  MOCK_DEFAULT_VALUE_OVERVIEW,
  MOCK_MEETINGS,
  MOCK_MONITORING,
  MOCK_PORTFOLIO_SCORES,
  MOCK_VALUE_OVERVIEW,
  emptyMonitoring,
} from './mockData';
import { MOCK_ACCOUNT_OPPORTUNITIES } from './mockOpportunities';
import { MOCK_INCENTIVES } from './mockIncentives';
import {
  MOCK_OPTION_SETS,
  MOCK_PORTAL_USERS,
  MOCK_QUESTIONS,
  MOCK_QUESTION_SECTIONS,
  MOCK_WEB_ROLES,
} from './mockAdmin';
import { MONITORING_OVERDUE_MONTHS, formatRelative, isOverdue } from '../derive';

/**
 * Incentives created during the session, newest first.
 *
 * Module-level like `writtenMonitoring`, so a created incentive survives
 * navigation and shows up in the list — the write path is genuinely exercised
 * rather than faked with a toast. Lost on reload, which is the honest limit of
 * a prototype with no store behind it.
 */
const createdIncentives: Incentive[] = [];

/**
 * Admin configuration, copied on first import so edits are held for the session.
 *
 * Deep-copied rather than referenced: the exported MOCK_* arrays are the seed
 * values, and mutating them in place would make "reload to get back to the
 * defaults" quietly untrue.
 */
const adminState = {
  roles: structuredClone(MOCK_WEB_ROLES) as WebRole[],
  users: structuredClone(MOCK_PORTAL_USERS) as PortalUser[],
  sections: structuredClone(MOCK_QUESTION_SECTIONS) as QuestionSection[],
  questions: structuredClone(MOCK_QUESTIONS) as QuestionDefinition[],
  optionSets: structuredClone(MOCK_OPTION_SETS) as OptionSet[],
};

/** Simulated network latency, in ms. */
const LATENCY = { fast: 220, normal: 420, write: 640 };

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Groups contracts into an SLA spend breakdown, largest tier first.
 *
 * `count` means different things by coverage model, which is the point of the
 * distinction: for a customer-level account it counts CONTRACTS, because one
 * contract can span many sites; for a per-location account it counts SITES,
 * because that is how the customer buys and how the rep thinks about it.
 */
function buildSlaBreakdown(
  contracts: ServiceContract[],
  coverage: SlaCoverageModel,
  total: number,
): SlaSpendSlice[] {
  const byTier = new Map<SlaTier, { value: number; count: number }>();

  for (const contract of contracts) {
    const existing = byTier.get(contract.sla) ?? { value: 0, count: 0 };
    byTier.set(contract.sla, {
      value: existing.value + contract.value,
      count:
        existing.count + (coverage === 'location' ? contract.cities.length : 1),
    });
  }

  return [...byTier.entries()]
    .map(([sla, { value, count }]) => ({
      sla,
      value,
      count,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * In-memory write store. Meeting logs and monitoring edits made during a
 * session persist until reload, so the prototype's save flows feel real.
 */
const writtenMeetings: MeetingLog[] = [...MOCK_MEETINGS];
const writtenMonitoring = new Map<string, AccountMonitoring>(
  Object.entries(MOCK_MONITORING),
);

export const mockAccountService: AccountService = {
  async getCurrentUser(): Promise<CurrentUser> {
    return delay(MOCK_CURRENT_USER, LATENCY.fast);
  },

  async getAccounts(): Promise<Account[]> {
    return delay([...MOCK_ACCOUNTS], LATENCY.normal);
  },

  async getAccount(accountId: string): Promise<Account | undefined> {
    const found = MOCK_ACCOUNTS.find((a) => a.accountId === accountId);
    return delay(found, LATENCY.fast);
  },

  async getPortfolioScores(): Promise<Score[]> {
    return delay([...MOCK_PORTFOLIO_SCORES], LATENCY.normal);
  },

  async getAccountScores(accountId: string): Promise<Score[]> {
    const scores = MOCK_ACCOUNT_SCORES[accountId] ?? MOCK_DEFAULT_ACCOUNT_SCORES;
    return delay([...scores], LATENCY.normal);
  },

  async getValueOverview(accountId: string): Promise<ValueOverview> {
    const seed = MOCK_VALUE_OVERVIEW[accountId] ?? MOCK_DEFAULT_VALUE_OVERVIEW;
    const contracts = MOCK_CONTRACTS[accountId] ?? MOCK_DEFAULT_CONTRACTS;
    const coverage = MOCK_COVERAGE_MODEL[accountId] ?? MOCK_DEFAULT_COVERAGE_MODEL;

    // Derived from the contracts rather than stored, so the Value Overview and
    // the contracts table can never disagree about the same money.
    const totalContractedSpend = contracts.reduce((sum, c) => sum + c.value, 0);
    const slaBreakdown = buildSlaBreakdown(contracts, coverage, totalContractedSpend);

    return delay(
      { ...seed, totalContractedSpend, slaCoverageModel: coverage, slaBreakdown },
      LATENCY.normal,
    );
  },

  async getServiceContracts(accountId: string): Promise<ServiceContract[]> {
    const contracts = MOCK_CONTRACTS[accountId] ?? MOCK_DEFAULT_CONTRACTS;
    return delay([...contracts], LATENCY.normal);
  },

  async getAccountOpportunities(accountId: string): Promise<AccountOpportunity[]> {
    /*
      Filtered by accountId here because the fixtures are already grouped. The
      real implementation reads `saip.vw_account_opportunity` filtered on
      `company_group_id` — the grouping and the value roll-up happen in SQL, not
      here, because the source is line-item grain and pulling every line into
      the browser to group it is exactly what the Web API cannot do.

      Sorted by close date descending so the imminent and recently-closed work
      is at the top, which is what someone opening an account is looking for.
    */
    const rows = MOCK_ACCOUNT_OPPORTUNITIES.filter((o) => o.accountId === accountId)
      .slice()
      .sort((a, b) => b.closeDate.localeCompare(a.closeDate))
      .map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })) }));
    return delay(rows, LATENCY.normal);
  },

  async getAccountMonitoring(accountId: string): Promise<AccountMonitoring> {
    const record = writtenMonitoring.get(accountId) ?? emptyMonitoring(accountId);
    // Deep copy so the form can edit freely without mutating the store.
    return delay(
      {
        ...record,
        customerProximity: { ...record.customerProximity },
        customerCentricity: { ...record.customerCentricity },
      },
      LATENCY.normal,
    );
  },

  async saveAccountMonitoring(monitoring: AccountMonitoring): Promise<AccountMonitoring> {
    const saved: AccountMonitoring = {
      ...monitoring,
      lastUpdatedAt: new Date().toISOString().slice(0, 10),
      lastUpdatedBy: MOCK_CURRENT_USER.displayName,
    };
    writtenMonitoring.set(monitoring.accountId, saved);
    return delay(saved, LATENCY.write);
  },

  async logMeeting(draft: MeetingLogDraft): Promise<MeetingLog> {
    const meeting: MeetingLog = {
      ...draft,
      meetingId: `mtg-${Math.random().toString(36).slice(2, 9)}`,
      loggedAt: new Date().toISOString().slice(0, 10),
      loggedBy: MOCK_CURRENT_USER.displayName,
    };
    writtenMeetings.unshift(meeting);
    return delay(meeting, LATENCY.write);
  },

  async getMeetings(accountId: string): Promise<MeetingLog[]> {
    const meetings = writtenMeetings
      .filter((m) => m.accountId === accountId)
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    return delay(meetings, LATENCY.normal);
  },

  async getNotifications(options?: NotificationQuery): Promise<AppNotification[]> {
    return delay(buildNotifications(options?.overdueAfterMonths), LATENCY.normal);
  },

  async getIncentives(): Promise<Incentive[]> {
    const all = [...createdIncentives, ...MOCK_INCENTIVES];
    return delay(
      [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      LATENCY.normal,
    );
  },

  async getIncentive(incentiveId: string): Promise<Incentive | undefined> {
    const all = [...createdIncentives, ...MOCK_INCENTIVES];
    return delay(
      all.find((i) => i.incentiveId === incentiveId),
      LATENCY.fast,
    );
  },

  async createIncentive(draft: IncentiveDraft): Promise<Incentive> {
    const now = new Date().toISOString();
    const incentive: Incentive = {
      ...draft,
      incentiveId: `inc-${now}-${Math.random().toString(36).slice(2, 8)}`,
      // A new incentive has nothing attached to it yet. Resources and
      // opportunities arrive afterwards — uploads and CRM records are separate
      // actions, not fields on the create form.
      resources: [],
      opportunities: [],
      createdAt: now,
      createdBy: MOCK_CURRENT_USER.displayName,
    };
    createdIncentives.unshift(incentive);
    return delay(incentive, LATENCY.write);
  },

  async setIncentiveAssignment(
    incentiveId: string,
    assignment: { userIds: string[]; roleIds: string[] },
  ): Promise<Incentive> {
    // Seeded incentives live in an imported array, so the write targets
    // whichever list actually holds the record.
    const incentive =
      createdIncentives.find((i) => i.incentiveId === incentiveId) ??
      MOCK_INCENTIVES.find((i) => i.incentiveId === incentiveId);
    if (!incentive) throw new Error(`Unknown incentive ${incentiveId}`);
    incentive.assignedUserIds = [...assignment.userIds];
    incentive.assignedRoleIds = [...assignment.roleIds];
    return delay(structuredClone(incentive), LATENCY.write);
  },

  /* ─── Admin ───────────────────────────────────────────────────────────── */

  async getWebRoles(): Promise<WebRole[]> {
    return delay(structuredClone(adminState.roles), LATENCY.fast);
  },

  async saveWebRole(role: WebRole): Promise<WebRole> {
    const index = adminState.roles.findIndex((r) => r.roleId === role.roleId);
    if (index === -1) {
      adminState.roles.push(structuredClone(role));
    } else {
      // A system-managed role is Power Pages' to maintain, not ours.
      if (adminState.roles[index].isSystemManaged) {
        throw new Error(`"${role.name}" is maintained by Power Pages and cannot be edited.`);
      }
      adminState.roles[index] = structuredClone(role);
    }
    return delay(structuredClone(role), LATENCY.write);
  },

  async deleteWebRole(roleId: string): Promise<void> {
    const role = adminState.roles.find((r) => r.roleId === roleId);
    if (role?.isSystemManaged) {
      throw new Error(`"${role.name}" is maintained by Power Pages and cannot be deleted.`);
    }
    const holders = adminState.users.filter((u) => u.roleIds.includes(roleId));
    if (holders.length > 0) {
      throw new Error(
        `${holders.length} user(s) still hold "${role?.name ?? roleId}". Move them to another role first.`,
      );
    }
    const assigned = [...createdIncentives, ...MOCK_INCENTIVES].filter((i) =>
      i.assignedRoleIds.includes(roleId),
    );
    if (assigned.length > 0) {
      throw new Error(
        `${assigned.length} incentive(s) are assigned to "${role?.name ?? roleId}". Reassign them first.`,
      );
    }
    adminState.roles = adminState.roles.filter((r) => r.roleId !== roleId);
    return delay(undefined, LATENCY.write);
  },

  async getPortalUsers(): Promise<PortalUser[]> {
    return delay(structuredClone(adminState.users), LATENCY.normal);
  },

  async setUserRoles(userId: string, roleIds: string[]): Promise<PortalUser> {
    const user = adminState.users.find((u) => u.userId === userId);
    if (!user) throw new Error(`Unknown user ${userId}`);
    user.roleIds = [...roleIds];
    return delay(structuredClone(user), LATENCY.write);
  },

  async setUserStatus(
    userId: string,
    status: PortalUser['status'],
  ): Promise<PortalUser> {
    const user = adminState.users.find((u) => u.userId === userId);
    if (!user) throw new Error(`Unknown user ${userId}`);
    user.status = status;
    return delay(structuredClone(user), LATENCY.write);
  },

  async getQuestionSections(): Promise<QuestionSection[]> {
    return delay(structuredClone(adminState.sections), LATENCY.fast);
  },

  async saveQuestionSection(section: QuestionSection): Promise<QuestionSection> {
    const index = adminState.sections.findIndex(
      (s) => s.sectionId === section.sectionId,
    );
    if (index === -1) {
      adminState.sections.push(structuredClone(section));
    } else {
      adminState.sections[index] = structuredClone(section);
    }
    return delay(structuredClone(section), LATENCY.write);
  },

  async deleteQuestionSection(sectionId: string): Promise<void> {
    // The guard lives here rather than only in the UI, because the rule is a
    // property of the data: a question whose section is gone renders nowhere.
    const held = adminState.questions.filter((q) => q.sectionId === sectionId);
    if (held.length > 0) {
      throw new Error(
        `Cannot delete this section while it still holds ${held.length} question(s). Move or delete them first.`,
      );
    }
    adminState.sections = adminState.sections.filter((s) => s.sectionId !== sectionId);
    return delay(undefined, LATENCY.write);
  },

  async getQuestions(): Promise<QuestionDefinition[]> {
    return delay(structuredClone(adminState.questions), LATENCY.normal);
  },

  async saveQuestion(question: QuestionDefinition): Promise<QuestionDefinition> {
    const index = adminState.questions.findIndex(
      (q) => q.questionId === question.questionId,
    );
    if (index === -1) {
      adminState.questions.push(structuredClone(question));
    } else {
      adminState.questions[index] = structuredClone(question);
    }
    return delay(structuredClone(question), LATENCY.write);
  },

  async deleteQuestion(questionId: string): Promise<void> {
    adminState.questions = adminState.questions.filter(
      (q) => q.questionId !== questionId,
    );
    return delay(undefined, LATENCY.write);
  },

  async getOptionSets(): Promise<OptionSet[]> {
    return delay(structuredClone(adminState.optionSets), LATENCY.normal);
  },

  async saveOptionSet(optionSet: OptionSet): Promise<OptionSet> {
    const index = adminState.optionSets.findIndex(
      (o) => o.optionSetId === optionSet.optionSetId,
    );
    if (index === -1) {
      adminState.optionSets.push(structuredClone(optionSet));
    } else {
      adminState.optionSets[index] = structuredClone(optionSet);
    }
    return delay(structuredClone(optionSet), LATENCY.write);
  },

  async deleteOptionSet(optionSetId: string): Promise<void> {
    const set = adminState.optionSets.find((o) => o.optionSetId === optionSetId);

    // Two separate reasons a list cannot go, and they catch different cases.
    // A question reference is visible in this screen; a CODE dependency is not —
    // SLA tiers back a typed union and the contracts table, and nothing in the
    // question list would have stopped that one being deleted.
    if (set?.codeDependent) {
      throw new Error(
        `"${set.name}" is still matched by value in the front end — deleting it would break the screens that depend on those exact options. It can be removed once the app reads this list at runtime.`,
      );
    }

    const used = adminState.questions.filter((q) => q.optionSetId === optionSetId);
    if (used.length > 0) {
      throw new Error(
        `Cannot delete this dropdown while ${used.length} question(s) still use it. Point them at another list first.`,
      );
    }
    adminState.optionSets = adminState.optionSets.filter(
      (o) => o.optionSetId !== optionSetId,
    );
    return delay(undefined, LATENCY.write);
  },
};

/**
 * Derives the notification list from current monitoring records.
 *
 * Nothing is stored: a notification exists because a date is overdue, so saving
 * a new date makes it disappear on the next read. That's the behaviour a rep
 * expects — clear the work, clear the alert — and it means there is no separate
 * notification table to keep in sync.
 *
 * Two rules are seeded, per the brief: an overdue workshop, and a missing or
 * overdue executive sponsor service review.
 */
function buildNotifications(
  overdueAfterMonths: number = MONITORING_OVERDUE_MONTHS,
): AppNotification[] {
  const notifications: AppNotification[] = [];

  for (const account of MOCK_ACCOUNTS) {
    const record = writtenMonitoring.get(account.accountId);
    if (!record) continue;

    const workshop = record.customerProximity.lastWorkshop;
    if (isOverdue(workshop, overdueAfterMonths)) {
      notifications.push({
        id: `${account.accountId}-workshop`,
        severity: workshop ? 'warning' : 'critical',
        title: workshop ? 'Workshop overdue' : 'No workshop recorded',
        detail: workshop
          ? `Last workshop was ${formatRelative(workshop).toLowerCase()} — past the ${overdueAfterMonths}-month cadence.`
          : `No workshop has ever been recorded for this account.`,
        accountId: account.accountId,
        accountName: account.accountName,
        target: { ribbon: 'monitoring', fieldId: 'mon-workshop' },
      });
    }

    const sponsorReview = record.customerCentricity.lastServiceReviewWithSponsor;
    if (isOverdue(sponsorReview, overdueAfterMonths)) {
      notifications.push({
        id: `${account.accountId}-sponsor-review`,
        severity: sponsorReview ? 'warning' : 'critical',
        title: sponsorReview
          ? 'Executive sponsor review overdue'
          : 'No executive sponsor review recorded',
        detail: sponsorReview
          ? `Last service review with the executive sponsor was ${formatRelative(sponsorReview).toLowerCase()}.`
          : 'No service review with the executive sponsor has been recorded.',
        accountId: account.accountId,
        accountName: account.accountName,
        target: { ribbon: 'monitoring', fieldId: 'mon-sponsor-review' },
      });
    }
  }

  // Critical first, then warning, then info.
  const order: Record<AppNotification['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return notifications.sort((a, b) => order[a.severity] - order[b.severity]);
}
