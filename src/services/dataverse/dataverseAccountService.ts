/**
 * `AccountService`, backed by the Dataverse tables in the SAIPDemo solution.
 *
 * The other half of `mockAccountService`. Same interface, same derived rules —
 * only the source of the rows changes, which is the whole point of the swap
 * point in `services/index.ts`.
 *
 * THREE THINGS ARE DELIBERATELY DERIVED HERE RATHER THAN STORED, and they are
 * the same three the mock derives, so behaviour does not change with the data
 * source:
 *
 *   - Notifications. An overdue workshop is a fact about a date, not a row
 *     somebody has to remember to create and dismiss. Saving the date clears
 *     the alert on the next read.
 *   - The SLA spend breakdown. Computed from the contracts so the Value
 *     Overview and the contracts table can never disagree about the same money.
 *   - Portfolio scores. Rolled up from the per-account scores rather than
 *     stored separately, which would be a second number to keep in step.
 *
 * ONE THING HAS NO SOURCE AND SAYS SO. `ValueOverview`'s hardware spend and
 * prediction fields have no table behind them — they came from the brief as
 * modelled figures and no dataflow produces them yet. They are returned as
 * zeroes rather than invented, so the ribbon renders visibly empty. See
 * `emptyPrediction` below. This is the one place the Dataverse path shows less
 * than the mock, and that is the correct trade: a plausible fabricated number
 * in a revenue prediction is worse than a blank.
 */

import type {
  Account,
  AccountMonitoring,
  AccountOpportunity,
  AccountService,
  AppNotification,
  Capability,
  CurrentUser,
  Incentive,
  IncentiveDraft,
  IncentiveOpportunity,
  IncentiveResource,
  IncentiveType,
  MeetingLog,
  MeetingLogDraft,
  MeetingPlace,
  MeetingTag,
  NotificationQuery,
  OptionSet,
  OpportunityLine,
  OpportunityStage,
  PortalUser,
  QuestionDefinition,
  QuestionInputType,
  QuestionSection,
  Score,
  ScoreKey,
  ScoreStatus,
  ServiceContract,
  SlaCoverageModel,
  SlaSpendSlice,
  SlaTier,
  ValueOverview,
  WebRole,
} from '../types';
import { MONITORING_OVERDUE_MONTHS, formatRelative, isOverdue } from '../derive';
import { KEY_FIELD, NAME_FIELD } from './entitySets';
import {
  bool,
  create,
  day,
  idForKey,
  list,
  num,
  orFilterChunks,
  readAll,
  remove,
  str,
  upsertByKey,
  type Row,
} from './webApi';

/* ─── Small helpers ───────────────────────────────────────────────────────── */

const key = (row: Row): string => str(row[KEY_FIELD]);
const name = (row: Row): string => str(row[NAME_FIELD]);
const f = (column: string): string => `saip_${column}`;

/** Reads several filters' worth of rows and flattens them. */
async function readChunked(
  table: Parameters<typeof readAll>[0],
  filters: string[],
  order?: string,
): Promise<Row[]> {
  if (filters.length === 0) return [];
  const pages = await Promise.all(
    filters.map((filter) =>
      readAll(table, `$filter=${encodeURIComponent(filter)}${order ? `&$orderby=${order}` : ''}`),
    ),
  );
  return pages.flat();
}

/**
 * Narrows a free-text column to a union, falling back to the first member.
 *
 * These columns are plain text in Dataverse rather than choice columns —
 * deliberately, because the eventual source is a Fabric virtual table and a
 * virtual table cannot carry a Dataverse option set. That leaves the front end
 * responsible for the narrowing, and a value it does not recognise has to land
 * somewhere rather than crashing a page.
 */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = str(value);
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

const SLA_TIERS = [
  'Complete Care',
  'Tech Care Basic',
  'Tech Care Essential',
  'Tech Care Critical',
] as const satisfies readonly SlaTier[];

const STAGES = [
  'Qualify',
  'Propose',
  'Negotiate',
  'Closed won',
  'Closed lost',
] as const satisfies readonly OpportunityStage[];

const SCORE_STATUSES = ['strong', 'watch', 'attention'] as const satisfies readonly ScoreStatus[];
const SCORE_KEYS = ['proximity', 'centricity', 'spend'] as const satisfies readonly ScoreKey[];
const INPUT_TYPES = [
  'date',
  'text',
  'longtext',
  'number',
  'boolean',
  'choice',
  'multichoice',
] as const satisfies readonly QuestionInputType[];
const INCENTIVE_TYPES = [
  'Sales Training',
  'Upsell',
  'Workshop',
  'Sales Play',
] as const satisfies readonly IncentiveType[];
const MEETING_PLACES = [
  'Phone Call',
  'Teams',
  'Customer Site',
  'CIC',
  'Channel Partner Site',
] as const satisfies readonly MeetingPlace[];
const MEETING_TAGS = [
  'Workshop',
  'Upsell',
  'SLA Review',
  'Spend Review',
  'Leadership Introduction',
] as const satisfies readonly MeetingTag[];

/** A readable, unique key for a record the app is creating. */
function newKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/* ─── Row -> domain ───────────────────────────────────────────────────────── */

