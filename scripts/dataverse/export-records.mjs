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

/*
  Refuse to write a file with a repeated business key.

  The seeder matches on that key and updates in place, so two records sharing
  one is not a duplicate row in Dataverse -- it is SILENT DATA LOSS. The second
  record overwrites the first and the run reports both as successes, which is
  exactly how five accounts came to share two contract numbers and four of them
  ended up with no contracts at all.

  Nothing in the output distinguished that from a clean run. This does.
*/
const collisions = tables.flatMap(({ logicalName, records }) => {
  const seen = new Map();
  for (const record of records) {
    const value = record[KEY_FIELD];
    seen.set(value, (seen.get(value) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => `  ${logicalName}: ${KEY_FIELD}="${value}" appears ${count} times`);
});

if (collisions.length > 0) {
  console.error('Duplicate business keys -- seeding this would silently lose records:');
  console.error(collisions.join('\n'));
  console.error('\nMake the keys unique in the fixtures. Composing the key instead would');
  console.error('hide the fact that two records claim the same real-world identifier.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, 'records.json');
writeFileSync(
  outFile,
  JSON.stringify({ keyField: KEY_FIELD, generatedOn: data.generatedOn, tables }, null, 2) + '\n',
);

const total = tables.reduce((n, t) => n + t.records.length, 0);
console.log(`Wrote ${outFile}`);
console.log(`  ${tables.length} tables, ${total} records`);
