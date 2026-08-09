/**
 * Writes `generated/records.json` — every record, already mapped to its
 * Dataverse columns.
 *
 *   node scripts/dataverse/export-records.mjs
 *
 * The PowerShell seeder reads this and does nothing but POST it. All the
 * interpretation — which fixture field becomes which column, how a date is
 * trimmed, how a list is flattened — happens once, here, using the same
 * `mappings.mjs` the Node seeder uses.
 *
 * That is the point. Reimplementing the mapping in PowerShell would mean two
 * definitions of the same thing, and the first time one gained a field the
 * other would quietly stop matching.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIX } from './schema.mjs';
import { KEY_FIELD, buildMappings } from './mappings.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'generated');

const data = JSON.parse(readFileSync(join(OUT_DIR, 'mock-data.json'), 'utf8'));
const mappings = buildMappings(data);

const tables = mappings.map((mapping) => ({
  logicalName: `${PREFIX}_${mapping.table}`,
  records: mapping.rows.map((row) => ({
    [KEY_FIELD]: String(mapping.key(row)),
    ...mapping.record(row),
  })),
}));

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, 'records.json');
writeFileSync(
  outFile,
  JSON.stringify({ keyField: KEY_FIELD, generatedOn: data.generatedOn, tables }, null, 2) + '\n',
);

const total = tables.reduce((n, t) => n + t.records.length, 0);
console.log(`Wrote ${outFile}`);
console.log(`  ${tables.length} tables, ${total} records`);
