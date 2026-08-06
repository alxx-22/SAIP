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
  /**
   * Whether this account is contracted once at customer level or per location.
   * Drives how the SLA spend breakdown is labelled and counted.
   */
  slaCoverageModel: SlaCoverageModel;
  /** SLA spend split by tier, largest first. */
  slaBreakdown: SlaSpendSlice[];
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

/**
 * Service level tiers. Every contract carries exactly one.
 */
export type SlaTier =
  | 'Complete Care'
  | 'Tech Care Basic'
  | 'Tech Care Essential'
  | 'Tech Care Critical';

export const SLA_TIERS: SlaTier[] = [
  'Complete Care',
  'Tech Care Basic',
  'Tech Care Essential',
  'Tech Care Critical',
];

/**
 * Colour coding for SLA tiers.
 *
 * Ordered by service level so the palette itself carries the hierarchy:
 * Complete Care (the fullest wrap) is the brand green, then Tech Care rises
 * blue → orange → red as criticality increases. All drawn from HPE's base
 * ramps; the tier name is always shown alongside, so colour is never the only
 * signal.
 */
export const SLA_TIER_COLORS: Record<
  SlaTier,
  { background: string; border: string; text: string }
> = {
  'Complete Care': {
    background: 'var(--hpe-base-color-green-100)',
    border: 'var(--hpe-base-color-green-600)',
    text: 'var(--hpe-base-color-green-1000)',
  },
  'Tech Care Basic': {
    background: 'var(--hpe-base-color-blue-50)',
    border: 'var(--hpe-base-color-blue-500)',
    text: 'var(--hpe-base-color-blue-900)',
  },
  'Tech Care Essential': {
    background: 'var(--hpe-base-color-orange-50)',
    border: 'var(--hpe-base-color-orange-600)',
    text: 'var(--hpe-base-color-orange-1000)',
  },
  'Tech Care Critical': {
    background: 'var(--hpe-base-color-red-50)',
    border: 'var(--hpe-base-color-red-600)',
    text: 'var(--hpe-base-color-red-1000)',
  },
};

/**
 * How an account's SLA coverage is structured.
 *
 * ASSUMPTION — confirm with the account team. Read from the brief as: some
 * customers hold one contract covering every location ("customer level"),
 * others hold a separate contract per site ("per location"). The Value Overview
 * breaks SLA spend down accordingly, so the rep sees the split the way their
 * customer actually buys it.
 */
export type SlaCoverageModel = 'customer' | 'location';

/** Ribbon B — one active service contract. */
export interface ServiceContract {
  /**
   * Contract number: 10 digits beginning 400, e.g. "4001234567".
   * This is the identifier the table shows — contracts are referred to by
   * number, not by SLA, because every contract has an SLA.
   */
  contractId: string;
  /** Service level tier. Every contract has one. */
  sla: SlaTier;
  value: number;
  currency: string;
  /** Cities covered by this contract. */
  cities: string[];
  renewalDate: IsoDate;
}

