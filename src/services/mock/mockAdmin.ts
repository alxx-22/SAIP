/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLACEHOLDER DATA — admin configuration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The people and email addresses below are invented. The CONFIGURATION is not:
 * the questions, sections and dropdowns mirror what the app actually renders
 * today, field id for field id, so the admin portal shows the real current
 * state rather than a plausible-looking imitation.
 *
 * That matters for the SQL build plan. These records are the shape of the
 * tables, and the seed values are the migration's starting content — when the
 * app is wired to read from here, nothing on screen should change.
 *
 * WHERE THE SEED VALUES COME FROM
 *   questions  → components/focus/AccountMonitoringRibbon.tsx (the `mon-*` ids)
 *   dropdowns  → MEETING_PLACES, MEETING_TAGS, INCENTIVE_TYPES, SLA_TIERS
 *                in services/types.ts
 */

import type {
  OptionSet,
  PortalUser,
  QuestionDefinition,
  QuestionSection,
  WebRole,
} from '../types';

function timestampFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/* ─── Roles ─────────────────────────────────────────────────────────────── */

export const MOCK_WEB_ROLES: WebRole[] = [
  {
    roleId: 'role-admin',
    name: 'SAIP Administrator',
    description:
      'Full access, including this portal. Can change questions, dropdowns and who holds which role.',
    isAdministrator: true,
    isSystemManaged: false,
  },
  {
    roleId: 'role-sales',
    name: 'Account Manager',
    description:
      'The default role. Sees their own aligned accounts, logs meetings and maintains monitoring dates.',
    isAdministrator: false,
    isSystemManaged: false,
  },
  {
    roleId: 'role-bizdev',
    name: 'Business Development',
    description: 'Creates and manages incentives, and nominates accounts to them.',
    isAdministrator: false,
    isSystemManaged: false,
  },
  {
    roleId: 'role-exec',
    name: 'Executive',
    description:
      'Read-only across every account. Intended for the Executive View once it is built.',
    isAdministrator: false,
    isSystemManaged: false,
  },
  {
    roleId: 'role-authenticated',
    name: 'Authenticated Users',
    description:
      'Applied to everyone who signs in. Created and maintained by Power Pages.',
    isAdministrator: false,
    isSystemManaged: true,
  },
];

/* ─── Users ─────────────────────────────────────────────────────────────── */

export const MOCK_PORTAL_USERS: PortalUser[] = [
  {
    userId: 'user-001',
    displayName: 'Sample User',
    email: 'sample.user@example.invalid',
    roleIds: ['role-authenticated', 'role-sales', 'role-admin'],
    status: 'active',
    lastSignIn: timestampFromNow(0),
  },
  {
    userId: 'user-002',
    displayName: 'Priya Raman',
    email: 'priya.raman@example.invalid',
    roleIds: ['role-authenticated', 'role-bizdev'],
    status: 'active',
    lastSignIn: timestampFromNow(-1),
  },
  {
    userId: 'user-003',
    displayName: 'Daniel Okafor',
    email: 'daniel.okafor@example.invalid',
    roleIds: ['role-authenticated', 'role-sales'],
    status: 'active',
    lastSignIn: timestampFromNow(-3),
  },
  {
    userId: 'user-004',
    displayName: 'Marta Lindqvist',
    email: 'marta.lindqvist@example.invalid',
    roleIds: ['role-authenticated', 'role-sales', 'role-bizdev'],
    status: 'active',
    lastSignIn: timestampFromNow(-6),
  },
  {
    userId: 'user-005',
    displayName: 'Tom Whelan',
    email: 'tom.whelan@example.invalid',
    roleIds: ['role-authenticated', 'role-exec'],
    status: 'active',
    lastSignIn: timestampFromNow(-11),
  },
  {
    userId: 'user-006',
    displayName: 'Rachel Adeyemi',
    email: 'rachel.adeyemi@example.invalid',
    roleIds: ['role-authenticated'],
    // A leaver, kept to exercise the disabled state. Disabling rather than
    // deleting is the right pattern: the meetings they logged still reference them.
    status: 'disabled',
    lastSignIn: timestampFromNow(-190),
  },
];

/* ─── Question sections ─────────────────────────────────────────────────── */

export const MOCK_QUESTION_SECTIONS: QuestionSection[] = [
  {
    sectionId: 'sec-proximity',
    title: 'Customer Proximity',
    description: 'How close the account team is to the customer day to day.',
    area: 'account-monitoring',
    order: 1,
    enabled: true,
  },
  {
    sectionId: 'sec-centricity',
    title: 'Customer Centricity',
    description: 'How well the relationship is served at a senior level.',
    area: 'account-monitoring',
    order: 2,
    enabled: true,
  },
  {
    sectionId: 'sec-meeting',
    title: 'Meeting log',
    description: 'Captured when a rep logs a customer meeting.',
    area: 'meeting-log',
    order: 3,
    enabled: true,
  },
];

/* ─── Questions ─────────────────────────────────────────────────────────── */

/**
 * Ids match the DOM ids the ribbon renders today (`mon-workshop` and friends),
 * which is also what the notification deep-links target. Keeping them identical
 * means the wiring step is a lookup, not a mapping table.
 */
