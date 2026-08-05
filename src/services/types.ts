/**
 * Domain types for SAIP.
 *
 * These describe the shape the UI consumes. In production they are populated
 * from Dataverse tables fed by a Fabric pipeline; today they are populated by
 * `mockAccountService`. The UI imports ONLY from this file and `index.ts`, so
 * swapping the implementation is a config change, not a rewrite.
 *
 * Dates crossing the service boundary are ISO-8601 `YYYY-MM-DD` strings rather
 * than `Date` objects, because that is what Dataverse's Web API returns and it
 * keeps the boundary serialisable.
 */

export type IsoDate = string;

/** How a score is trending against its target. Drives colour + ambient motion. */
export type ScoreStatus = 'strong' | 'watch' | 'attention';

/** One account aligned to the signed-in salesperson. */
export interface Account {
  accountId: string;
  accountName: string;
  /** Customer's primary industry — used as supporting text in the list. */
  industry: string;
  /** Sales region / geo the alignment sits in. */
  region: string;
  /** Total annual services revenue, in the account's reporting currency. */
  annualServicesRevenue: number;
  currency: string;
  /** Count of currently active service contracts. Shown as a list affordance. */
  activeContractCount: number;
  /** Last logged customer meeting, if any. */
  lastMeetingDate: IsoDate | null;
}

/** A single score with the context needed to render and explain it. */
export interface Score {
  key: ScoreKey;
  label: string;
  /** 0–100. */
  value: number;
  status: ScoreStatus;
  /** One-line explainer revealed on hover. */
  explainer: string;
  /** Change vs. the previous reporting period, in points. */
  deltaPoints: number;
}

export type ScoreKey = 'proximity' | 'centricity' | 'spend';

/** Ribbon A — Value Overview. */
export interface ValueOverview {
  /** SLA spend as a percentage (0–100) of total spend across active contracts. */
  slaSpendPercent: number;
  /** Total spend the SLA percentage is calculated against. */
  totalContractedSpend: number;
  /** Last purchase date under the "Expand" motion. Null if never upsold. */
  lastUpsellDate: IsoDate | null;
  /** What that upsell was, for tooltip context. */
  lastUpsellDescription: string | null;
  /** Trailing 48-month hardware spend. */
  previous48MonthHardwareSpend: number;
  /** Modelled next-12-month hardware spend. */
  predictedNext12MonthHardwareSpend: number;
  /** Model confidence 0–100, so the UI never presents a prediction as fact. */
  predictionConfidence: number;
  currency: string;
}

/** Ribbon B — one active service contract. */
export interface ServiceContract {
  contractId: string;
  /** Service level tier / name, e.g. "Proactive Care 24x7". */
  sla: string;
  value: number;
  currency: string;
  /** Cities covered by this contract. */
  cities: string[];
  renewalDate: IsoDate;
}

/**
 * Ribbon C — Account Monitoring.
 *
 * Salesperson-maintained relationship health. Every field is a date the rep
 * keeps current; derived flags (overdue, held-in-last-12-months) are computed
 * in `derive.ts` rather than stored, so the rules live in one place.
 */
export interface AccountMonitoring {
  accountId: string;
  customerProximity: {
    /** Last meeting with key stakeholders. */
    lastStakeholderMeeting: IsoDate | null;
    /** Last workshop held with the customer. */
    lastWorkshop: IsoDate | null;
    /** Last spend review / SLA review held with the customer. */
    lastSpendOrSlaReview: IsoDate | null;
  };
  customerCentricity: {
    /** Last visit to the customer's site. */
    lastCustomerVisit: IsoDate | null;
    /** Last performance review conducted with the customer. */
    lastPerformanceReview: IsoDate | null;
    /**
     * PLACEHOLDER FIELD — name not final.
     * The brief asked to leave room for 1–2 more fields "in the same spirit"
     * and explicitly not to invent definitive names. This one is rendered with
     * a visible "Field name TBC" marker so the account team can confirm or
     * rename it before release. See README placeholder checklist.
     */
    lastExecutiveEngagement: IsoDate | null;
    /**
     * PLACEHOLDER FIELD — name not final. Same caveat as above.
     */
    lastServiceReviewWithSponsor: IsoDate | null;
  };
  /** Audit trail for the "last updated" line under the form. */
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

/** Where a meeting took place. */
export type MeetingPlace =
  | 'Phone Call'
  | 'Teams'
  | 'Customer Site'
  | 'CIC'
  | 'Channel Partner Site';

export const MEETING_PLACES: MeetingPlace[] = [
  'Phone Call',
  'Teams',
  'Customer Site',
  'CIC',
  'Channel Partner Site',
];

/** Meeting classification tags. */
export type MeetingTag =
  | 'Workshop'
  | 'Upsell'
  | 'SLA Review'
  | 'Spend Review'
  | 'Leadership Introduction';

export const MEETING_TAGS: MeetingTag[] = [
  'Workshop',
  'Upsell',
  'SLA Review',
  'Spend Review',
  'Leadership Introduction',
];

/** Payload written when a rep logs a meeting. */
export interface MeetingLogDraft {
  accountId: string;
  meetingDate: IsoDate;
  place: MeetingPlace;
  subject: string;
  comments: string;
  tags: MeetingTag[];
}

/** A persisted meeting log. */
export interface MeetingLog extends MeetingLogDraft {
  meetingId: string;
  loggedAt: string;
  loggedBy: string;
}

/** The signed-in salesperson. Power Pages/Entra ID supplies this in production. */
export interface CurrentUser {
  userId: string;
  displayName: string;
  email: string;
}

/**
 * The contract every SAIP screen codes against.
 *
 * Replace the mock implementation with a Dataverse-backed one and the UI is
 * untouched. Reads map to Dataverse table queries; `saveAccountMonitoring` and
 * `logMeeting` are the two write paths.
 */
export interface AccountService {
  getCurrentUser(): Promise<CurrentUser>;
  /** Accounts aligned to the signed-in salesperson. */
  getAccounts(): Promise<Account[]>;
  getAccount(accountId: string): Promise<Account | undefined>;
  /** Portfolio-level scores for the homepage Overview. */
  getPortfolioScores(): Promise<Score[]>;
  /** Scores for one account. */
  getAccountScores(accountId: string): Promise<Score[]>;
  getValueOverview(accountId: string): Promise<ValueOverview>;
  getServiceContracts(accountId: string): Promise<ServiceContract[]>;
  getAccountMonitoring(accountId: string): Promise<AccountMonitoring>;
  saveAccountMonitoring(monitoring: AccountMonitoring): Promise<AccountMonitoring>;
  logMeeting(draft: MeetingLogDraft): Promise<MeetingLog>;
  getMeetings(accountId: string): Promise<MeetingLog[]>;
}