/** One row of the SLA spend breakdown. */
export interface SlaSpendSlice {
  sla: SlaTier;
  /** Spend attributed to this tier. */
  value: number;
  /** Share of total contracted spend, 0–100. */
  percent: number;
  /** Contract count (coverage model "customer") or site count ("location"). */
  count: number;
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

/**
 * Colour coding for meeting tags.
 *
 * Each tag maps to a semantic HPE colour family rather than an arbitrary hue,
 * so the palette stays inside the design system. Grouped by what the tag means
 * commercially: green for revenue motions, blue for governance/review,
 * purple for relationship building.
 *
 * Colour is never the only signal — the tag's own label is always shown.
 */
export const MEETING_TAG_COLORS: Record<
  MeetingTag,
  { background: string; border: string; text: string }
> = {
  Workshop: {
    background: 'var(--hpe-base-color-purple-100)',
    border: 'var(--hpe-base-color-purple-700)',
    text: 'var(--hpe-base-color-purple-900)',
  },
  Upsell: {
    background: 'var(--hpe-base-color-green-100)',
    border: 'var(--hpe-base-color-green-600)',
    text: 'var(--hpe-base-color-green-1000)',
  },
  'SLA Review': {
    background: 'var(--hpe-base-color-blue-50)',
    border: 'var(--hpe-base-color-blue-500)',
    text: 'var(--hpe-base-color-blue-900)',
  },
  'Spend Review': {
    background: 'var(--hpe-base-color-orange-50)',
    border: 'var(--hpe-base-color-orange-600)',
    text: 'var(--hpe-base-color-orange-1000)',
  },
  'Leadership Introduction': {
    background: 'var(--hpe-base-color-red-50)',
    border: 'var(--hpe-base-color-red-600)',
    text: 'var(--hpe-base-color-red-1000)',
  },
};

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

/** Severity of a notification. Drives colour and ordering. */
export type NotificationSeverity = 'critical' | 'warning' | 'info';

/**
 * An actionable item surfaced in the top-ribbon notification pane.
 *
 * Notifications are DERIVED from account data rather than stored — an overdue
 * workshop is a fact about the monitoring record, not a separate row someone
 * has to remember to create and dismiss. That means they self-clear the moment
 * the underlying date is updated.
 */
export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  accountId: string;
  accountName: string;
  /**
   * Where clicking takes the user: the ribbon to open and the field to focus
   * on Account Focus. `fieldId` matches the DOM id of the form control.
   */
  target: { ribbon: 'monitoring'; fieldId: string };
}

/* ─── Business Development: incentives ──────────────────────────────────── */

/**
 * What an incentive is for. Drives grouping and the colour chip in the list.
 *
 * PLACEHOLDER — this list came from the Business Development brief and has not
 * been confirmed with the account team. Adding a value means adding a colour in
 * `INCENTIVE_TYPE_COLORS`; the UI has no default branch, deliberately, so an
 * unhandled type is a type error rather than an invisible styling bug.
 */
export type IncentiveType = 'Sales Training' | 'Upsell' | 'Workshop' | 'Sales Play';

export const INCENTIVE_TYPES: IncentiveType[] = [
  'Sales Training',
  'Upsell',
  'Workshop',
  'Sales Play',
];

/**
 * Colour coding for incentive types, grouped by what the type means
 * commercially: green for revenue motions, blue for enablement, purple for
 * relationship building. Drawn from HPE base ramps; the type name is always
 * shown alongside, so colour is never the only signal.
 */
export const INCENTIVE_TYPE_COLORS: Record<
  IncentiveType,
  { background: string; border: string; text: string }
> = {
  'Sales Training': {
    background: 'var(--hpe-base-color-blue-50)',
    border: 'var(--hpe-base-color-blue-500)',
    text: 'var(--hpe-base-color-blue-900)',
  },
  Upsell: {
    background: 'var(--hpe-base-color-green-100)',
    border: 'var(--hpe-base-color-green-600)',
    text: 'var(--hpe-base-color-green-1000)',
  },
  Workshop: {
    background: 'var(--hpe-base-color-purple-100)',
    border: 'var(--hpe-base-color-purple-700)',
    text: 'var(--hpe-base-color-purple-900)',
  },
  'Sales Play': {
    background: 'var(--hpe-base-color-orange-50)',
    border: 'var(--hpe-base-color-orange-600)',
    text: 'var(--hpe-base-color-orange-1000)',
  },
};

/**
 * Whether an incentive is still running.
 *
 * DERIVED, never stored — it is a question about `endDate` versus today, and
 * storing it would mean something has to remember to flip it. See
 * `incentiveStatus` in `derive.ts`.
 */
export type IncentiveStatus = 'active' | 'historical';

/**
 * A supporting document attached to an incentive.
 *
 * PLACEHOLDER — nothing is actually uploaded or downloaded in the prototype.
 * In production these are Dataverse notes/annotations or SharePoint documents;
 * `url` is null here precisely so the UI cannot pretend a file exists.
 */
