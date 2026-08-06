/**
 * Copies the Vite build output into the Power Pages site tree.
 *
 * Run via `npm run build:powerpages`, which builds first. Node rather than a
 * shell one-liner so it behaves the same in PowerShell, cmd and bash — the
 * people deploying this are on Windows.
 *
 * WHAT THIS DELIBERATELY WILL NOT DO
 *
 * It never creates a .webfile.yml. Those files carry real Dataverse GUIDs
 * (adx_webfileid, annotationid) that identify live rows in the environment.
 * A generated-from-scratch manifest would either create a duplicate record or
 * orphan the existing one. So if a manifest is missing this script FAILS and
 * tells you to scaffold the record properly instead of guessing.
 */

import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { basename } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const webFiles = fileURLToPath(new URL('../powerpages/web-files/', import.meta.url));

/** The artifacts that have web file records backing them. */
const TRACKED = ['saip-app.mjs', 'saip-app.css'];

/** Emitted by Vite but not deployed — Power Pages supplies its own document. */
const IGNORED = ['index.html'];

function fail(message) {
  console.error(`\n  x  ${message}\n`);
  process.exit(1);
}

if (!existsSync(dist)) {
  fail('dist/ not found. Run `npm run build` first (or use `npm run build:powerpages`).');
}

// Catch code splitting before it reaches the site. Extra chunks would be silently
// missing web file records, and the app would fail to load in Power Pages with a
// 404 that looks nothing like a build problem.
const emitted = readdirSync(dist).filter((f) => statSync(dist + f).isFile());
const unexpected = emitted.filter((f) => !TRACKED.includes(f) && !IGNORED.includes(f));

if (unexpected.length > 0) {
  fail(
    `Build emitted files with no web file record:\n     ${unexpected.join('\n     ')}\n\n` +
      '     Power Pages serves only the files that have an .webfile.yml manifest,\n' +
      '     so these would 404 at runtime. This usually means code splitting got\n' +
      '     re-enabled in vite.config.ts — check rollupOptions.output.',
  );
}

let copied = 0;

for (const name of TRACKED) {
  const from = dist + name;
  const to = webFiles + name;
  const manifest = `${to}.webfile.yml`;

  if (!existsSync(from)) {
    fail(`Build did not emit ${name}. Check the entryFileNames/assetFileNames in vite.config.ts.`);
  }

  if (!existsSync(manifest)) {
    fail(
      `No web file manifest at powerpages/web-files/${basename(manifest)}.\n\n` +
        '     Do NOT hand-write one — it needs a real Dataverse GUID. Scaffold the\n' +
        '     record via the Power Pages Actions pane in VS Code, or `pac`, then\n' +
        '     re-run this script.',
    );
  }

  // Keep the manifest and the artifact honest about each other. A mismatch here
  // means the file uploads but is served from a different URL than the web
  // template asks for — a blank page with a 404 in the console.
  const yml = readFileSync(manifest, 'utf8');
  if (!yml.includes(`adx_partialurl: ${name}`) || !yml.includes(`filename: ${name}`)) {
    fail(
      `powerpages/web-files/${basename(manifest)} does not point at "${name}".\n` +
        '     Its adx_partialurl / filename must match the built file exactly.',
    );
  }

  copyFileSync(from, to);
  const kb = (statSync(to).size / 1024).toFixed(0);
  console.log(`  ok  ${name.padEnd(16)} ${kb.padStart(5)} KB  ->  powerpages/web-files/`);
  copied += 1;
}

console.log(`\n  ${copied} file(s) synced. The site tree is ready to upload:\n`);
console.log(`      pac pages upload --path ${root.replace(/\/$/, '')}/powerpages --modelVersion 2\n`);