function toAccount(row: Row): Account {
  return {
    accountId: key(row),
    accountName: name(row),
    companyGroupId: str(row[f('companygroupid')]),
    industry: str(row[f('industry')]),
    region: str(row[f('region')]),
    annualServicesRevenue: num(row[f('annualservicesrevenue')]),
    currency: str(row[f('currencycode')]) || 'GBP',
    activeContractCount: num(row[f('activecontractcount')]),
    lastMeetingDate: day(row[f('lastmeetingdate')]),
  };
}

function toScore(row: Row): Score & { accountId: string } {
  return {
    accountId: str(row[f('accountkey')]),
    key: oneOf(row[f('scorekey')], SCORE_KEYS, 'proximity'),
    label: name(row),
    value: num(row[f('value')]),
    status: oneOf(row[f('status')], SCORE_STATUSES, 'watch'),
    explainer: str(row[f('explainer')]),
    deltaPoints: num(row[f('deltapoints')]),
  };
}

function toContract(row: Row): ServiceContract {
  return {
    contractId: key(row),
    sla: oneOf(row[f('sla')], SLA_TIERS, 'Tech Care Basic'),
    value: num(row[f('value')]),
    currency: str(row[f('currencycode')]) || 'GBP',
    cities: list(row[f('cities')]),
    renewalDate: day(row[f('renewaldate')]) ?? todayIso(),
  };
}

function toMeeting(row: Row): MeetingLog {
  return {
    meetingId: key(row),
    accountId: str(row[f('accountkey')]),
    meetingDate: day(row[f('meetingdate')]) ?? todayIso(),
    place: oneOf(row[f('place')], MEETING_PLACES, 'Teams'),
    subject: str(row[f('subject')]) || name(row),
    comments: str(row[f('comments')]),
    tags: list(row[f('tags')]).filter((tag): tag is MeetingTag =>
      (MEETING_TAGS as readonly string[]).includes(tag),
    ),
    loggedAt: day(row['createdon']) ?? day(row[f('meetingdate')]) ?? todayIso(),
    loggedBy: str(row[f('loggedby')]),
  };
}

function toOpportunityLine(row: Row): OpportunityLine {
  return {
    lineId: key(row),
    productName: name(row),
    productCategory: str(row[f('productcategory')]),
    value: num(row[f('value')]),
    currency: str(row[f('currencycode')]) || 'GBP',
  };
}

function toAccountOpportunity(row: Row, lines: OpportunityLine[]): AccountOpportunity {
  return {
    opportunityId: key(row),
    opportunityNumber: str(row[f('opportunitynumber')]),
    name: name(row),
    description: str(row[f('description')]),
    accountId: str(row[f('accountkey')]),
    companyGroupId: str(row[f('companygroupid')]),
    stage: oneOf(row[f('stage')], STAGES, 'Qualify'),
    forecastCategory: str(row[f('forecastcategory')]),
    closeDate: day(row[f('closedate')]) ?? todayIso(),
    ownerName: str(row[f('ownername')]),
    ownerEmail: str(row[f('owneremail')]),
    // Empty string is how "no campaign" is stored — the column is text, and a
    // text column cannot hold null in a way the seeder round-trips.
    campaignName: str(row[f('campaignname')]) || null,
    salesMotion: str(row[f('salesmotion')]),
    totalValue: num(row[f('totalvalue')]),
    currency: str(row[f('currencycode')]) || 'GBP',
    lines,
  };
}

function toIncentiveOpportunity(row: Row, accountName: string): IncentiveOpportunity {
  return {
    opportunityId: str(row[f('opportunitynumber')]) || key(row),
    accountId: str(row[f('accountkey')]),
    accountName,
    description: str(row[f('description')]) || name(row),
    value: num(row[f('totalvalue')]),
    currency: str(row[f('currencycode')]) || 'GBP',
    stage: oneOf(row[f('stage')], STAGES, 'Qualify'),
    closeDate: day(row[f('closedate')]) ?? todayIso(),
  };
}

function toResource(row: Row): IncentiveResource {
  return {
    resourceId: key(row),
    name: name(row),
    kind: 'pdf',
    sizeBytes: num(row[f('sizebytes')]),
    uploadedAt: day(row[f('uploadedon')]) ?? '',
    uploadedBy: str(row[f('uploadedby')]),
    /*
      Null until the document upload path exists.

      The bytes live in a Dataverse note against this row, and nothing writes
      or reads one yet. Null is what the UI already renders as "unavailable",
      so a document row without a file behind it is honest rather than a broken
      download link.
    */
    url: null,
  };
}

function toWebRole(row: Row): WebRole {
  return {
    roleId: key(row),
    name: name(row),
    description: str(row[f('description')]),
    isAdministrator: bool(row[f('isadministrator')]),
    isSystemManaged: bool(row[f('issystemmanaged')]),
    capabilities: list(row[f('capabilitykeys')]) as Capability[],
  };
}

function toPortalUser(row: Row): PortalUser {
  return {
    userId: key(row),
    displayName: name(row),
    email: str(row[f('email')]),
    roleIds: list(row[f('rolekeys')]),
    status: str(row[f('status')]) === 'disabled' ? 'disabled' : 'active',
    lastSignIn: day(row[f('lastsignin')]),
  };
}

