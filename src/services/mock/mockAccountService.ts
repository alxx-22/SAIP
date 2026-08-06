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
  AccountService,
  AppNotification,
  CurrentUser,
  MeetingLog,
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
import { MONITORING_OVERDUE_MONTHS, formatRelative, isOverdue } from '../derive';

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
