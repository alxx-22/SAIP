/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLACEHOLDER DATA — replace with live Dataverse/Fabric source before release
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every account name, figure, score, contract, city and date in this file is
 * invented. Nothing here is a real HPE customer or a real commercial figure.
 * The company names are deliberately generic-fictional so they cannot be
 * mistaken for real accounts. Contract numbers follow the real 400-prefixed
 * 10-digit shape but the numbers themselves are made up.
 *
 * Dates are generated RELATIVE TO TODAY rather than hardcoded, so the demo
 * keeps demonstrating its own edge cases as time passes — contracts stay
 * "renewing within 90 days", workshops stay "overdue past 12 months". A frozen
 * date table would stop exercising those code paths within a few months.
 *
 * See README → "Placeholder data checklist" for the full punch list.
 */

import type {
  Account,
  AccountMonitoring,
  MeetingLog,
  Score,
  ServiceContract,
  SlaCoverageModel,
  ValueOverview,
} from '../types';

/** ISO date `n` days from today. Negative = past. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO date `n` months from today. Negative = past. */
function monthsFromNow(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// PLACEHOLDER DATA — fictional accounts, not real HPE customers.
export const MOCK_ACCOUNTS: Account[] = [
  {
    accountId: 'acc-001',
    accountName: 'Northwind Logistics Group',
    companyGroupId: 'CG-007113',
    industry: 'Transport & Logistics',
    region: 'UK & Ireland',
    annualServicesRevenue: 4_820_000,
    currency: 'GBP',
    activeContractCount: 4,
    lastMeetingDate: daysFromNow(-12),
  },
  {
    accountId: 'acc-002',
    accountName: 'Meridian Health Trust',
    companyGroupId: 'CG-007126',
    industry: 'Healthcare',
    region: 'UK & Ireland',
    annualServicesRevenue: 7_140_000,
    currency: 'GBP',
    activeContractCount: 4,
    lastMeetingDate: daysFromNow(-3),
  },
  {
    accountId: 'acc-003',
    accountName: 'Caledonia Energy plc',
    companyGroupId: 'CG-007139',
    industry: 'Energy & Utilities',
    region: 'UK & Ireland',
    annualServicesRevenue: 11_960_000,
    currency: 'GBP',
    activeContractCount: 3,
    lastMeetingDate: daysFromNow(-41),
  },
  {
    accountId: 'acc-004',
    accountName: 'Aldergate Financial Services',
    companyGroupId: 'CG-007152',
    industry: 'Financial Services',
    region: 'UK & Ireland',
    annualServicesRevenue: 9_305_000,
    currency: 'GBP',
    activeContractCount: 2,
    lastMeetingDate: daysFromNow(-67),
  },
  {
    accountId: 'acc-005',
    accountName: 'Vantage Retail Holdings',
    companyGroupId: 'CG-007165',
    industry: 'Retail',
    region: 'UK & Ireland',
    annualServicesRevenue: 2_450_000,
    currency: 'GBP',
    activeContractCount: 2,
    lastMeetingDate: null,
  },
  {
    accountId: 'acc-006',
    accountName: 'Orbital Manufacturing Ltd',
    companyGroupId: 'CG-007178',
    industry: 'Manufacturing',
    region: 'UK & Ireland',
    annualServicesRevenue: 6_015_000,
    currency: 'GBP',
    activeContractCount: 2,
    lastMeetingDate: daysFromNow(-23),
  },
  {
    accountId: 'acc-007',
    accountName: 'Kingsway Public Sector Partnership',
    companyGroupId: 'CG-007191',
    industry: 'Public Sector',
    region: 'UK & Ireland',
    annualServicesRevenue: 13_720_000,
    currency: 'GBP',
    activeContractCount: 2,
    lastMeetingDate: daysFromNow(-8),
  },
  {
    accountId: 'acc-008',
    accountName: 'Halcyon Media Networks',
    companyGroupId: 'CG-007204',
    industry: 'Media & Entertainment',
    region: 'UK & Ireland',
    annualServicesRevenue: 3_180_000,
    currency: 'GBP',
    activeContractCount: 2,
    lastMeetingDate: daysFromNow(-95),
  },
];

/**
 * PLACEHOLDER DATA — invented scores.
 * Portfolio-level roll-up shown on the homepage Overview.
 * One score is deliberately in `attention` so the ambient pulse and the
 * "needs attention" colour treatment are visible in the prototype.
 */
export const MOCK_PORTFOLIO_SCORES: Score[] = [
  {
    key: 'proximity',
    label: 'Customer Proximity',
    value: 72,
    status: 'watch',
    explainer:
      'How consistently we are in front of key stakeholders — meetings, workshops and reviews.',
    deltaPoints: 4,
  },
  {
    key: 'centricity',
    label: 'Customer Centricity',
    value: 84,
    status: 'strong',
    explainer:
      'How well our engagement model tracks the customer’s own priorities and performance reviews.',
    deltaPoints: 2,
  },
  {
    key: 'spend',
    label: 'Customer Service(s) Spend',
    value: 46,
    status: 'attention',
    explainer:
      'Services spend against attached hardware estate, benchmarked to segment peers.',
    deltaPoints: -7,
  },
];

/** PLACEHOLDER DATA — per-account score overrides, keyed by accountId. */
export const MOCK_ACCOUNT_SCORES: Record<string, Score[]> = {
  'acc-001': [
    { ...MOCK_PORTFOLIO_SCORES[0], value: 68, status: 'watch', deltaPoints: -3 },
    { ...MOCK_PORTFOLIO_SCORES[1], value: 79, status: 'strong', deltaPoints: 5 },
    { ...MOCK_PORTFOLIO_SCORES[2], value: 51, status: 'attention', deltaPoints: -4 },
  ],
  'acc-002': [
    { ...MOCK_PORTFOLIO_SCORES[0], value: 88, status: 'strong', deltaPoints: 6 },
    { ...MOCK_PORTFOLIO_SCORES[1], value: 91, status: 'strong', deltaPoints: 3 },
    { ...MOCK_PORTFOLIO_SCORES[2], value: 77, status: 'watch', deltaPoints: 1 },
  ],
  'acc-003': [
    { ...MOCK_PORTFOLIO_SCORES[0], value: 54, status: 'attention', deltaPoints: -9 },
    { ...MOCK_PORTFOLIO_SCORES[1], value: 62, status: 'watch', deltaPoints: -2 },
    { ...MOCK_PORTFOLIO_SCORES[2], value: 83, status: 'strong', deltaPoints: 8 },
  ],
};

/** PLACEHOLDER DATA — fallback scores for accounts without an override above. */
export const MOCK_DEFAULT_ACCOUNT_SCORES: Score[] = [
  { ...MOCK_PORTFOLIO_SCORES[0], value: 70, status: 'watch', deltaPoints: 1 },
  { ...MOCK_PORTFOLIO_SCORES[1], value: 75, status: 'strong', deltaPoints: 2 },
  { ...MOCK_PORTFOLIO_SCORES[2], value: 58, status: 'watch', deltaPoints: -1 },
];

/**
 * PLACEHOLDER DATA — invented contracts.
 *
 * Every contract carries exactly one SLA tier and is identified by a 10-digit
 * number beginning 400. Renewal dates straddle the 90-day threshold on purpose
 * so the "renewing soon" flag is demonstrable without editing anything.
 *
 * Coverage model differs by account on purpose so both variants of the SLA
 * spend breakdown can be seen: `location` accounts hold one contract per site,
 * `customer` accounts hold contracts spanning several sites.
 */
export const MOCK_CONTRACTS: Record<string, ServiceContract[]> = {
  // Contracted per location — one contract per site.
  'acc-001': [
    {
      contractId: '4001842307',
      sla: 'Tech Care Critical',
      value: 1_940_000,
      currency: 'GBP',
      cities: ['Leeds'],
      renewalDate: daysFromNow(38),
    },
    {
      contractId: '4001842315',
      sla: 'Tech Care Basic',
      value: 620_000,
      currency: 'GBP',
      cities: ['Birmingham'],
      renewalDate: daysFromNow(214),
    },
    {
      contractId: '4001842322',
      sla: 'Complete Care',
      value: 1_760_000,
      currency: 'GBP',
      cities: ['Glasgow'],
      renewalDate: daysFromNow(72),
    },
    {
      contractId: '4001842338',
      sla: 'Tech Care Essential',
      value: 500_000,
      currency: 'GBP',
      cities: ['Cardiff'],
      renewalDate: daysFromNow(401),
    },
  ],
  // Contracted at customer level — contracts span multiple sites.
  'acc-002': [
    {
      contractId: '4002557104',
      sla: 'Complete Care',
      value: 3_100_000,
      currency: 'GBP',
      cities: ['London', 'Reading', 'Oxford'],
      renewalDate: daysFromNow(156),
    },
    {
      contractId: '4002557112',
      sla: 'Tech Care Critical',
      value: 2_240_000,
      currency: 'GBP',
      cities: ['Sheffield', 'Nottingham'],
      renewalDate: daysFromNow(19),
    },
    {
      contractId: '4002557129',
      sla: 'Tech Care Basic',
      value: 890_000,
      currency: 'GBP',
      cities: ['Newcastle', 'Durham'],
      renewalDate: daysFromNow(287),
    },
    {
      contractId: '4002557135',
      sla: 'Tech Care Essential',
      value: 910_000,
      currency: 'GBP',
      cities: ['London'],
      renewalDate: daysFromNow(63),
    },
  ],
  // Contracted per location.
  'acc-003': [
    {
      contractId: '4003914860',
      sla: 'Complete Care',
      value: 5_420_000,
      currency: 'GBP',
      cities: ['Aberdeen'],
      renewalDate: daysFromNow(88),
    },
    {
      contractId: '4003914877',
      sla: 'Tech Care Critical',
      value: 3_180_000,
      currency: 'GBP',
      cities: ['Glasgow'],
      renewalDate: daysFromNow(342),
    },
    {
      contractId: '4003914883',
      sla: 'Tech Care Essential',
      value: 2_060_000,
      currency: 'GBP',
      cities: ['Edinburgh'],
      renewalDate: daysFromNow(11),
    },
  ],
};

/** PLACEHOLDER DATA — fallback contract set for un-seeded accounts. */
export const MOCK_DEFAULT_CONTRACTS: ServiceContract[] = [
  {
    contractId: '4009003121',
    sla: 'Tech Care Basic',
    value: 740_000,
    currency: 'GBP',
    cities: ['London'],
    renewalDate: daysFromNow(129),
  },
  {
    contractId: '4009003138',
    sla: 'Tech Care Essential',
    value: 1_260_000,
    currency: 'GBP',
    cities: ['Manchester', 'Liverpool'],
    renewalDate: daysFromNow(47),
  },
];

/**
 * PLACEHOLDER DATA — how each account is contracted.
 * ASSUMPTION: drives whether the SLA spend breakdown counts contracts or
 * sites. Confirm with the account team — see README.
 */
export const MOCK_COVERAGE_MODEL: Record<string, SlaCoverageModel> = {
  'acc-001': 'location',
  'acc-002': 'customer',
  'acc-003': 'location',
};

export const MOCK_DEFAULT_COVERAGE_MODEL: SlaCoverageModel = 'customer';

/**
 * PLACEHOLDER DATA — invented commercial figures.
 *
 * `totalContractedSpend` and `slaBreakdown` are deliberately NOT stored here:
 * the mock service derives them from `MOCK_CONTRACTS` so the Value Overview
 * tile and the Active Service Contracts table can never disagree with each
 * other. Only figures with no other source live in this table.
 */
export type MockValueOverviewSeed = Omit<
  ValueOverview,
  'totalContractedSpend' | 'slaBreakdown' | 'slaCoverageModel'
>;

export const MOCK_VALUE_OVERVIEW: Record<string, MockValueOverviewSeed> = {
  'acc-001': {
    slaSpendPercent: 63,
    lastUpsellDate: monthsFromNow(-7),
    lastUpsellDescription: 'Tech Care Critical uplift across the Leeds estate',
    previous48MonthHardwareSpend: 18_400_000,
    predictedNext12MonthHardwareSpend: 5_260_000,
    predictionConfidence: 72,
    currency: 'GBP',
  },
  'acc-002': {
    slaSpendPercent: 81,
    lastUpsellDate: monthsFromNow(-2),
    lastUpsellDescription: 'Complete Care extension, two additional sites',
    previous48MonthHardwareSpend: 26_950_000,
    predictedNext12MonthHardwareSpend: 8_115_000,
    predictionConfidence: 84,
    currency: 'GBP',
  },
  'acc-003': {
    slaSpendPercent: 38,
    lastUpsellDate: monthsFromNow(-29),
    lastUpsellDescription: 'Storage support tier upgrade to Tech Care Essential',
    previous48MonthHardwareSpend: 41_300_000,
    predictedNext12MonthHardwareSpend: 9_480_000,
    predictionConfidence: 61,
    currency: 'GBP',
  },
};

/** PLACEHOLDER DATA — fallback value overview. */
export const MOCK_DEFAULT_VALUE_OVERVIEW: MockValueOverviewSeed = {
  slaSpendPercent: 57,
  lastUpsellDate: monthsFromNow(-14),
  lastUpsellDescription: 'Support tier uplift',
  previous48MonthHardwareSpend: 12_750_000,
  predictedNext12MonthHardwareSpend: 3_910_000,
  predictionConfidence: 66,
  currency: 'GBP',
};

/**
 * PLACEHOLDER DATA — invented relationship-health dates.
 *
 * acc-001 is seeded with an overdue workshop (>12 months) and no executive
 * sponsor service review, so both the overdue flags and the notification pane
 * have something real to show without anyone editing anything first.
 */
export const MOCK_MONITORING: Record<string, AccountMonitoring> = {
  'acc-001': {
    accountId: 'acc-001',
    customerProximity: {
      lastStakeholderMeeting: monthsFromNow(-2),
      lastWorkshop: monthsFromNow(-17),
      lastSpendOrSlaReview: monthsFromNow(-5),
    },
    customerCentricity: {
      lastCustomerVisit: monthsFromNow(-1),
      lastPerformanceReview: monthsFromNow(-8),
      lastExecutiveEngagement: monthsFromNow(-11),
      lastServiceReviewWithSponsor: null,
    },
    lastUpdatedAt: monthsFromNow(-1),
    lastUpdatedBy: 'Sample User',
  },
  'acc-002': {
    accountId: 'acc-002',
    customerProximity: {
      lastStakeholderMeeting: daysFromNow(-9),
      lastWorkshop: monthsFromNow(-4),
      lastSpendOrSlaReview: monthsFromNow(-2),
    },
    customerCentricity: {
      lastCustomerVisit: daysFromNow(-15),
      lastPerformanceReview: monthsFromNow(-3),
      lastExecutiveEngagement: monthsFromNow(-6),
      lastServiceReviewWithSponsor: monthsFromNow(-4),
    },
    lastUpdatedAt: daysFromNow(-9),
    lastUpdatedBy: 'Sample User',
  },
  'acc-003': {
    accountId: 'acc-003',
    customerProximity: {
      lastStakeholderMeeting: monthsFromNow(-3),
      lastWorkshop: monthsFromNow(-21),
      lastSpendOrSlaReview: monthsFromNow(-5),
    },
    customerCentricity: {
      lastCustomerVisit: monthsFromNow(-2),
      lastPerformanceReview: monthsFromNow(-9),
      lastExecutiveEngagement: monthsFromNow(-14),
      lastServiceReviewWithSponsor: monthsFromNow(-16),
    },
    lastUpdatedAt: monthsFromNow(-2),
    lastUpdatedBy: 'Sample User',
  },
};

/** PLACEHOLDER DATA — empty monitoring record for un-seeded accounts. */
export function emptyMonitoring(accountId: string): AccountMonitoring {
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

/** PLACEHOLDER DATA — invented meeting history. */
export const MOCK_MEETINGS: MeetingLog[] = [
  {
    meetingId: 'mtg-001',
    accountId: 'acc-001',
    meetingDate: daysFromNow(-12),
    place: 'Customer Site',
    subject: 'Q3 service review and renewal framing',
    comments:
      'Walked through incident trend since the Leeds migration. Sponsor raised response-time concerns on the Birmingham estate.',
    tags: ['SLA Review'],
    loggedAt: daysFromNow(-12),
    loggedBy: 'Sample User',
  },
  {
    meetingId: 'mtg-002',
    accountId: 'acc-001',
    meetingDate: daysFromNow(-46),
    place: 'Teams',
    subject: 'Storage refresh scoping',
    comments: 'Early scoping for the FY27 refresh. No commercials discussed.',
    tags: ['Upsell', 'Spend Review'],
    loggedAt: daysFromNow(-46),
    loggedBy: 'Sample User',
  },
  {
    meetingId: 'mtg-003',
    accountId: 'acc-002',
    meetingDate: daysFromNow(-3),
    place: 'CIC',
    subject: 'Innovation workshop — clinical systems resilience',
    comments: 'Full-day session. Strong engagement from the CTO’s team.',
    tags: ['Workshop', 'Leadership Introduction'],
    loggedAt: daysFromNow(-3),
    loggedBy: 'Sample User',
  },
];

/** PLACEHOLDER DATA — stands in for the Entra ID identity Power Pages supplies. */
/**
 * The signed-in user.
 *
 * `userId` MATCHES the first row of MOCK_PORTAL_USERS deliberately — "My
 * incentives" resolves what is assigned to this person by that id, so the two
 * drifting apart would silently show an empty list.
 */
export const MOCK_CURRENT_USER = {
  userId: 'usr-sample-001',
  displayName: 'Sample User',
  email: 'sample.user@example.invalid',
  roleIds: ['role-authenticated', 'role-account-manager', 'role-admin'],
};
