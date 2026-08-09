/**
 * How each fixture collection maps onto a Dataverse table.
 *
 * Extracted so BOTH seeding paths share it: `seed.mjs` writes straight to
 * Dataverse from Node, and `export-records.mjs` bakes the same output to JSON
 * for the PowerShell scripts to POST.
 *
 * That split matters. Reimplementing the mapping in PowerShell would mean two
 * definitions of "which fixture field becomes which column", and the first time
 * one gained a field the other would quietly stop matching. Here PowerShell
 * does no interpretation at all — it transports what Node produced.
 */

import { PREFIX } from './schema.mjs';

const f = (name) => `${PREFIX}_${name}`;
/** ISO datetime or date -> the date part, which is all a DateOnly column takes. */
const day = (value) => (value ? String(value).slice(0, 10) : null);
/** Arrays are stored as comma-separated keys — see the note in schema.mjs. */
const list = (values) => (values ?? []).join(',');

/** The field every record is matched on when re-running. */
export const KEY_FIELD = f('key');

export function buildMappings(data) {
  /*
    Each entry maps one fixture collection onto one table.
  
    `key` must be stable and unique: it is what re-running matches on. Where the
    fixture has no single id — a score is per account per metric, a monitoring
    answer per account per question — the key is composed, which is exactly what
    the SQL build does with its business keys.
  */
  const MAPPINGS = [
    {
      table: 'capability',
      rows: data.capabilities,
      key: (c) => c.id,
      record: (c) => ({ [f('name')]: c.label, [f('description')]: c.description ?? '' }),
    },
    {
      table: 'role',
      rows: data.roles,
      key: (r) => r.roleId,
      record: (r) => ({
        [f('name')]: r.name,
        [f('description')]: r.description ?? '',
        [f('isadministrator')]: !!r.isAdministrator,
        [f('issystemmanaged')]: !!r.isSystemManaged,
        [f('capabilitykeys')]: list(r.capabilities),
      }),
    },
    {
      table: 'user',
      rows: data.users,
      key: (u) => u.userId,
      record: (u) => ({
        [f('name')]: u.displayName,
        [f('email')]: u.email,
        [f('status')]: u.status,
        [f('lastsignin')]: day(u.lastSignIn),
        [f('rolekeys')]: list(u.roleIds),
      }),
    },
    {
      table: 'questionsection',
      rows: data.sections,
      key: (s) => s.sectionId,
      record: (s) => ({
        [f('name')]: s.title,
        [f('description')]: s.description ?? '',
        [f('area')]: s.area,
        [f('sortorder')]: s.order,
        [f('isenabled')]: !!s.enabled,
      }),
    },
    {
      table: 'optionset',
      rows: data.optionSets,
      key: (o) => o.optionSetId,
      record: (o) => ({
        [f('name')]: o.name,
        [f('description')]: o.description ?? '',
        [f('usage')]: o.usage ?? '',
        [f('iscodedependent')]: !!o.codeDependent,
      }),
    },
    {
      table: 'option',
      // Options are nested inside their set in the fixtures; the table is flat.
      rows: data.optionSets.flatMap((set) =>
        set.options.map((option) => ({ ...option, optionSetId: set.optionSetId })),
      ),
      key: (o) => o.optionId,
      record: (o) => ({
        [f('name')]: o.label,
        [f('optionsetkey')]: o.optionSetId,
        [f('sortorder')]: o.order,
        [f('isenabled')]: !!o.enabled,
      }),
    },
    {
      table: 'question',
      rows: data.questions,
      key: (q) => q.questionId,
      record: (q) => ({
        [f('name')]: q.label,
        [f('sectionkey')]: q.sectionId,
        [f('helptext')]: q.helpText ?? '',
        [f('inputtype')]: q.inputType,
        [f('isrequired')]: !!q.required,
        [f('sortorder')]: q.order,
        [f('isenabled')]: !!q.enabled,
        [f('optionsetkey')]: q.optionSetId ?? '',
        [f('nameprovisional')]: !!q.nameProvisional,
        [f('systemreferences')]: list(q.systemReferences),
      }),
    },
    {
      table: 'account',
      rows: data.accounts,
      key: (a) => a.accountId,
      record: (a) => ({
        [f('name')]: a.accountName,
        [f('companygroupid')]: a.companyGroupId,
        [f('industry')]: a.industry,
        [f('region')]: a.region,
        [f('annualservicesrevenue')]: a.annualServicesRevenue,
        [f('currencycode')]: a.currency,
        [f('activecontractcount')]: a.activeContractCount,
        [f('lastmeetingdate')]: day(a.lastMeetingDate),
      }),
    },
    {
      table: 'score',
      rows: data.scores,
      key: (s) => `${s.accountId}:${s.key}`,
      record: (s) => ({
        [f('name')]: `${s.label}`,
        [f('accountkey')]: s.accountId,
        [f('scorekey')]: s.key,
        [f('value')]: s.value,
        [f('status')]: s.status,
        [f('deltapoints')]: s.deltaPoints,
        [f('explainer')]: s.explainer ?? '',
      }),
    },
    {
      table: 'servicecontract',
      rows: data.contracts,
      key: (c) => c.contractId,
      record: (c) => ({
        [f('name')]: c.contractId,
        [f('accountkey')]: c.accountId,
        [f('sla')]: c.sla,
        [f('value')]: c.value,
        [f('currencycode')]: c.currency,
        [f('cities')]: list(c.cities),
        [f('renewaldate')]: day(c.renewalDate),
      }),
    },
    {
      table: 'opportunity',
      rows: data.opportunities,
      key: (o) => o.opportunityId,
      record: (o) => ({
        [f('name')]: o.name,
        [f('opportunitynumber')]: o.opportunityNumber,
        [f('accountkey')]: o.accountId,
        [f('companygroupid')]: o.companyGroupId,
        [f('description')]: o.description ?? '',
        [f('stage')]: o.stage,
        [f('forecastcategory')]: o.forecastCategory,
        [f('closedate')]: day(o.closeDate),
        [f('totalvalue')]: o.totalValue,
        [f('currencycode')]: o.currency,
        [f('ownername')]: o.ownerName,
        [f('owneremail')]: o.ownerEmail,
        [f('campaignname')]: o.campaignName ?? '',
        [f('salesmotion')]: o.salesMotion,
      }),
    },
    {
      table: 'opportunityline',
      rows: data.opportunities.flatMap((o) =>
        o.lines.map((line) => ({ ...line, opportunityNumber: o.opportunityNumber })),
      ),
      key: (l) => l.lineId,
      record: (l) => ({
        [f('name')]: l.productName,
        [f('opportunitynumber')]: l.opportunityNumber,
        [f('productcategory')]: l.productCategory,
        [f('value')]: l.value,
        [f('currencycode')]: l.currency,
      }),
    },
    {
      table: 'monitoringanswer',
      rows: data.monitoringAnswers,
      key: (m) => `${m.accountId}:${m.questionKey}`,
      record: (m) => ({
        [f('name')]: `${m.accountId} ${m.questionKey}`,
        [f('accountkey')]: m.accountId,
        [f('questionkey')]: m.questionKey,
        [f('valuedate')]: day(m.value),
        [f('updatedby')]: m.updatedBy ?? '',
      }),
    },
    {
      table: 'meeting',
      rows: data.meetings,
      key: (m) => m.meetingId,
      record: (m) => ({
        [f('name')]: m.subject ?? 'Meeting',
        [f('accountkey')]: m.accountId,
        [f('meetingdate')]: day(m.meetingDate),
        [f('place')]: m.place ?? '',
        [f('tags')]: list(m.tags),
        [f('subject')]: m.subject ?? '',
        [f('comments')]: m.comments ?? '',
        [f('loggedby')]: m.loggedBy ?? '',
      }),
    },
    {
      table: 'incentive',
      rows: data.incentives,
      key: (i) => i.incentiveId,
      record: (i) => ({
        [f('name')]: i.title,
        [f('overview')]: i.overview ?? '',
        [f('campaigncode')]: i.campaignCode ?? '',
        [f('type')]: i.type,
        [f('startdate')]: day(i.startDate),
        [f('enddate')]: day(i.endDate),
        [f('createdby')]: i.createdBy ?? '',
        [f('nominatedaccountkeys')]: list(i.nominatedAccountIds),
        [f('assigneduserkeys')]: list(i.assignedUserIds),
        [f('assignedrolekeys')]: list(i.assignedRoleIds),
      }),
    },
    {
      table: 'incentivedocument',
      /*
        Metadata only — the bytes are not seeded. A document row with no note
        behind it is exactly the state the UI already renders as "unavailable",
        so this seeds the list without pretending the files exist.
      */
      rows: data.incentives.flatMap((i) =>
        (i.resources ?? []).map((r, index) => ({
          ...r,
          incentiveId: i.incentiveId,
          sortOrder: index + 1,
        })),
      ),
      key: (r) => r.resourceId,
      record: (r) => ({
        [f('name')]: r.name,
        [f('incentivekey')]: r.incentiveId,
        [f('mimetype')]: r.kind === 'pdf' ? 'application/pdf' : 'application/octet-stream',
        [f('sizebytes')]: r.sizeBytes ?? null,
        [f('sortorder')]: r.sortOrder,
        [f('uploadedon')]: day(r.uploadedAt),
        [f('uploadedby')]: r.uploadedBy ?? '',
      }),
    },
  ];

  return MAPPINGS;
}
