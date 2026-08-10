/**
 * Bundles the app's mock data to `generated/mock-data.json`.
 *
 *   node scripts/dataverse/export-mock.mjs
 *
 * The fixtures live in TypeScript, use a `@/` path alias, and generate their
 * dates relative to today. Rather than re-typing any of that into a seed file —
 * where it would immediately start drifting from what the app shows — this
 * bundles the real modules with esbuild (already a Vite dependency) and runs
 * them once to capture their output.
 *
 * The dates are therefore a SNAPSHOT: the fixtures say "renewing in 90 days"
 * relative to the day this ran, and Dataverse stores the resulting date. Re-run
 * it if the demo data drifts far enough into the past to stop showing the
 * states it was designed to show.
 */

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = join(HERE, 'generated');
const OUT_FILE = join(OUT_DIR, 'mock-data.json');

const ENTRY = `
import { CAPABILITIES } from '@/services/types';
import {
  MOCK_ACCOUNTS, MOCK_ACCOUNT_SCORES, MOCK_DEFAULT_ACCOUNT_SCORES,
  MOCK_CONTRACTS, defaultContractsFor, MOCK_MONITORING, MOCK_MEETINGS,
} from '@/services/mock/mockData';
import { MOCK_ACCOUNT_OPPORTUNITIES } from '@/services/mock/mockOpportunities';
import { MOCK_INCENTIVES } from '@/services/mock/mockIncentives';
import {
  MOCK_WEB_ROLES, MOCK_PORTAL_USERS, MOCK_QUESTION_SECTIONS,
  MOCK_QUESTIONS, MOCK_OPTION_SETS,
} from '@/services/mock/mockAdmin';

/*
  Scores and contracts are keyed by account with a fallback, so they are
  flattened per account here rather than leaving the seed script to re-implement
  the same lookup the mock service does.
*/
const scores = [];
const contracts = [];
for (const account of MOCK_ACCOUNTS) {
  for (const s of (MOCK_ACCOUNT_SCORES[account.accountId] ?? MOCK_DEFAULT_ACCOUNT_SCORES)) {
    scores.push({ accountId: account.accountId, ...s });
  }
  for (const c of (MOCK_CONTRACTS[account.accountId] ?? defaultContractsFor(account.accountId))) {
    contracts.push({ accountId: account.accountId, ...c });
  }
}

/* Monitoring is a nested record per account; the table is one row per answer. */
const monitoringAnswers = [];
for (const [accountId, record] of Object.entries(MOCK_MONITORING)) {
  const pairs = {
    'mon-stakeholder-meeting': record.customerProximity.lastStakeholderMeeting,
    'mon-workshop': record.customerProximity.lastWorkshop,
    'mon-spend-review': record.customerProximity.lastSpendOrSlaReview,
    'mon-customer-visit': record.customerCentricity.lastCustomerVisit,
    'mon-performance-review': record.customerCentricity.lastPerformanceReview,
    'mon-exec-engagement': record.customerCentricity.lastExecutiveEngagement,
    'mon-sponsor-review': record.customerCentricity.lastServiceReviewWithSponsor,
  };
  for (const [questionKey, value] of Object.entries(pairs)) {
    if (!value) continue;
    monitoringAnswers.push({
      accountId, questionKey, value,
      updatedBy: record.lastUpdatedBy ?? '',
    });
  }
}

process.stdout.write(JSON.stringify({
  generatedOn: new Date().toISOString().slice(0, 10),
  capabilities: CAPABILITIES,
  roles: MOCK_WEB_ROLES,
  users: MOCK_PORTAL_USERS,
  sections: MOCK_QUESTION_SECTIONS,
  questions: MOCK_QUESTIONS,
  optionSets: MOCK_OPTION_SETS,
  accounts: MOCK_ACCOUNTS,
  scores,
  contracts,
  opportunities: MOCK_ACCOUNT_OPPORTUNITIES,
  monitoringAnswers,
  meetings: MOCK_MEETINGS,
  incentives: MOCK_INCENTIVES,
}, null, 2));
`;

mkdirSync(OUT_DIR, { recursive: true });
const bundlePath = join(OUT_DIR, '.export-entry.mjs');

await build({
  stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundlePath,
  // The same alias vite.config.ts uses. Without it the `@/` imports fail.
  alias: { '@': join(ROOT, 'src') },
  logLevel: 'warning',
});

const json = execFileSync(process.execPath, [bundlePath], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

writeFileSync(OUT_FILE, json.endsWith('\n') ? json : json + '\n');

const parsed = JSON.parse(json);
console.log(`Wrote ${OUT_FILE}`);
for (const [key, value] of Object.entries(parsed)) {
  if (Array.isArray(value)) console.log(`  ${String(value.length).padStart(4)}  ${key}`);
}