export interface IncentiveResource {
  resourceId: string;
  /** File name as the uploader saved it, extension included. */
  name: string;
  /** Only PDFs today, but stored so the list can show the right icon later. */
  kind: 'pdf';
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  /** Null while there is no document store behind this. */
  url: string | null;
}

/**
 * An opportunity raised against an incentive's campaign code.
 *
 * `opportunityId` follows the OPE-0000000000 shape used in the CRM — ten
 * digits after the prefix. The numbers here are invented.
 */
export interface IncentiveOpportunity {
  opportunityId: string;
  accountId: string;
  accountName: string;
  /** What the opportunity is for, one line. */
  description: string;
  value: number;
  currency: string;
  stage: OpportunityStage;
  /** Expected close. Past dates on an open stage are the point of the list. */
  closeDate: IsoDate;
}

export type OpportunityStage =
  | 'Qualify'
  | 'Propose'
  | 'Negotiate'
  | 'Closed won'
  | 'Closed lost';

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'Qualify',
  'Propose',
  'Negotiate',
  'Closed won',
  'Closed lost',
];

/** A Business Development incentive. */
export interface Incentive {
  incentiveId: string;
  title: string;
  /** Free text — what the incentive is and who it is aimed at. */
  overview: string;
  /**
   * Optional. Without one there is nothing to raise opportunities against, so
   * the opportunities section explains that rather than showing an empty table.
   */
  campaignCode: string | null;
  type: IncentiveType;
  startDate: IsoDate;
  /** Null means open-ended, which counts as active. */
  endDate: IsoDate | null;
  resources: IncentiveResource[];
  /** Accounts nominated for this incentive. */
  nominatedAccountIds: string[];
  opportunities: IncentiveOpportunity[];
  createdAt: string;
  createdBy: string;
}

/** Payload written when a rep creates an incentive. */
export interface IncentiveDraft {
  title: string;
  overview: string;
  campaignCode: string | null;
  type: IncentiveType;
  startDate: IsoDate;
  endDate: IsoDate | null;
  nominatedAccountIds: string[];
}

/* ─── Admin: configuration held as data ─────────────────────────────────── */

/**
 * THE POINT OF EVERYTHING IN THIS SECTION
 *
 * These types describe configuration that is currently hard-coded in the app —
 * the Account Monitoring questions, the meeting place and tag lists, the
 * incentive purposes. Every one of them is a literal in TypeScript today, which
 * means adding a meeting tag or renaming a question is a code change, a build
 * and a deploy.
 *
 * Modelling them as records instead lets the admin portal change them at
 * runtime, and it is what makes the eventual SQL/Dataverse tables a
 * straightforward mapping rather than a rewrite.
 *
 * IMPORTANT, AND CURRENTLY TRUE: the app does NOT yet read its questions or
 * dropdowns from here. The ribbons and modals still use their constants. This
 * section is the management surface and the shape of the future tables; wiring
 * the consumers to it is the next step, alongside the SQL build plan.
 */

/** A portal web role. Maps to `adx_webrole` in Power Pages. */
export interface WebRole {
  roleId: string;
  name: string;
  description: string;
  /** Administrators can reach the admin portal. Exactly one role should have it. */
  isAdministrator: boolean;
  /** True for roles Power Pages creates and manages itself — not deletable. */
  isSystemManaged: boolean;
}

/** Someone who can sign in. Maps to a `contact` with web roles attached. */
export interface PortalUser {
  userId: string;
  displayName: string;
  email: string;
  roleIds: string[];
  status: 'active' | 'disabled';
  /** Null if they have never signed in. */
  lastSignIn: string | null;
}

/**
 * How a question is answered. Determines the control the form renders and, in
 * SQL terms, the column type behind it.
 */
export type QuestionInputType =
  | 'date'
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'choice'
  | 'multichoice';

export const QUESTION_INPUT_TYPES: QuestionInputType[] = [
  'date',
  'text',
  'longtext',
  'number',
  'boolean',
  'choice',
  'multichoice',
];

