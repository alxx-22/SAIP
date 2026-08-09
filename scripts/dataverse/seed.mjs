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
import { KEY_FIELD, buildMappings } from './mappings.mjs';

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

const MAPPINGS = buildMappings(data);

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
    const body = { [KEY_FIELD]: key, ...mapping.record(row) };

    if (DRY) {
      localInserted += 1;
      continue;
    }

    // Escape single quotes: an account named O'Brien would otherwise break the
    // OData filter rather than simply not matching.
    const safeKey = String(key).replace(/'/g, "''");
    const existing = await get(
      `${entitySet}?$filter=${KEY_FIELD} eq '${safeKey}'&$select=${logicalName}id`,
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
