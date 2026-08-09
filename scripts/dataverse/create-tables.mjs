/**
 * Creates the SAIP demo tables in Dataverse.
 *
 *   node scripts/dataverse/create-tables.mjs            # create anything missing
 *   node scripts/dataverse/create-tables.mjs --dry-run  # print the plan only
 *
 * `--dry-run` makes NO network calls whatsoever — it prints the full plan, so
 * the schema can be reviewed before anyone has a token in hand.
 *
 * SAFE TO RE-RUN. Every step checks first and skips what already exists, so a
 * partial run — a token expiring halfway through ~150 metadata calls is the
 * normal failure — is fixed by running it again.
 *
 * NOTHING IS EVER DELETED HERE. Removing a table takes its data with it, and a
 * script that can do that by accident is not one to leave in a repo. Drop tables
 * from the maker portal, deliberately.
 *
 * The last thing it writes is `generated/entity-sets.json` — the logical and
 * entity-set names the front end needs for its Web API calls, which cannot be
 * guessed reliably because Dataverse lowercases, prefixes and sometimes
 * truncates them.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API,
  SOLUTION,
  get,
  label,
  post,
  publishAll,
  solutionHeader,
} from './dataverse.mjs';
import { PREFIX, TABLES, columnBody, tableBody } from './schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');

let created = 0;
let skipped = 0;

function log(status, what, detail = '') {
  const mark = status === 'create' ? '  +' : status === 'skip' ? '  ·' : '  !';
  console.log(`${mark} ${what}${detail ? '  ' + detail : ''}`);
  if (status === 'create') created += 1;
  if (status === 'skip') skipped += 1;
}

/* ── Publisher ───────────────────────────────────────────────────────────
   The publisher owns the `saip_` prefix. It must exist before the solution,
   and both must exist before any table, or the tables land in the Default
   Solution and become painful to move to another environment later. */
async function ensurePublisher() {
  if (DRY) {
    log('create', `publisher ${PREFIX}`, '(dry run)');
    return null;
  }
  const found = await get(`publishers?$filter=uniquename eq '${PREFIX}'&$select=publisherid`);
  if (found.value?.length) {
    log('skip', `publisher ${PREFIX}`);
    return found.value[0].publisherid;
  }
  const body = {
    uniquename: PREFIX,
    friendlyname: 'SAIP',
    description: 'Services Account Intelligence Portal',
    customizationprefix: PREFIX,
    // Any free block. Only matters if choice columns are ever added.
    customizationoptionvalueprefix: 74100,
  };
  const response = await post('publishers', body, { Prefer: 'return=representation' });
  log('create', `publisher ${PREFIX}`);
  return response.publisherid;
}

async function ensureSolution(publisherId) {
  if (DRY) {
    log('create', `solution ${SOLUTION}`, '(dry run)');
    return null;
  }
  const found = await get(`solutions?$filter=uniquename eq '${SOLUTION}'&$select=solutionid`);
  if (found.value?.length) {
    log('skip', `solution ${SOLUTION}`);
    return found.value[0].solutionid;
  }
  const response = await post(
    'solutions',
    {
      uniquename: SOLUTION,
      friendlyname: 'SAIP Demo Data',
      version: '1.0.0.0',
      'publisherid@odata.bind': `/publishers(${publisherId})`,
    },
    { Prefer: 'return=representation' },
  );
  log('create', `solution ${SOLUTION}`);
  return response.solutionid;
}

/* ── Tables and columns ──────────────────────────────────────────────── */

async function tableExists(logicalName) {
  const response = await get(
    `EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName`,
  );
  return !response.notFound;
}

async function columnExists(logicalName, attributeLogicalName) {
  const response = await get(
    `EntityDefinitions(LogicalName='${logicalName}')/Attributes(LogicalName='${attributeLogicalName}')?$select=LogicalName`,
  );
  return !response.notFound;
}

async function ensureTable(table) {
  const logicalName = `${PREFIX}_${table.schema}`.toLowerCase();

  if (DRY) {
    log('create', logicalName, table.hasNotes ? '(notes enabled, dry run)' : '(dry run)');
  } else if (await tableExists(logicalName)) {
    log('skip', logicalName);
  } else {
    await post('EntityDefinitions', tableBody(table, label), solutionHeader);
    log('create', logicalName, table.hasNotes ? '(notes enabled)' : '');
  }

  for (const column of table.columns) {
    const attributeLogicalName = `${PREFIX}_${column.name}`.toLowerCase();
    if (!DRY && (await columnExists(logicalName, attributeLogicalName))) {
      log('skip', `  ${attributeLogicalName}`);
      continue;
    }
    if (DRY) {
      log('create', `  ${attributeLogicalName}`, `(${column.kind}, dry run)`);
      continue;
    }
    await post(
      `EntityDefinitions(LogicalName='${logicalName}')/Attributes`,
      columnBody(column, label),
      solutionHeader,
    );
    log('create', `  ${attributeLogicalName}`, `(${column.kind})`);
  }
}

/* ── The handoff file ────────────────────────────────────────────────────
   Entity SET names are what the Power Pages Web API takes in its URL, and they
   are not derivable from the logical name with any rule worth trusting. Writing
   them out means the front end never has to guess. */
async function writeEntitySets() {
  const names = TABLES.map((t) => `${PREFIX}_${t.schema}`.toLowerCase());
  const response = await get(
    `EntityDefinitions?$select=LogicalName,EntitySetName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute&$filter=startswith(LogicalName,'${PREFIX}_')`,
  );
  const rows = (response.value ?? []).filter((r) => names.includes(r.LogicalName));
  const outDir = join(HERE, 'generated');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'entity-sets.json');
  writeFileSync(outFile, JSON.stringify(rows, null, 2) + '\n');
  console.log(`\nWrote ${rows.length} entity set name(s) to ${outFile}`);
  return rows;
}

/* ── Run ─────────────────────────────────────────────────────────────── */

console.log(`Dataverse: ${API}`);
console.log(`Solution:  ${SOLUTION}${DRY ? '   (DRY RUN — nothing will be written)' : ''}\n`);

const publisherId = await ensurePublisher();
await ensureSolution(publisherId);
console.log('');

for (const table of TABLES) {
  await ensureTable(table);
}

if (!DRY) {
  console.log('\nPublishing customisations — tables are not usable by a portal until this runs…');
  await publishAll();
  await writeEntitySets();
}

console.log(`\nDone. ${created} created, ${skipped} already present.`);
if (!DRY) {
  console.log('Next: node scripts/dataverse/seed.mjs');
}
