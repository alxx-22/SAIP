/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLACEHOLDER DATA — replace with live Dataverse/Fabric source before release
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every account name, figure, score, contract, city and date in this file is
 * invented. Nothing here is a real HPE customer or a real commercial figure.
 * The company names are deliberately generic-fictional so they cannot be
 * mistaken for real accounts.
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
    industry: 'Healthcare',
    region: 'UK & Ireland',
    annualServicesRevenue: 7_140_000,
    currency: 'GBP',
    activeContractCount: 6,
    lastMeetingDate: daysFromNow(-3),
  },
  {
    accountId: 'acc-003',
    accountName: 'Caledonia Energy plc',
    industry: 'Energy & Utilities',
    region: 'UK & Ireland',
    annualServicesRevenue: 11_960_000,
    currency: 'GBP',
    activeContractCount: 9,
    lastMeetingDate: daysFromNow(-41),
  },
  {
    accountId: 'acc-004',
    accountName: 'Aldergate Financial Services',
    industry: 'Financial Services',
    region: 'UK & Ireland',
    annualServicesRevenue: 9_305_000,
    currency: 'GBP',
    activeContractCount: 5,
    lastMeetingDate: daysFromNow(-67),
  },
  {
    accountId: 'acc-005',
    accountName: 'Vantage Retail Holdings',
    industry: 'Retail',
    region: 'UK & Ireland',
    annualServicesRevenue: 2_450_000,
    currency: 'GBP',
    activeContractCount: 3,
    lastMeetingDate: null,
  },
  {
    accountId: 'acc-006',
    accountName: 'Orbital Manufacturing Ltd',
    industry: 'Manufacturing',
    region: 'UK & Ireland',
    annualServicesRevenue: 6_015_000,
    currency: 'GBP',
    activeContractCount: 7,
    lastMeetingDate: daysFromNow(-23),
  },
  {
    accountId: 'acc-007',
    accountName: 'Kingsway Public Sector Partnership',
    industry: 'Public Sector',
    region: 'UK & Ireland',
    annualServicesRevenue: 13_720_000,
    currency: 'GBP',
    activeContractCount: 11,
    lastMeetingDate: daysFromNow(-8),
  },
  {
    accountId: 'acc-008',
    accountName: 'Halcyon Media Networks',
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
 * One score is deliberately in `attention` so the ambient breathing state and
 * the "needs attention" colour treatment are visible in the prototype.
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

/** PLACEHOLDER DATA — invented commercial figures. */
export const MOCK_VALUE_OVERVIEW: Record<string, ValueOverview> = {
  'acc-001': {
    slaSpendPercent: 63,
    totalContractedSpend: 4_820_000,
    lastUpsellDate: monthsFromNow(-7),
    lastUpsellDescription: 'Proactive Care uplift across the Leeds estate',
    previous48MonthHardwareSpend: 18_400_000,
    predictedNext12MonthHardwareSpend: 5_260_000,
    predictionConfidence: 72,
    currency: 'GBP',
  },
  'acc-002': {
    slaSpendPercent: 81,
    totalContractedSpend: 7_140_000,
    lastUpsellDate: monthsFromNow(-2),
    lastUpsellDescription: 'Datacentre Care extension, two additional sites',
    previous48MonthHardwareSpend: 26_950_000,
    predictedNext12MonthHardwareSpend: 8_115_000,
    predictionConfidence: 84,
    currency: 'GBP',
  },
  'acc-003': {
    slaSpendPercent: 38,
    totalContractedSpend: 11_960_000,
    lastUpsellDate: monthsFromNow(-29),
    lastUpsellDescription: 'Storage support tier upgrade',
    previous48MonthHardwareSpend: 41_300_000,
    predictedNext12MonthHardwareSpend: 9_480_000,
    predictionConfidence: 61,
    currency: 'GBP',
  },
};

/** PLACEHOLDER DATA — fallback value overview. */
export const MOCK_DEFAULT_VALUE_OVERVIEW: ValueOverview = {
  slaSpendPercent: 57,
  totalContractedSpend: 3_400_000,
  lastUpsellDate: monthsFromNow(-14),
  lastUpsellDescription: 'Support tier uplift',
  previous48MonthHardwareSpend: 12_750_000,
  predictedNext12MonthHardwareSpend: 3_910_000,
  predictionConfidence: 66,
  currency: 'GBP',
};

/**
 * PLACEHOLDER DATA — invented contracts.
 * Renewal dates are spread either side of the 90-day threshold on purpose so
 * the "renewing soon" badge pulse is demonstrable.
 */
export const MOCK_CONTRACTS: Record<string, ServiceContract[]> = {
  'acc-001': [
    {
      contractId: 'ctr-1001',
      sla: 'Proactive Care 24x7',
      value: 1_940_000,
      currency: 'GBP',
      cities: ['Leeds', 'Manchester'],
      renewalDate: daysFromNow(38),
    },
    {
      contractId: 'ctr-1002',
      sla: 'Foundation Care NBD',
      value: 620_000,
      currency: 'GBP',
      cities: ['Birmingham'],
      renewalDate: daysFromNow(214),
    },
    {
      contractId: 'ctr-1003',
      sla: 'Datacentre Care',
      value: 1_760_000,
      currency: 'GBP',
      cities: ['Leeds', 'Glasgow', 'Bristol'],
      renewalDate: daysFromNow(72),
    },
    {
      contractId: 'ctr-1004',
      sla: 'Foundation Care 24x7',
      value: 500_000,
      currency: 'GBP',
      cities: ['Cardiff'],
      renewalDate: daysFromNow(401),
    },
  ],
  'acc-002': [
    {
      contractId: 'ctr-2001',
      sla: 'Datacentre Care',
      value: 3_100_000,
      currency: 'GBP',
      cities: ['London', 'Reading'],
      renewalDate: daysFromNow(156),
    },
    {
      contractId: 'ctr-2002',
      sla: 'Proactive Care 24x7',
      value: 2_240_000,
      currency: 'GBP',
      cities: ['Sheffield', 'Nottingham'],
      renewalDate: daysFromNow(19),
    },
    {
      contractId: 'ctr-2003',
      sla: 'Foundation Care NBD',
      value: 890_000,
      currency: 'GBP',
      cities: ['Newcastle'],
      renewalDate: daysFromNow(287),
    },
    {
      contractId: 'ctr-2004',
      sla: 'Tech Care Essential',
      value: 910_000,
      currency: 'GBP',
      cities: ['London'],
      renewalDate: daysFromNow(63),
    },
  ],
  'acc-003': [
    {
      contractId: 'ctr-3001',
      sla: 'Datacentre Care',
      value: 5_420_000,
      currency: 'GBP',
      cities: ['Aberdeen', 'Edinburgh'],
      renewalDate: daysFromNow(88),
    },
    {
      contractId: 'ctr-3002',
      sla: 'Proactive Care 24x7',
      value: 3_180_000,
      currency: 'GBP',
      cities: ['Glasgow', 'Inverness', 'Dundee'],
      renewalDate: daysFromNow(342),
    },
    {
      contractId: 'ctr-3003',
      sla: 'Foundation Care 24x7',
      value: 2_060_000,
      currency: 'GBP',
      cities: ['Aberdeen'],
      renewalDate: daysFromNow(11),
    },
  ],
};

/** PLACEHOLDER DATA — fallback contract set. */
export const MOCK_DEFAULT_CONTRACTS: ServiceContract[] = [
  {
    contractId: 'ctr-9001',
    sla: 'Foundation Care NBD',
    value: 740_000,
    currency: 'GBP',
    cities: ['London'],
    renewalDate: daysFromNow(129),
  },
  {
    contractId: 'ctr-9002',
    sla: 'Proactive Care 24x7',
    value: 1_260_000,
    currency: 'GBP',
    cities: ['Manchester', 'Liverpool'],
    renewalDate: daysFromNow(47),
  },
];

/**
 * PLACEHOLDER DATA — invented relationship-health dates.
 * acc-001 is seeded with an overdue workshop (>12 months) so the persistent
 * overdue flag is visible without editing anything.
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
export const MOCK_CURRENT_USER = {
  userId: 'usr-sample-001',
  displayName: 'Sample User',
  email: 'sample.user@example.invalid',
};