function toQuestionSection(row: Row): QuestionSection {
  return {
    sectionId: key(row),
    title: name(row),
    description: str(row[f('description')]),
    area: str(row[f('area')]) === 'meeting-log' ? 'meeting-log' : 'account-monitoring',
    order: num(row[f('sortorder')]),
    enabled: bool(row[f('isenabled')]),
  };
}

function toQuestion(row: Row): QuestionDefinition {
  return {
    questionId: key(row),
    sectionId: str(row[f('sectionkey')]),
    label: name(row),
    helpText: str(row[f('helptext')]),
    inputType: oneOf(row[f('inputtype')], INPUT_TYPES, 'text'),
    required: bool(row[f('isrequired')]),
    order: num(row[f('sortorder')]),
    enabled: bool(row[f('isenabled')]),
    optionSetId: str(row[f('optionsetkey')]) || null,
    nameProvisional: bool(row[f('nameprovisional')]),
    systemReferences: list(row[f('systemreferences')]),
  };
}

/* ─── Account Monitoring <-> answer rows ──────────────────────────────────── */

/**
 * Which question key holds which field of `AccountMonitoring`.
 *
 * The monitoring record is one row per answer in Dataverse and a fixed nested
 * object in the UI, so the translation has to live somewhere. Here, once, in a
 * table — because the same map drives reading, writing and the notification
 * deep links, and three copies of it would drift.
 *
 * The keys match `saip_questionkey` on the answer rows AND the `fieldId` a
 * notification targets AND the DOM id of the form control. That is not a
 * coincidence to be tidied away later: it is what lets a notification open the
 * right ribbon and focus the right input without a second lookup table.
 */
const MONITORING_FIELDS = [
  { questionKey: 'mon-stakeholder-meeting', group: 'customerProximity', field: 'lastStakeholderMeeting' },
  { questionKey: 'mon-workshop', group: 'customerProximity', field: 'lastWorkshop' },
  { questionKey: 'mon-spend-review', group: 'customerProximity', field: 'lastSpendOrSlaReview' },
  { questionKey: 'mon-customer-visit', group: 'customerCentricity', field: 'lastCustomerVisit' },
  { questionKey: 'mon-performance-review', group: 'customerCentricity', field: 'lastPerformanceReview' },
  { questionKey: 'mon-exec-engagement', group: 'customerCentricity', field: 'lastExecutiveEngagement' },
  { questionKey: 'mon-sponsor-review', group: 'customerCentricity', field: 'lastServiceReviewWithSponsor' },
] as const;

function emptyMonitoring(accountId: string): AccountMonitoring {
  return {
    accountId,
    customerProximity: {
      lastStakeholderMeeting: null,
      lastWorkshop: null,
      lastSpendOrSlaReview: null,
    },
    customerCentricity: {
      lastCustomerVisit: null,
      lastPerformanceReview: null,
      lastExecutiveEngagement: null,
      lastServiceReviewWithSponsor: null,
    },
    lastUpdatedAt: null,
    lastUpdatedBy: null,
  };
}

function monitoringFromRows(accountId: string, rows: Row[]): AccountMonitoring {
  const record = emptyMonitoring(accountId);
  const byQuestion = new Map(rows.map((row) => [str(row[f('questionkey')]), row]));

  for (const { questionKey, group, field } of MONITORING_FIELDS) {
    const row = byQuestion.get(questionKey);
    if (!row) continue;
    // Indexed write into a discriminated nested shape: the map above is the
    // only thing that knows these pairings, so the cast is contained to here.
    (record[group] as Record<string, string | null>)[field] = day(row[f('valuedate')]);

    const modified = day(row['modifiedon']);
    if (modified && (!record.lastUpdatedAt || modified > record.lastUpdatedAt)) {
      record.lastUpdatedAt = modified;
      record.lastUpdatedBy = str(row[f('updatedby')]) || record.lastUpdatedBy;
    }
  }

  return record;
}

/* ─── Derived: SLA breakdown, portfolio scores, notifications ─────────────── */

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
      // Contracts for a customer-level account, sites for a per-location one —
      // the same distinction the mock draws, because it is how the customer
      // buys rather than an artefact of the fixtures.
      count: existing.count + (coverage === 'location' ? contract.cities.length : 1),
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
 * Whether an account is contracted once centrally or once per site.
 *
 * INFERRED, because no column carries it. An account whose contracts each name
 * a single city is buying per location; one contract spanning several cities is
 * a customer-level agreement. That is the same signal a human reads off the
 * contracts table, and it means the Value Overview labels the breakdown
 * correctly without a field somebody has to remember to set.
 */
function inferCoverageModel(contracts: ServiceContract[]): SlaCoverageModel {
  if (contracts.length === 0) return 'customer';
  return contracts.every((contract) => contract.cities.length <= 1) ? 'location' : 'customer';
}

/**
 * The hardware spend and prediction half of `ValueOverview`.
 *
 * No dataflow produces these yet. Returned as zeroes so the ribbon renders an
 * obvious blank rather than a number nobody can trace — a fabricated revenue
 * prediction is the one thing on this page that could actually mislead someone
 * into a decision.
 */
const emptyPrediction = {
  previous48MonthHardwareSpend: 0,
  predictedNext12MonthHardwareSpend: 0,
  predictionConfidence: 0,
};