export const MOCK_QUESTIONS: QuestionDefinition[] = [
  {
    questionId: 'mon-stakeholder-meeting',
    sectionId: 'sec-proximity',
    label: 'Last meeting with key stakeholders',
    helpText: '',
    inputType: 'date',
    required: false,
    order: 1,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'mon-workshop',
    sectionId: 'sec-proximity',
    label: 'Last workshop held',
    helpText: 'Drives the overdue workshop notification.',
    inputType: 'date',
    required: false,
    order: 2,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'mon-spend-review',
    sectionId: 'sec-proximity',
    label: 'Last spend review / SLA review with customer',
    helpText: '',
    inputType: 'date',
    required: false,
    order: 3,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'mon-customer-visit',
    sectionId: 'sec-centricity',
    label: 'Last visit to customer',
    helpText: '',
    inputType: 'date',
    required: false,
    order: 1,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'mon-performance-review',
    sectionId: 'sec-centricity',
    label: 'Last performance review with customer',
    helpText: '',
    inputType: 'date',
    required: false,
    order: 2,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'mon-exec-engagement',
    sectionId: 'sec-centricity',
    label: 'Last executive engagement',
    helpText: '',
    inputType: 'date',
    required: false,
    order: 3,
    enabled: true,
    optionSetId: null,
    // Flagged in the brief as a working name. Renaming it here is exactly the
    // kind of change this portal exists to make without a deploy.
    nameProvisional: true,
  },
  {
    questionId: 'mon-sponsor-review',
    sectionId: 'sec-centricity',
    label: 'Last service review with executive sponsor',
    helpText: 'Drives the executive sponsor review notification.',
    inputType: 'date',
    required: false,
    order: 4,
    enabled: true,
    optionSetId: null,
    nameProvisional: true,
  },
  {
    questionId: 'meet-date',
    sectionId: 'sec-meeting',
    label: 'Meeting date',
    helpText: '',
    inputType: 'date',
    required: true,
    order: 1,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'meet-place',
    sectionId: 'sec-meeting',
    label: 'Where did it take place?',
    helpText: '',
    inputType: 'choice',
    required: true,
    order: 2,
    enabled: true,
    optionSetId: 'opt-meeting-place',
    nameProvisional: false,
  },
  {
    questionId: 'meet-subject',
    sectionId: 'sec-meeting',
    label: 'Subject',
    helpText: '',
    inputType: 'text',
    required: true,
    order: 3,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'meet-comments',
    sectionId: 'sec-meeting',
    label: 'Comments',
    helpText: 'What was discussed and what happens next.',
    inputType: 'longtext',
    required: false,
    order: 4,
    enabled: true,
    optionSetId: null,
    nameProvisional: false,
  },
  {
    questionId: 'meet-tags',
    sectionId: 'sec-meeting',
    label: 'Tags',
    helpText: 'Classifies the meeting for reporting.',
    inputType: 'multichoice',
    required: false,
    order: 5,
    enabled: true,
    optionSetId: 'opt-meeting-tag',
    nameProvisional: false,
  },
];

/* ─── Dropdowns ─────────────────────────────────────────────────────────── */

/** Builds an option list from plain labels, numbering the order from 1. */
function options(prefix: string, labels: string[]) {
  return labels.map((label, i) => ({
    optionId: `${prefix}-${i + 1}`,
    label,
    order: i + 1,
    enabled: true,
  }));
}

export const MOCK_OPTION_SETS: OptionSet[] = [
  {
    optionSetId: 'opt-meeting-place',
    name: 'Meeting place',
    description: 'Where a logged meeting took place.',
    usage: 'Log a meeting → Where did it take place?',
    codeDependent: false,
    options: options('mp', [
      'Phone Call',
      'Teams',
      'Customer Site',
      'CIC',
      'Channel Partner Site',
    ]),
  },
  {
    optionSetId: 'opt-meeting-tag',
    name: 'Meeting tag',
    description: 'Classification applied to a logged meeting.',
    usage: 'Log a meeting → Tags; Recent Meetings chips',
    codeDependent: true,
    options: options('mt', [
      'Workshop',
      'Upsell',
      'SLA Review',
      'Spend Review',
      'Leadership Introduction',
    ]),
  },
  {
    optionSetId: 'opt-incentive-type',
    name: 'Incentive purpose',
    description: 'What a Business Development incentive is for.',
    usage: 'Business Development → New incentive → Purpose',
    codeDependent: true,
    options: options('it', ['Sales Training', 'Upsell', 'Workshop', 'Sales Play']),
  },
  {
    optionSetId: 'opt-sla-tier',
    name: 'SLA tier',
    description: 'Service level attached to a contract.',
    usage: 'Active Service Contracts; SLA spend breakdown',
    // Contract data arrives from the source system using these exact strings.
    codeDependent: true,
    options: options('sla', [
      'Complete Care',
      'Tech Care Basic',
      'Tech Care Essential',
      'Tech Care Critical',
    ]),
  },
  {
    optionSetId: 'opt-opportunity-stage',
    name: 'Opportunity stage',
    description: 'Where an opportunity sits in the sales cycle.',
    usage: 'Campaign code opportunities',
    codeDependent: true,
    options: options('stg', [
      'Qualify',
      'Propose',
      'Negotiate',
      'Closed won',
      'Closed lost',
    ]),
  },
];