/** Human labels for the input types, so the admin UI isn't showing enum values. */
export const QUESTION_INPUT_LABELS: Record<QuestionInputType, string> = {
  date: 'Date',
  text: 'Short text',
  longtext: 'Long text',
  number: 'Number',
  boolean: 'Yes / no',
  choice: 'Dropdown — one',
  multichoice: 'Dropdown — many',
};

/** A group of questions rendered together, e.g. one Account Monitoring ribbon. */
export interface QuestionSection {
  sectionId: string;
  title: string;
  description: string;
  /** Where this section appears. Kept coarse on purpose. */
  area: 'account-monitoring' | 'meeting-log';
  order: number;
  enabled: boolean;
}

/** One question inside a section. */
export interface QuestionDefinition {
  questionId: string;
  sectionId: string;
  label: string;
  /** Supporting line under the label. Empty string for none. */
  helpText: string;
  inputType: QuestionInputType;
  required: boolean;
  order: number;
  /** Disabled questions stay in the table but stop being rendered. */
  enabled: boolean;
  /**
   * Which dropdown supplies the options. Required for choice/multichoice and
   * null for everything else — the admin UI enforces that pairing.
   */
  optionSetId: string | null;
  /**
   * Marks a question whose wording the business has not signed off. Renders a
   * visible "name TBC" marker wherever the question appears.
   */
  nameProvisional: boolean;
}

/** One selectable value in a dropdown. */
export interface OptionSetOption {
  optionId: string;
  label: string;
  order: number;
  enabled: boolean;
}

/**
 * A reusable list of choices. Maps to a Dataverse choice column or, in SQL, a
 * lookup table.
 */
export interface OptionSet {
  optionSetId: string;
  name: string;
  description: string;
  /** Where this list is used today. Free text — for the admin's benefit only. */
  usage: string;
  /** True for lists the code still depends on by value, so labels can't be renamed freely. */
  codeDependent: boolean;
  options: OptionSetOption[];
}

/** Options for {@link AccountService.getNotifications}. */
export interface NotificationQuery {
  /**
   * Months of inactivity before a monitoring field counts as overdue.
   * Defaults to `MONITORING_OVERDUE_MONTHS` when omitted.
   */
  overdueAfterMonths?: number;
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
  /**
   * Derived across every aligned account, most severe first.
   *
   * `overdueAfterMonths` lets the caller tighten or relax the cadence used to
   * decide what counts as overdue, so a user can tune their own alerting in
   * Profile & settings. Omit it to use the agreed business rule
   * (`MONITORING_OVERDUE_MONTHS`), which is what the Account Monitoring ribbon
   * always does.
   */
  getNotifications(options?: NotificationQuery): Promise<AppNotification[]>;

  /** Every incentive, newest first. Active/historical is derived, not filtered here. */
  getIncentives(): Promise<Incentive[]>;
  getIncentive(incentiveId: string): Promise<Incentive | undefined>;
  /** Third write path, alongside `saveAccountMonitoring` and `logMeeting`. */
  createIncentive(draft: IncentiveDraft): Promise<Incentive>;

  /* ─── Admin ─────────────────────────────────────────────────────────────
     Configuration reads and writes. In production every one of these is gated
     by an administrator web role — the portal must never rely on the UI hiding
     the page, because the Web API is reachable regardless. */

  getWebRoles(): Promise<WebRole[]>;
  getPortalUsers(): Promise<PortalUser[]>;
  /** Replaces a user's whole role set, so removals are as explicit as additions. */
  setUserRoles(userId: string, roleIds: string[]): Promise<PortalUser>;
  setUserStatus(userId: string, status: PortalUser['status']): Promise<PortalUser>;

  getQuestionSections(): Promise<QuestionSection[]>;
  getQuestions(): Promise<QuestionDefinition[]>;
  /** Creates when `questionId` is unknown, updates when it is not. */
  saveQuestion(question: QuestionDefinition): Promise<QuestionDefinition>;
  deleteQuestion(questionId: string): Promise<void>;

  getOptionSets(): Promise<OptionSet[]>;
  saveOptionSet(optionSet: OptionSet): Promise<OptionSet>;
}