/* ─── The signed-in user ──────────────────────────────────────────────────── */

/**
 * Identity, in the order it can be trusted.
 *
 * 1. `window.SAIP_USER`, which a one-line Liquid snippet on the page template
 *    fills in from the portal's own session. This is the only source that is
 *    actually authoritative about who is signed in, and it is what should be
 *    used in production — see the README for the snippet.
 * 2. Failing that, a `saip_user` row matching that email.
 * 3. Failing that, the first user in the table, with a console warning.
 *
 * Step 3 exists so the app is usable before the snippet is added, and warns
 * loudly because "everyone is Sample User" is a security-shaped bug the moment
 * anything reads permissions off it.
 */
interface InjectedUser {
  id?: string;
  name?: string;
  email?: string;
}

async function resolveCurrentUser(): Promise<CurrentUser> {
  const injected = (window as unknown as { SAIP_USER?: InjectedUser }).SAIP_USER;
  const users = await readAll('user');

  const match = injected?.email
    ? users.find(
        (row) => str(row[f('email')]).toLowerCase() === injected.email!.toLowerCase(),
      )
    : undefined;

  const row = match ?? users[0];

  if (!injected?.email) {
    console.warn(
      '[SAIP] No window.SAIP_USER on the page, so the signed-in user is being ' +
        'guessed from the first saip_user row. Add the Liquid snippet from the ' +
        'README to the page template before relying on roles or permissions.',
    );
  } else if (!match) {
    console.warn(
      `[SAIP] Signed in as ${injected.email}, but there is no saip_user row with ` +
        'that email. Falling back to the first user.',
    );
  }

  if (!row) {
    // An empty user table is a configuration problem, not a state to render.
    return {
      userId: injected?.id ?? 'unknown',
      displayName: injected?.name ?? 'Unknown user',
      email: injected?.email ?? '',
      roleIds: [],
    };
  }

  return {
    userId: key(row),
    displayName: injected?.name || name(row),
    email: str(row[f('email')]),
    roleIds: list(row[f('rolekeys')]),
  };
}

/* ─── The service ─────────────────────────────────────────────────────────── */

