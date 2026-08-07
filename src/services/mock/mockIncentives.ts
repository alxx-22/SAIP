/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLACEHOLDER DATA — Business Development incentives
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every incentive, campaign code, opportunity number, figure and document name
 * below is invented. No campaign here has been run and no opportunity exists.
 *
 * Opportunity numbers follow the real `OPE-` + ten-digit shape so the column
 * widths and wrapping are honest, but the digits are made up.
 *
 * As elsewhere in the mock layer, dates are RELATIVE TO TODAY rather than
 * hardcoded, so the set keeps demonstrating both sides of the active/historical
 * split as time passes instead of drifting entirely into the past.
 *
 * See README → "Placeholder data checklist".
 */

import type { Incentive } from '../types';
import { MOCK_ACCOUNTS } from './mockData';

/**
 * Account name for an id, read from the account list rather than retyped.
 *
 * Opportunities carry a denormalised `accountName` because that is what the
 * Web API returns for an expanded lookup — but duplicating the literal here
 * would let the two drift the moment an account is renamed. Throwing on an
 * unknown id turns a bad reference into an immediate failure instead of an
 * "undefined" rendered into the table.
 */
function nameOf(accountId: string): string {
  const account = MOCK_ACCOUNTS.find((a) => a.accountId === accountId);
  if (!account) throw new Error(`mockIncentives: unknown accountId ${accountId}`);
  return account.accountName;
}

