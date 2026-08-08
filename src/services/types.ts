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
  /**
   * THE JOIN KEY TO EVERYTHING UPSTREAM.
   *
   * Accounts, contracts and opportunities are all mastered outside SAIP and
   * arrive through the `FY26 Alignments MAIN` dataflow. They are tied together
   * by this id, which appears as `Company Group ID` on the alignments table and
   * as `Country Sales Entity ID` on `Opportunities` — the same value under two
   * names, which is why the SQL views alias both to `company_group_id`.
   *
   * `accountId` stays SAIP's own surrogate so the front end has one stable key
   * to route on. This is the column any query against upstream data uses.
   */
  companyGroupId: string;
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

/**
 * Colour coding for opportunity stages: the open stages warm as they approach
 * the close, then won goes green and lost goes neutral grey rather than red.
 *
 * Lost is deliberately NOT critical-red. Red on this page means "something
 * needs your attention"; a lost deal is finished, and colouring it as an alert
 * would send people to look at the one row they can do nothing about.
 *
 * As everywhere else, the stage name is always rendered — colour reinforces it
 * and is never the only signal.
 */
export const OPPORTUNITY_STAGE_COLORS: Record<
  OpportunityStage,
  { background: string; border: string; text: string }
> = {
  Qualify: {
    background: 'var(--hpe-base-color-blue-50)',
    border: 'var(--hpe-base-color-blue-500)',
    text: 'var(--hpe-base-color-blue-900)',
  },
  Propose: {
    background: 'var(--hpe-base-color-purple-100)',
    border: 'var(--hpe-base-color-purple-700)',
    text: 'var(--hpe-base-color-purple-900)',
  },
  Negotiate: {
    background: 'var(--hpe-base-color-gold-100)',
    border: 'var(--hpe-base-color-gold-550)',
    text: 'var(--hpe-base-color-grey-1000)',
  },
  'Closed won': {
    background: 'var(--hpe-base-color-green-100)',
    border: 'var(--hpe-base-color-green-600)',
    text: 'var(--hpe-base-color-green-1000)',
  },
  'Closed lost': {
    background: 'var(--hpe-base-color-grey-200)',
    border: 'var(--hpe-base-color-grey-600)',
    text: 'var(--hpe-base-color-grey-1000)',
  },
};

/** Stages that are still live. Everything else is finished. */
export const OPEN_OPPORTUNITY_STAGES: OpportunityStage[] = [
  'Qualify',
  'Propose',
  'Negotiate',
];

/**
 * One product line on an opportunity.
 *
 * THE SOURCE IS LINE-ITEM GRAIN. The `Opportunities` dataflow is a Salesforce
 * export with one row per product per opportunity, so an opportunity worth
 * £400k across six products arrives as six rows carrying the same header
 * fields. Everything the app shows as an opportunity is therefore a roll-up,
 * and this is the row it rolls up FROM.
 *
 * Maps to `Product Name`, `Value (converted)` and the `FY26 Product Table.*`
 * hierarchy columns.
 */
export interface OpportunityLine {
  /** Synthetic — the source has no line key, so views mint one deterministically. */
  lineId: string;
  productName: string;
  /** `FY26 Product Table.Level 2` — the level people actually recognise. */
  productCategory: string;
  /** `Value (converted)`. Already converted, so no FX is applied here. */
  value: number;
  currency: string;
}

/**
 * An opportunity against an account, with its product lines.
 *
 * Distinct from `IncentiveOpportunity`, which is the flat row shown under a
 * campaign code on the Business Development page. This one is the account-side
 * view: grouped, with lines, and reached from Account Focus.
 *
 * FIELD MAPPING to the `Opportunities` table:
 *   opportunityNumber ← HPE Opportunity Id
 *   opportunityId     ← Opportunity ID           (the SFDC id)
 *   name              ← Opportunity Name
 *   description       ← Opportunity Description
 *   companyGroupId    ← Country Sales Entity ID  (= Company Group ID)
 *   stage             ← Opportunity Sales Stage
 *   forecastCategory  ← Forecast Category
 *   closeDate         ← Close Date               (the only real date column)
 *   totalValue        ← Total Value to HPE (converted)
 *   ownerName/Email   ← Opportunity Owner / Opportunity Owner Email
 *   campaignName      ← Primary Campaign Name
 *   salesMotion       ← Sales Motion
 */