export const dataverseAccountService: AccountService = {
  async getCurrentUser(): Promise<CurrentUser> {
    return resolveCurrentUser();
  },

  async getAccounts(): Promise<Account[]> {
    const rows = await readAll('account', `$orderby=${NAME_FIELD} asc`);
    return rows.map(toAccount);
  },

  async getAccount(accountId: string): Promise<Account | undefined> {
    const rows = await readChunked('account', orFilterChunks(KEY_FIELD, [accountId]));
    return rows[0] ? toAccount(rows[0]) : undefined;
  },

  /**
   * Portfolio scores: the mean of each metric across every account.
   *
   * Rolled up rather than stored. A second set of rows holding the same numbers
   * at a different grain is a reconciliation problem waiting to happen, and the
   * per-account scores are already the thing being averaged.
   */
  async getPortfolioScores(): Promise<Score[]> {
    const rows = (await readAll('score')).map(toScore);
    if (rows.length === 0) return [];

    return SCORE_KEYS.map((scoreKey) => {
      const matching = rows.filter((score) => score.key === scoreKey);
      if (matching.length === 0) return null;

      const mean = (values: number[]): number =>
        Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

      const value = mean(matching.map((score) => score.value));
      return {
        key: scoreKey,
        label: matching[0].label,
        value,
        // Recomputed from the average rather than averaged: status is a band,
        // and the mean of three bands is not a band.
        status: value >= 70 ? 'strong' : value >= 50 ? 'watch' : 'attention',
        explainer: `Average ${matching[0].label.toLowerCase()} across ${matching.length} account${matching.length === 1 ? '' : 's'}.`,
        deltaPoints: mean(matching.map((score) => score.deltaPoints)),
      } satisfies Score;
    }).filter((score): score is Score => score !== null);
  },

  async getAccountScores(accountId: string): Promise<Score[]> {
    const rows = await readChunked('score', orFilterChunks(f('accountkey'), [accountId]));
    const scores: Score[] = rows.map(toScore);
    // Fixed order, so the three gauges never swap places between accounts.
    return SCORE_KEYS.map((scoreKey) => scores.find((score) => score.key === scoreKey)).filter(
      (score): score is Score => score !== undefined,
    );
  },

  async getValueOverview(accountId: string): Promise<ValueOverview> {
    const [contracts, meetings] = await Promise.all([
      this.getServiceContracts(accountId),
      this.getMeetings(accountId),
    ]);

    const totalContractedSpend = contracts.reduce((sum, contract) => sum + contract.value, 0);
    const coverage = inferCoverageModel(contracts);
    const slaBreakdown = buildSlaBreakdown(contracts, coverage, totalContractedSpend);

    /*
      "SLA spend" is the whole of contracted spend here, because every contract
      carries exactly one SLA — see the note on ServiceContract. The percentage
      is kept in the shape rather than hard-coded to 100 so a future split
      between SLA and non-SLA lines has somewhere to land.
    */
    const slaSpend = slaBreakdown.reduce((sum, slice) => sum + slice.value, 0);

    // The last upsell is the most recent meeting tagged as one. Meetings are
    // already sorted newest first by getMeetings.
    const upsell = meetings.find((meeting) => meeting.tags.includes('Upsell'));

    return {
      slaSpendPercent: totalContractedSpend > 0 ? (slaSpend / totalContractedSpend) * 100 : 0,
      totalContractedSpend,
      slaCoverageModel: coverage,
      slaBreakdown,
      lastUpsellDate: upsell?.meetingDate ?? null,
      lastUpsellDescription: upsell?.subject ?? null,
      currency: contracts[0]?.currency ?? 'GBP',
      ...emptyPrediction,
    };
  },

  async getServiceContracts(accountId: string): Promise<ServiceContract[]> {
    const rows = await readChunked('servicecontract', orFilterChunks(f('accountkey'), [accountId]));
    return rows
      .map(toContract)
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  },

  /**
   * Opportunities for one account, with their product lines.
   *
   * TWO READS, NOT N+1. The opportunities come back first, then every line for
   * every one of them in a single filtered read (chunked by URL length). One
   * request per opportunity would be twelve round trips on a busy account, and
   * the Web API is same-origin but not free.
   */
  async getAccountOpportunities(accountId: string): Promise<AccountOpportunity[]> {
    const opportunityRows = await readChunked(
      'opportunity',
      orFilterChunks(f('accountkey'), [accountId]),
    );
    if (opportunityRows.length === 0) return [];

    const numbers = opportunityRows.map((row) => str(row[f('opportunitynumber')])).filter(Boolean);
    const lineRows = await readChunked('opportunityline', orFilterChunks(f('opportunitynumber'), numbers));

    const linesByOpportunity = new Map<string, OpportunityLine[]>();
    for (const row of lineRows) {
      const number = str(row[f('opportunitynumber')]);
      const existing = linesByOpportunity.get(number) ?? [];
      existing.push(toOpportunityLine(row));
      linesByOpportunity.set(number, existing);
    }

    return opportunityRows
      .map((row) =>
        toAccountOpportunity(
          row,
          (linesByOpportunity.get(str(row[f('opportunitynumber')])) ?? []).sort(
            (a, b) => b.value - a.value,
          ),
        ),
      )
      .sort((a, b) => b.closeDate.localeCompare(a.closeDate));
  },

  async getAccountMonitoring(accountId: string): Promise<AccountMonitoring> {
    const rows = await readChunked('monitoringanswer', orFilterChunks(f('accountkey'), [accountId]));
    return monitoringFromRows(accountId, rows);
  },

  /**
   * Writes the seven answers as seven rows, matched on `<account>:<question>`.
   *
   * Upserts rather than deletes-and-recreates: a monitoring row carries its own
   * created/modified audit, and rewriting it from scratch every save would
   * throw that away and make "when did this last change" unanswerable.
   */
  async saveAccountMonitoring(monitoring: AccountMonitoring): Promise<AccountMonitoring> {
    const user = await resolveCurrentUser();

    await Promise.all(
      MONITORING_FIELDS.map(({ questionKey, group, field }) => {
        const value = (monitoring[group] as Record<string, string | null>)[field];
        return upsertByKey('monitoringanswer', `${monitoring.accountId}:${questionKey}`, {
          [NAME_FIELD]: `${monitoring.accountId} ${questionKey}`,
          [f('accountkey')]: monitoring.accountId,
          [f('questionkey')]: questionKey,
          [f('valuedate')]: value,
          [f('updatedby')]: user.displayName,
        });
      }),
    );

    return {
      ...monitoring,
      customerProximity: { ...monitoring.customerProximity },
      customerCentricity: { ...monitoring.customerCentricity },
      lastUpdatedAt: todayIso(),
      lastUpdatedBy: user.displayName,
    };
  },

  async logMeeting(draft: MeetingLogDraft): Promise<MeetingLog> {
    const user = await resolveCurrentUser();
    const meetingKey = newKey('mtg');

    await create('meeting', {
      [KEY_FIELD]: meetingKey,
      [NAME_FIELD]: draft.subject || 'Meeting',
      [f('accountkey')]: draft.accountId,
      [f('meetingdate')]: draft.meetingDate,
      [f('place')]: draft.place,
      [f('tags')]: draft.tags.join(','),
      [f('subject')]: draft.subject,
      [f('comments')]: draft.comments,
      [f('loggedby')]: user.displayName,
    });

    return {
      ...draft,
      meetingId: meetingKey,
      loggedAt: todayIso(),
      loggedBy: user.displayName,
    };
  },

  async getMeetings(accountId: string): Promise<MeetingLog[]> {
    const rows = await readChunked('meeting', orFilterChunks(f('accountkey'), [accountId]));
    return rows
      .map(toMeeting)
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  },

  /**
   * Derived across every account, most severe first.
   *
   * Reads both tables whole rather than per account: this runs on every page
   * for the notification pane, and one read of each beats one read per account
   * by a distance that grows with the portfolio.
   */
  async getNotifications(options?: NotificationQuery): Promise<AppNotification[]> {
    const months = options?.overdueAfterMonths ?? MONITORING_OVERDUE_MONTHS;
    const [accountRows, answerRows] = await Promise.all([
      readAll('account'),
      readAll('monitoringanswer'),
    ]);

    const answersByAccount = new Map<string, Row[]>();
    for (const row of answerRows) {
      const accountId = str(row[f('accountkey')]);
      const existing = answersByAccount.get(accountId) ?? [];
      existing.push(row);
      answersByAccount.set(accountId, existing);
    }

    const notifications: AppNotification[] = [];

    for (const row of accountRows) {
      const account = toAccount(row);
      const answers = answersByAccount.get(account.accountId);
      // No monitoring record at all means the account has never been reviewed.
      // The mock skips these rather than filing two alerts for every untouched
      // account, and matching that keeps the pane comparable across sources.
      if (!answers) continue;

      const record = monitoringFromRows(account.accountId, answers);

      const rules = [
        {
          id: 'workshop',
          value: record.customerProximity.lastWorkshop,
          fieldId: 'mon-workshop',
          presentTitle: 'Workshop overdue',
          absentTitle: 'No workshop recorded',
          presentDetail: (relative: string) =>
            `Last workshop was ${relative} — past the ${months}-month cadence.`,
          absentDetail: 'No workshop has ever been recorded for this account.',
        },
        {
          id: 'sponsor-review',
          value: record.customerCentricity.lastServiceReviewWithSponsor,
          fieldId: 'mon-sponsor-review',
          presentTitle: 'Executive sponsor review overdue',
          absentTitle: 'No executive sponsor review recorded',
          presentDetail: (relative: string) =>
            `Last service review with the executive sponsor was ${relative}.`,
          absentDetail:
            'No service review with the executive sponsor has been recorded.',
        },
      ] as const;

      for (const rule of rules) {
        if (!isOverdue(rule.value, months)) continue;
        notifications.push({
          id: `${account.accountId}-${rule.id}`,
          severity: rule.value ? 'warning' : 'critical',
          title: rule.value ? rule.presentTitle : rule.absentTitle,
          detail: rule.value
            ? rule.presentDetail(formatRelative(rule.value).toLowerCase())
            : rule.absentDetail,
          accountId: account.accountId,
          accountName: account.accountName,
          target: { ribbon: 'monitoring', fieldId: rule.fieldId },
        });
      }
    }

    const order = { critical: 0, warning: 1, info: 2 } as const;
    return notifications.sort((a, b) => order[a.severity] - order[b.severity]);
  },

  /* ─── Incentives ──────────────────────────────────────────────────────── */

  async getIncentives(): Promise<Incentive[]> {
    const [incentiveRows, documentRows, accountRows] = await Promise.all([
      readAll('incentive'),
      readAll('incentivedocument'),
      readAll('account'),
    ]);

    const accountNames = new Map(accountRows.map((row) => [key(row), name(row)]));

    const documentsByIncentive = new Map<string, IncentiveResource[]>();
    for (const row of [...documentRows].sort(
      (a, b) => num(a[f('sortorder')]) - num(b[f('sortorder')]),
    )) {
      const incentiveKey = str(row[f('incentivekey')]);
      const existing = documentsByIncentive.get(incentiveKey) ?? [];
      existing.push(toResource(row));
      documentsByIncentive.set(incentiveKey, existing);
    }

    /*
      Opportunities are joined to an incentive BY CAMPAIGN CODE, not by a
      foreign key — that is how the CRM actually relates them, and it is why an
      incentive without a campaign code shows an explanation rather than an
      empty table. Read once for every code rather than once per incentive.
    */
    const codes = incentiveRows.map((row) => str(row[f('campaigncode')])).filter(Boolean);
    const opportunityRows = codes.length
      ? await readChunked('opportunity', orFilterChunks(f('campaignname'), codes))
      : [];

    const opportunitiesByCode = new Map<string, IncentiveOpportunity[]>();
    for (const row of opportunityRows) {
      const code = str(row[f('campaignname')]);
      const existing = opportunitiesByCode.get(code) ?? [];
      existing.push(
        toIncentiveOpportunity(row, accountNames.get(str(row[f('accountkey')])) ?? 'Unknown account'),
      );
      opportunitiesByCode.set(code, existing);
    }

    return incentiveRows
      .map((row): Incentive => {
        const code = str(row[f('campaigncode')]);
        return {
          incentiveId: key(row),
          title: name(row),
          overview: str(row[f('overview')]),
          campaignCode: code || null,
          type: oneOf(row[f('type')], INCENTIVE_TYPES, 'Sales Play'),
          startDate: day(row[f('startdate')]) ?? todayIso(),
          endDate: day(row[f('enddate')]),
          resources: documentsByIncentive.get(key(row)) ?? [],
          nominatedAccountIds: list(row[f('nominatedaccountkeys')]),
          assignedUserIds: list(row[f('assigneduserkeys')]),
          assignedRoleIds: list(row[f('assignedrolekeys')]),
          opportunities: code ? (opportunitiesByCode.get(code) ?? []) : [],
          createdAt: str(row['createdon']) || `${day(row[f('startdate')]) ?? todayIso()}T00:00:00Z`,
          createdBy: str(row[f('createdby')]),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getIncentive(incentiveId: string): Promise<Incentive | undefined> {
    // Reads the list and picks one. The joins above (documents, campaign
    // opportunities, account names) are what make an incentive whole, and
    // repeating them for the single-record case would be a second definition
    // of what an incentive is.
    const all = await this.getIncentives();
    return all.find((incentive) => incentive.incentiveId === incentiveId);
  },

  async createIncentive(draft: IncentiveDraft): Promise<Incentive> {
    const user = await resolveCurrentUser();
    const incentiveKey = newKey('inc');

    await create('incentive', {
      [KEY_FIELD]: incentiveKey,
      [NAME_FIELD]: draft.title,
      [f('overview')]: draft.overview,
      [f('campaigncode')]: draft.campaignCode ?? '',
      [f('type')]: draft.type,
      [f('startdate')]: draft.startDate,
      [f('enddate')]: draft.endDate,
      [f('createdby')]: user.displayName,
      [f('nominatedaccountkeys')]: draft.nominatedAccountIds.join(','),
      [f('assigneduserkeys')]: draft.assignedUserIds.join(','),
      [f('assignedrolekeys')]: draft.assignedRoleIds.join(','),
    });

    return {
      ...draft,
      incentiveId: incentiveKey,
      // Nothing is attached to a brand new incentive: uploads and CRM records
      // are separate actions, not fields on the create form.
      resources: [],
      opportunities: [],
      createdAt: new Date().toISOString(),
      createdBy: user.displayName,
    };
  },

  async setIncentiveAssignment(
    incentiveId: string,
    assignment: { userIds: string[]; roleIds: string[] },
  ): Promise<Incentive> {
    await upsertByKey('incentive', incentiveId, {
      [f('assigneduserkeys')]: assignment.userIds.join(','),
      [f('assignedrolekeys')]: assignment.roleIds.join(','),
    });

    const updated = await this.getIncentive(incentiveId);
    if (!updated) throw new Error(`Unknown incentive ${incentiveId}`);
    return updated;
  },

  /* ─── Admin ───────────────────────────────────────────────────────────── */

  async getWebRoles(): Promise<WebRole[]> {
    const rows = await readAll('role', `$orderby=${NAME_FIELD} asc`);
    return rows.map(toWebRole);
  },

  async saveWebRole(role: WebRole): Promise<WebRole> {
    const existing = await readAll('role', `$filter=${KEY_FIELD} eq '${role.roleId}'`);
    if (existing[0] && bool(existing[0][f('issystemmanaged')])) {
      throw new Error(`"${role.name}" is maintained by Power Pages and cannot be edited.`);
    }

    await upsertByKey('role', role.roleId, {
      [NAME_FIELD]: role.name,
      [f('description')]: role.description,
      [f('isadministrator')]: role.isAdministrator,
      [f('issystemmanaged')]: role.isSystemManaged,
      [f('capabilitykeys')]: role.capabilities.join(','),
    });
    return role;
  },

  /**
   * Refuses while anything still points at the role.
   *
   * The guards live in the service rather than only in the admin screen,
   * because they are properties of the data: the Web API is reachable whether
   * or not the button is disabled, and a role deleted out from under a user
   * leaves them holding an id that resolves to nothing.
   */
  async deleteWebRole(roleId: string): Promise<void> {
    const [roles, users, incentives] = await Promise.all([
      this.getWebRoles(),
      this.getPortalUsers(),
      this.getIncentives(),
    ]);

    const role = roles.find((candidate) => candidate.roleId === roleId);
    if (role?.isSystemManaged) {
      throw new Error(`"${role.name}" is maintained by Power Pages and cannot be deleted.`);
    }

    const holders = users.filter((user) => user.roleIds.includes(roleId));
    if (holders.length > 0) {
      throw new Error(
        `${holders.length} user(s) still hold "${role?.name ?? roleId}". Move them to another role first.`,
      );
    }

    const assigned = incentives.filter((incentive) => incentive.assignedRoleIds.includes(roleId));
    if (assigned.length > 0) {
      throw new Error(
        `${assigned.length} incentive(s) are assigned to "${role?.name ?? roleId}". Reassign them first.`,
      );
    }

    const id = await idForKey('role', roleId);
    if (id) await remove('role', id);
  },

  async getPortalUsers(): Promise<PortalUser[]> {
    const rows = await readAll('user', `$orderby=${NAME_FIELD} asc`);
    return rows.map(toPortalUser);
  },

  async setUserRoles(userId: string, roleIds: string[]): Promise<PortalUser> {
    await upsertByKey('user', userId, { [f('rolekeys')]: roleIds.join(',') });
    const users = await this.getPortalUsers();
    const user = users.find((candidate) => candidate.userId === userId);
    if (!user) throw new Error(`Unknown user ${userId}`);
    return user;
  },

  async setUserStatus(userId: string, status: PortalUser['status']): Promise<PortalUser> {
    await upsertByKey('user', userId, { [f('status')]: status });
    const users = await this.getPortalUsers();
    const user = users.find((candidate) => candidate.userId === userId);
    if (!user) throw new Error(`Unknown user ${userId}`);
    return user;
  },

  async getQuestionSections(): Promise<QuestionSection[]> {
    const rows = await readAll('questionsection', `$orderby=${f('sortorder')} asc`);
    return rows.map(toQuestionSection);
  },

  async saveQuestionSection(section: QuestionSection): Promise<QuestionSection> {
    await upsertByKey('questionsection', section.sectionId, {
      [NAME_FIELD]: section.title,
      [f('description')]: section.description,
      [f('area')]: section.area,
      [f('sortorder')]: section.order,
      [f('isenabled')]: section.enabled,
    });
    return section;
  },

  async deleteQuestionSection(sectionId: string): Promise<void> {
    // A question whose section is gone renders nowhere — a failure nobody
    // notices until a form comes back empty.
    const questions = await this.getQuestions();
    const held = questions.filter((question) => question.sectionId === sectionId);
    if (held.length > 0) {
      throw new Error(
        `Cannot delete this section while it still holds ${held.length} question(s). Move or delete them first.`,
      );
    }

    const id = await idForKey('questionsection', sectionId);
    if (id) await remove('questionsection', id);
  },

  async getQuestions(): Promise<QuestionDefinition[]> {
    const rows = await readAll('question', `$orderby=${f('sortorder')} asc`);
    return rows.map(toQuestion);
  },

  async saveQuestion(question: QuestionDefinition): Promise<QuestionDefinition> {
    await upsertByKey('question', question.questionId, {
      [NAME_FIELD]: question.label,
      [f('sectionkey')]: question.sectionId,
      [f('helptext')]: question.helpText,
      [f('inputtype')]: question.inputType,
      [f('isrequired')]: question.required,
      [f('sortorder')]: question.order,
      [f('isenabled')]: question.enabled,
      [f('optionsetkey')]: question.optionSetId ?? '',
      [f('nameprovisional')]: question.nameProvisional,
      [f('systemreferences')]: question.systemReferences.join(','),
    });
    return question;
  },

  async deleteQuestion(questionId: string): Promise<void> {
    const id = await idForKey('question', questionId);
    if (id) await remove('question', id);
  },

  async getOptionSets(): Promise<OptionSet[]> {
    const [setRows, optionRows] = await Promise.all([
      readAll('optionset', `$orderby=${NAME_FIELD} asc`),
      readAll('option', `$orderby=${f('sortorder')} asc`),
    ]);

    const optionsBySet = new Map<string, OptionSet['options']>();
    for (const row of optionRows) {
      const setKey = str(row[f('optionsetkey')]);
      const existing = optionsBySet.get(setKey) ?? [];
      existing.push({
        optionId: key(row),
        label: name(row),
        order: num(row[f('sortorder')]),
        enabled: bool(row[f('isenabled')]),
      });
      optionsBySet.set(setKey, existing);
    }

    return setRows.map((row) => ({
      optionSetId: key(row),
      name: name(row),
      description: str(row[f('description')]),
      usage: str(row[f('usage')]),
      codeDependent: bool(row[f('iscodedependent')]),
      options: optionsBySet.get(key(row)) ?? [],
    }));
  },

  /**
   * Saves the list and its options together.
   *
   * Options removed in the UI are DELETED here, not left behind. That is the
   * one place this service deletes rows without being asked to, and it is
   * correct: the admin screen presents a dropdown's options as one editable
   * list, so a save that silently kept a removed option would put it straight
   * back on the next read.
   */
  async saveOptionSet(optionSet: OptionSet): Promise<OptionSet> {
    await upsertByKey('optionset', optionSet.optionSetId, {
      [NAME_FIELD]: optionSet.name,
      [f('description')]: optionSet.description,
      [f('usage')]: optionSet.usage,
      [f('iscodedependent')]: optionSet.codeDependent,
    });

    const existing = await readChunked(
      'option',
      orFilterChunks(f('optionsetkey'), [optionSet.optionSetId]),
    );

    await Promise.all(
      optionSet.options.map((option) =>
        upsertByKey('option', option.optionId, {
          [NAME_FIELD]: option.label,
          [f('optionsetkey')]: optionSet.optionSetId,
          [f('sortorder')]: option.order,
          [f('isenabled')]: option.enabled,
        }),
      ),
    );

    const kept = new Set(optionSet.options.map((option) => option.optionId));
    const removed = existing.filter((row) => !kept.has(key(row)));
    await Promise.all(
      removed.map(async (row) => {
        const id = await idForKey('option', key(row));
        if (id) await remove('option', id);
      }),
    );

    return optionSet;
  },

  async deleteOptionSet(optionSetId: string): Promise<void> {
    const [sets, questions] = await Promise.all([this.getOptionSets(), this.getQuestions()]);
    const set = sets.find((candidate) => candidate.optionSetId === optionSetId);

    /*
      Two separate reasons a list cannot go, catching different cases. A
      question reference is visible in the admin screen; a CODE dependency is
      not — SLA tiers back a typed union and the contracts table, and nothing
      in the question list would have stopped that one being deleted.
    */
    if (set?.codeDependent) {
      throw new Error(
        `"${set.name}" is still matched by value in the front end — deleting it would break the screens that depend on those exact options. It can be removed once the app reads this list at runtime.`,
      );
    }

    const used = questions.filter((question) => question.optionSetId === optionSetId);
    if (used.length > 0) {
      throw new Error(
        `Cannot delete this dropdown while ${used.length} question(s) still use it. Point them at another list first.`,
      );
    }

    for (const option of set?.options ?? []) {
      const optionId = await idForKey('option', option.optionId);
      if (optionId) await remove('option', optionId);
    }

    const id = await idForKey('optionset', optionSetId);
    if (id) await remove('optionset', id);
  },
};
