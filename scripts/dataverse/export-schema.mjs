/**
 * Writes `generated/schema.json` from `schema.mjs`.
 *
 *   node scripts/dataverse/export-schema.mjs
 *
 * The PowerShell scripts cannot import a JavaScript module, but the table
 * definitions must not be maintained twice — a column added in one place and
 * forgotten in the other is a silent divergence nobody would notice until a
 * seed failed. So `schema.mjs` stays the single source of truth and this
 * flattens it to JSON that both toolchains can read.
 *
 * The output is the fully-built metadata payloads, not the shorthand: the
 * PowerShell side does no interpretation at all, it just POSTs what it is given.
 * That keeps the two implementations from drifting in how they read a column
 * definition, which is the subtler way this could have gone wrong.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIX, TABLES, columnBody, tableBody } from './schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The same label shape `dataverse.mjs` builds, inlined so this needs no token. */
function label(text) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
        Label: text,
        LanguageCode: 1033,
      },
    ],
  };
}

const tables = TABLES.map((table) => ({
  logicalName: `${PREFIX}_${table.schema}`.toLowerCase(),
  schemaName: `${PREFIX}_${table.schema}`,
  hasNotes: table.hasNotes === true,
  entity: tableBody(table, label),
  columns: table.columns.map((column) => ({
    logicalName: `${PREFIX}_${column.name}`.toLowerCase(),
    kind: column.kind,
    attribute: columnBody(column, label),
  })),
}));

const outDir = join(HERE, 'generated');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'schema.json');
writeFileSync(outFile, JSON.stringify({ prefix: PREFIX, tables }, null, 2) + '\n');

const columnCount = tables.reduce((n, t) => n + t.columns.length, 0);
console.log(`Wrote ${outFile}`);
console.log(`  ${tables.length} tables, ${columnCount} columns`);