export interface AccountOpportunity {
  opportunityId: string;
  /** `OPE-` + ten digits. What people quote to each other. */
  opportunityNumber: string;
  name: string;
  description: string;
  accountId: string;
  companyGroupId: string;
  stage: OpportunityStage;
  /** Commit / Best case / Pipeline — the rep's own confidence, not the stage. */
  forecastCategory: string;
  closeDate: IsoDate;
  ownerName: string;
  ownerEmail: string;
  /** Null when the opportunity was not raised under a campaign. */
  campaignName: string | null;
  salesMotion: string;
  /**
   * `Total Value to HPE (converted)` — the header figure, NOT the sum of
   * `lines`. The two differ in the source (the header includes elements that
   * never appear as product lines), and reconciling them is a data question for
   * the CRM rather than something to paper over here. The pane shows both and
   * says which is which.
   */
  totalValue: number;
  currency: string;
  lines: OpportunityLine[];
}

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
  /**
   * People this incentive is assigned TO — the ones expected to complete it.
   *
   * Distinct from `nominatedAccountIds`, and the difference matters: an account
   * is a target of the campaign, a person is responsible for acting on it. A
   * Sales Training incentive typically has no accounts at all and several
   * assignees.
   */
  assignedUserIds: string[];
  /**
   * Roles this incentive is assigned to. Everyone holding the role picks it up,
   * including people who join it later — which is the point of assigning by role
   * rather than listing names.
   */
  assignedRoleIds: string[];
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
  assignedUserIds: string[];
  assignedRoleIds: string[];
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

/**
 * What a role is allowed to reach.
 *
 * A closed catalogue rather than free text: every capability names a real
 * surface in the app, so a role's permissions can be read as a sentence and
 * nothing can be granted that does not exist. Adding a capability here is the
 * deliberate act of adding something to protect.
 *
 * In Power Pages each of these maps to a set of table permissions attached to
 * the web role — the UI check is a convenience, the table permission is the
 * actual gate.
 */
export type Capability =
  | 'home.view'
  | 'accounts.view'
  | 'accounts.edit'
  | 'meetings.log'
  | 'bizdev.view'
  | 'bizdev.manage'
  | 'executive.view'
  | 'team.view'
  | 'admin.access';

export const CAPABILITIES: {
  id: Capability;
  label: string;
  description: string;
}[] = [
  { id: 'home.view', label: 'Home', description: 'The landing page and their own portfolio scores.' },
  { id: 'accounts.view', label: 'View accounts', description: 'Open Account Focus for accounts aligned to them.' },
  { id: 'accounts.edit', label: 'Edit account monitoring', description: 'Maintain the relationship dates on an account.' },
  { id: 'meetings.log', label: 'Log meetings', description: 'Record a customer meeting against an account.' },
  { id: 'bizdev.view', label: 'View Business Development', description: 'See incentives and the opportunities raised against them.' },
  { id: 'bizdev.manage', label: 'Manage incentives', description: 'Create incentives, nominate accounts and assign them to people.' },
  { id: 'executive.view', label: 'Executive View', description: 'Read-only reporting across every account.' },
  { id: 'team.view', label: "View team's accounts", description: "See the accounts of everyone reporting to them, not just their own." },
  { id: 'admin.access', label: 'Admin portal', description: 'Change questions, dropdowns, users and roles.' },
];

