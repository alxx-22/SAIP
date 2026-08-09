/**
 * Seeds the SAIP demo tables from the app's own mock fixtures.
 *
 *   node scripts/dataverse/export-mock.mjs     # first — writes generated/mock-data.json
 *   node scripts/dataverse/seed.mjs            # then — pushes it to Dataverse
 *   node scripts/dataverse/seed.mjs --dry-run  # print what would be written
 *
 * SAFE TO RE-RUN. Every record is matched on its business key (`saip_key`) and
 * updated in place if found. Re-running after editing the fixtures updates the
 * rows rather than duplicating them.
 *
 * NOTHING IS DELETED. A row removed from the fixtures stays in Dataverse — the
 * script says so at the end rather than tidying up, because "seed script quietly
 * deleted my hand-edited demo record" is a bad afternoon.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, get, patch, post } from './dataverse.mjs';
import { PREFIX } from './schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');

const data = JSON.parse(readFileSync(join(HERE, 'generated', 'mock-data.json'), 'utf8'));

/**
 * logical name → entity set name, read from what Dataverse actually generated.
 *
 * Never derived. Dataverse mostly pluralises with a trailing 's', but not
 * always, and a wrong entity set name fails as a 404 that reads like a
 * permissions problem. `create-tables.mjs` writes this file from the live
 * metadata for exactly that reason.
 *
 * A dry run falls back to the naive guess, so the mapping can be reviewed
 * before the tables exist. A real run refuses to guess.
 */
let SET;
try {
  const entitySets = JSON.parse(
    readFileSync(join(HERE, 'generated', 'entity-sets.json'), 'utf8'),
  );
  SET = Object.fromEntries(entitySets.map((e) => [e.LogicalName, e.EntitySetName]));
} catch {
  if (!DRY) {
    console.error(
      'generated/entity-sets.json is missing — run create-tables.mjs first.',
    );
    process.exit(1);
  }
  SET = null;
}

const f = (name) => `${PREFIX}_${name}`;
/** ISO datetime or date → the date part, which is all a DateOnly column takes. */
const day = (value) => (value ? String(value).slice(0, 10) : null);
/** Arrays are stored as comma-separated keys — see the note in schema.mjs. */
const list = (values) => (values ?? []).join(',');

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

/* ── Run ─────────────────────────────────────────────────────────────── */

console.log(`Dataverse: ${API}`);
console.log(`Fixtures generated on ${data.generatedOn}${DRY ? '   (DRY RUN)' : ''}\n`);

let inserted = 0;
let updated = 0;

for (const mapping of MAPPINGS) {
  const logicalName = `${PREFIX}_${mapping.table}`;
  const entitySet = SET ? SET[logicalName] : `${logicalName}s  (guessed, dry run)`;

  if (!entitySet) {
    console.log(`  !  ${logicalName} — not in entity-sets.json; run create-tables.mjs first`);
    continue;
  }

  let localInserted = 0;
  let localUpdated = 0;

  for (const row of mapping.rows) {
    const key = mapping.key(row);
    const body = { [f('key')]: key, ...mapping.record(row) };

    if (DRY) {
      localInserted += 1;
      continue;
    }

    // Escape single quotes: an account named O'Brien would otherwise break the
    // OData filter rather than simply not matching.
    const safeKey = String(key).replace(/'/g, "''");
    const existing = await get(
      `${entitySet}?$filter=${f('key')} eq '${safeKey}'&$select=${logicalName}id`,
    );

    if (existing.value?.length) {
      await patch(`${entitySet}(${existing.value[0][`${logicalName}id`]})`, body);
      localUpdated += 1;
    } else {
      await post(entitySet, body);
      localInserted += 1;
    }
  }

  inserted += localInserted;
  updated += localUpdated;
  console.log(
    `  ${entitySet.padEnd(28)} ${String(localInserted).padStart(4)} new  ${String(localUpdated).padStart(4)} updated`,
  );
}

console.log(`\nDone. ${inserted} created, ${updated} updated.`);
console.log(
  'Rows removed from the fixtures are left in place — delete those by hand if you want them gone.',
);