/** ISO date `n` days from today. Negative = past. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Full ISO timestamp `n` days from today, for audit fields. */
function timestampFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export const MOCK_INCENTIVES: Incentive[] = [
  {
    incentiveId: 'inc-001',
    title: 'Complete Care attach on renewal',
    overview:
      'Target every Foundation Care contract renewing in the next two quarters with a Complete Care upgrade conversation. Focus on accounts already running mixed SLA tiers, where the consolidation argument is strongest.',
    campaignCode: 'CC-ATTACH-Q3',
    type: 'Upsell',
    startDate: daysFromNow(-38),
    endDate: daysFromNow(52),
    resources: [
      {
        resourceId: 'res-001',
        name: 'Complete Care attach — battlecard.pdf',
        kind: 'pdf',
        sizeBytes: 1_284_000,
        uploadedAt: timestampFromNow(-38),
        uploadedBy: 'Priya Raman',
        url: null,
      },
      {
        resourceId: 'res-002',
        name: 'Renewal objection handling.pdf',
        kind: 'pdf',
        sizeBytes: 642_000,
        uploadedAt: timestampFromNow(-31),
        uploadedBy: 'Priya Raman',
        url: null,
      },
      {
        resourceId: 'res-003',
        name: 'Customer-facing one-pager.pdf',
        kind: 'pdf',
        sizeBytes: 2_105_000,
        uploadedAt: timestampFromNow(-24),
        uploadedBy: 'Daniel Okafor',
        url: null,
      },
    ],
    nominatedAccountIds: ['acc-001', 'acc-003', 'acc-004', 'acc-005'],
    // Assigned by role: every account manager works their own renewals, and
    // anyone joining the role later picks it up without being added by name.
    assignedUserIds: [],
    assignedRoleIds: ['role-account-manager'],
    opportunities: [
      {
        opportunityId: 'OPE-4471903268',
        accountId: 'acc-001',
        accountName: nameOf('acc-001'),
        description: 'Complete Care upgrade — Aberdeen and Leeds sites',
        value: 412_000,
        currency: 'GBP',
        stage: 'Negotiate',
        closeDate: daysFromNow(24),
      },
      {
        opportunityId: 'OPE-4471903341',
        accountId: 'acc-003',
        accountName: nameOf('acc-003'),
        description: 'Foundation Care → Complete Care consolidation',
        value: 268_500,
        currency: 'GBP',
        stage: 'Propose',
        closeDate: daysFromNow(41),
      },
      {
        opportunityId: 'OPE-4471903512',
        accountId: 'acc-005',
        accountName: nameOf('acc-005'),
        description: 'Complete Care attach on distribution centre refresh',
        value: 155_000,
        currency: 'GBP',
        stage: 'Qualify',
        closeDate: daysFromNow(63),
      },
      {
        opportunityId: 'OPE-4471903688',
        accountId: 'acc-004',
        accountName: nameOf('acc-004'),
        description: 'Tech Care Critical uplift, trading floor',
        value: 331_000,
        currency: 'GBP',
        stage: 'Closed won',
        closeDate: daysFromNow(-9),
      },
      {
        opportunityId: 'OPE-4471903704',
        accountId: 'acc-001',
        accountName: nameOf('acc-001'),
        description: 'Storage support extension — declined, budget deferred',
        value: 88_000,
        currency: 'GBP',
        stage: 'Closed lost',
        closeDate: daysFromNow(-16),
      },
    ],
    createdAt: timestampFromNow(-40),
    createdBy: 'Priya Raman',
  },
  {
    incentiveId: 'inc-002',
    title: 'Services discovery workshop programme',
    overview:
      'Run a half-day discovery workshop with each nominated account to map their current support estate against where they are heading. Output is a written findings pack the account team can build a proposal from.',
    campaignCode: 'WS-DISC-26',
    type: 'Workshop',
    startDate: daysFromNow(-14),
    endDate: daysFromNow(106),
    resources: [
      {
        resourceId: 'res-004',
        name: 'Workshop facilitator guide.pdf',
        kind: 'pdf',
        sizeBytes: 3_420_000,
        uploadedAt: timestampFromNow(-14),
        uploadedBy: 'Marta Lindqvist',
        url: null,
      },
      {
        resourceId: 'res-005',
        name: 'Discovery findings template.pdf',
        kind: 'pdf',
        sizeBytes: 918_000,
        uploadedAt: timestampFromNow(-14),
        uploadedBy: 'Marta Lindqvist',
        url: null,
      },
    ],
    nominatedAccountIds: ['acc-002', 'acc-006', 'acc-008'],
    assignedUserIds: ['usr-sample-001', 'user-003'],
    assignedRoleIds: [],
    opportunities: [
      {
        opportunityId: 'OPE-5093117420',
        accountId: 'acc-002',
        accountName: nameOf('acc-002'),
        description: 'Managed services scoping following discovery',
        value: 540_000,
        currency: 'GBP',
        stage: 'Propose',
        closeDate: daysFromNow(78),
      },
      {
        opportunityId: 'OPE-5093117655',
        accountId: 'acc-008',
        accountName: nameOf('acc-008'),
        description: 'Estate consolidation, phase one',
        value: 197_400,
        currency: 'GBP',
        stage: 'Qualify',
        closeDate: daysFromNow(92),
      },
    ],
    createdAt: timestampFromNow(-15),
    createdBy: 'Marta Lindqvist',
  },
  {
    incentiveId: 'inc-003',
    title: 'GreenLake services positioning — enablement',
    overview:
      'Enablement track for the services team on positioning consumption-based support alongside traditional contracts. Completion is expected before the Q4 planning cycle.',
    campaignCode: null,
    type: 'Sales Training',
    startDate: daysFromNow(-6),
    // Open-ended: no end date, so it stays active until someone sets one.
    endDate: null,
    resources: [
      {
        resourceId: 'res-006',
        name: 'Positioning deck — services.pdf',
        kind: 'pdf',
        sizeBytes: 5_640_000,
        uploadedAt: timestampFromNow(-6),
        uploadedBy: 'Tom Whelan',
        url: null,
      },
      {
        resourceId: 'res-007',
        name: 'Competitive comparison sheet.pdf',
        kind: 'pdf',
        sizeBytes: 764_000,
        uploadedAt: timestampFromNow(-5),
        uploadedBy: 'Tom Whelan',
        url: null,
      },
    ],
    // Enablement, so there are no target accounts at all — the whole point of
    // this incentive is the people, not the customers.
    nominatedAccountIds: [],
    assignedUserIds: [],
    assignedRoleIds: ['role-account-manager', 'role-bizdev', 'role-line-manager'],
    // No campaign code, so nothing can be raised against it. The detail view
    // says so rather than showing an empty table.
    opportunities: [],
    createdAt: timestampFromNow(-7),
    createdBy: 'Tom Whelan',
  },
  {
    incentiveId: 'inc-004',
    title: 'Public sector framework sales play',
    overview:
      'Coordinated play against the refreshed public sector procurement framework. Nominated accounts were selected on framework eligibility and existing support spend.',
    campaignCode: 'SP-PUBSEC-01',
    type: 'Sales Play',
    startDate: daysFromNow(-214),
    endDate: daysFromNow(-31),
    resources: [
      {
        resourceId: 'res-008',
        name: 'Framework eligibility criteria.pdf',
        kind: 'pdf',
        sizeBytes: 1_090_000,
        uploadedAt: timestampFromNow(-214),
        uploadedBy: 'Priya Raman',
        url: null,
      },
      {
        resourceId: 'res-009',
        name: 'Play close-out report.pdf',
        kind: 'pdf',
        sizeBytes: 2_780_000,
        uploadedAt: timestampFromNow(-28),
        uploadedBy: 'Priya Raman',
        url: null,
      },
    ],
    nominatedAccountIds: ['acc-002', 'acc-007'],
    assignedUserIds: [],
    assignedRoleIds: ['role-bizdev'],
    opportunities: [
      {
        opportunityId: 'OPE-3318827094',
        accountId: 'acc-002',
        accountName: nameOf('acc-002'),
        description: 'Framework award — support services lot',
        value: 1_240_000,
        currency: 'GBP',
        stage: 'Closed won',
        closeDate: daysFromNow(-44),
      },
      {
        opportunityId: 'OPE-3318827233',
        accountId: 'acc-007',
        accountName: nameOf('acc-007'),
        description: 'Framework award — infrastructure lot',
        value: 610_000,
        currency: 'GBP',
        stage: 'Closed lost',
        closeDate: daysFromNow(-52),
      },
    ],
    createdAt: timestampFromNow(-220),
    createdBy: 'Priya Raman',
  },
  {
    incentiveId: 'inc-005',
    title: 'Storage support attach — spring push',
    overview:
      'Short campaign attaching support to storage refreshes closed in the previous quarter. Closed out; retained for reference on what the attach rate looked like.',
    campaignCode: 'ST-ATTACH-SPR',
    type: 'Upsell',
    startDate: daysFromNow(-152),
    endDate: daysFromNow(-88),
    resources: [
      {
        resourceId: 'res-010',
        name: 'Attach rate summary.pdf',
        kind: 'pdf',
        sizeBytes: 448_000,
        uploadedAt: timestampFromNow(-86),
        uploadedBy: 'Daniel Okafor',
        url: null,
      },
    ],
    nominatedAccountIds: ['acc-005', 'acc-006'],
    assignedUserIds: ['usr-sample-001'],
    assignedRoleIds: [],
    opportunities: [
      {
        opportunityId: 'OPE-2874650119',
        accountId: 'acc-005',
        accountName: nameOf('acc-005'),
        description: 'Support attach on array refresh',
        value: 96_000,
        currency: 'GBP',
        stage: 'Closed won',
        closeDate: daysFromNow(-96),
      },
    ],
    createdAt: timestampFromNow(-160),
    createdBy: 'Daniel Okafor',
  },
];