/** A portal web role. Maps to `adx_webrole` in Power Pages. */
export interface WebRole {
  roleId: string;
  name: string;
  description: string;
  /**
   * Administrators can reach the admin portal. Kept as its own flag rather than
   * just the `admin.access` capability because it is the one permission the
   * Users table surfaces directly, as a tickbox.
   */
  isAdministrator: boolean;
  /** True for roles Power Pages creates and manages itself — not deletable. */
  isSystemManaged: boolean;
  /** What this role can reach. */
  capabilities: Capability[];
}

/** Someone who can sign in. Maps to a `contact` with web roles attached. */
export interface PortalUser {
  userId: string;
  displayName: string;
  email: string;
  /**
   * Every role held, including the system one and the administrator role.
   *
   * The Users table presents this as an admin tickbox plus a single job-role
   * dropdown, because that is how people think about it — but the underlying
   * shape stays a set, which is what Dataverse actually stores and what lets a
   * role be granted outside those two controls later.
   */
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
  /**
   * Things in the front end that depend on this question BY ID — a notification
   * rule, a deep-link target, a derived figure. Empty when nothing does.
   *
   * This is what makes the admin integrity checks data-driven rather than a
   * hardcoded list of ids in the UI. A question with entries here cannot be
   * deleted, disabled, or have its input type changed, because something would
   * silently stop working; its LABEL stays free to edit.
   */
  systemReferences: string[];
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
  /** Roles held, used to resolve incentives assigned to a role rather than a person. */
  roleIds: string[];
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
  /**
   * Opportunities for one account, newest close date first.
   *
   * Returns them ALREADY GROUPED. The source is line-item grain, and grouping
   * thousands of lines in the browser would mean fetching thousands of lines —
   * which the Power Pages Web API pages at 5,000 and cannot aggregate. The
   * grouping belongs in `saip.vw_account_opportunity`, so the shape returned
   * here is the shape the view produces.
   */
  getAccountOpportunities(accountId: string): Promise<AccountOpportunity[]>;
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
  /** Replaces both assignment lists, so removals are as explicit as additions. */
  setIncentiveAssignment(
    incentiveId: string,
    assignment: { userIds: string[]; roleIds: string[] },
  ): Promise<Incentive>;

  /* ─── Admin ─────────────────────────────────────────────────────────────
     Configuration reads and writes. In production every one of these is gated
     by an administrator web role — the portal must never rely on the UI hiding
     the page, because the Web API is reachable regardless. */

  getWebRoles(): Promise<WebRole[]>;
  /** Creates when `roleId` is unknown, updates when it is not. */
  saveWebRole(role: WebRole): Promise<WebRole>;
  /** Rejects for a system-managed role, or one still held by anyone. */
  deleteWebRole(roleId: string): Promise<void>;
  getPortalUsers(): Promise<PortalUser[]>;
  /** Replaces a user's whole role set, so removals are as explicit as additions. */
  setUserRoles(userId: string, roleIds: string[]): Promise<PortalUser>;
  setUserStatus(userId: string, status: PortalUser['status']): Promise<PortalUser>;

  getQuestionSections(): Promise<QuestionSection[]>;
  /** Creates when `sectionId` is unknown, updates when it is not. */
  saveQuestionSection(section: QuestionSection): Promise<QuestionSection>;
  /**
   * Rejects while the section still holds questions. Deleting it silently would
   * orphan every one of them, and a question with no section renders nowhere —
   * a failure nobody would notice until a form came back empty.
   */
  deleteQuestionSection(sectionId: string): Promise<void>;

  getQuestions(): Promise<QuestionDefinition[]>;
  /** Creates when `questionId` is unknown, updates when it is not. */
  saveQuestion(question: QuestionDefinition): Promise<QuestionDefinition>;
  deleteQuestion(questionId: string): Promise<void>;

  getOptionSets(): Promise<OptionSet[]>;
  /** Creates when `optionSetId` is unknown, updates when it is not. */
  saveOptionSet(optionSet: OptionSet): Promise<OptionSet>;
  /** Rejects while any question still points at it, for the same reason. */
  deleteOptionSet(optionSetId: string): Promise<void>;
}
