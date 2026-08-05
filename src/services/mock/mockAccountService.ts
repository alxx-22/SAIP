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
  CurrentUser,
  MeetingLog,
  MeetingLogDraft,
  Score,
  ServiceContract,
  ValueOverview,
} from '../types';
import {
  MOCK_ACCOUNTS,
  MOCK_ACCOUNT_SCORES,
  MOCK_CONTRACTS,
  MOCK_CURRENT_USER,
  MOCK_DEFAULT_ACCOUNT_SCORES,
  MOCK_DEFAULT_CONTRACTS,
  MOCK_DEFAULT_VALUE_OVERVIEW,
  MOCK_MEETINGS,
  MOCK_MONITORING,
  MOCK_PORTFOLIO_SCORES,
  MOCK_VALUE_OVERVIEW,
  emptyMonitoring,
} from './mockData';

/** Simulated network latency, in ms. */
const LATENCY = { fast: 220, normal: 420, write: 640 };

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
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
    const overview = MOCK_VALUE_OVERVIEW[accountId] ?? MOCK_DEFAULT_VALUE_OVERVIEW;
    return delay({ ...overview }, LATENCY.normal);
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
};
