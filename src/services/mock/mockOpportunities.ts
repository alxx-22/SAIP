/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PLACEHOLDER DATA — account opportunities
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every opportunity number, product, figure, owner and date below is invented.
 * None of these opportunities exists and none of the people are real.
 *
 * SHAPED TO MATCH THE REAL SOURCE. The `Opportunities` dataflow is a Salesforce
 * export at LINE-ITEM grain — one row per product per opportunity — so the
 * fixtures here carry `lines` and the app rolls them up. Building the mock at
 * header grain would have hidden the one thing that actually shapes the query:
 * that a single opportunity is many rows.
 *
 * `totalValue` is deliberately NOT the sum of `lines`. In the source,
 * `Total Value to HPE (converted)` is a header figure that includes elements
 * with no product line behind them, so the two genuinely differ. The fixtures
 * reproduce that gap rather than tidying it away, because a pane that assumes
 * they match would look correct here and be wrong against real data.
 *
 * Dates are RELATIVE TO TODAY so the set keeps demonstrating both open and
 * closed stages as time passes.
 *
 * See README → "Placeholder data checklist".
 */

import type { AccountOpportunity, OpportunityLine, OpportunityStage } from '../types';
import { MOCK_ACCOUNTS } from './mockData';

/** ISO date `n` days from today. Negative = past. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The upstream join key for an account, read from the account list.
 *
 * Opportunities carry `Country Sales Entity ID`, which is the same value the
 * alignments table calls `Company Group ID`. Looking it up rather than
 * retyping it means the fixtures can't drift from the accounts they claim to
 * belong to, and an unknown id fails immediately instead of rendering a pane
 * with no rows and no explanation.
 */
function groupOf(accountId: string): string {
  const account = MOCK_ACCOUNTS.find((a) => a.accountId === accountId);
  if (!account) {
    throw new Error(
      `mockOpportunities: no account '${accountId}'. Add it to MOCK_ACCOUNTS or fix the id.`,
    );
  }
  return account.companyGroupId;
}

/** Compact line builder — the fixtures below are long enough already. */
function line(
  lineId: string,
  productName: string,
  productCategory: string,
  value: number,
): OpportunityLine {
  return { lineId, productName, productCategory, value, currency: 'GBP' };
}

interface OpportunitySeed {
  accountId: string;
  opportunityNumber: string;
  name: string;
  description: string;
  stage: OpportunityStage;
  forecastCategory: string;
  /** Days from today; negative closes in the past. */
  closeIn: number;
  ownerName: string;
  campaignName: string | null;
  salesMotion: string;
  totalValue: number;
  lines: OpportunityLine[];
}

const SEEDS: OpportunitySeed[] = [
  /* ── Northwind Logistics Group ─────────────────────────────────────────── */
  {
    accountId: 'acc-001',
    opportunityNumber: 'OPE-4820371956',
    name: 'Depot network refresh — phase 2',
    description: 'Compute and storage refresh across twelve regional depots.',
    stage: 'Propose',
    forecastCategory: 'Best case',
    closeIn: 74,
    ownerName: 'Priya Raman',
    campaignName: 'FY26 Hybrid Cloud Upsell',
    salesMotion: 'Upsell',
    totalValue: 1_240_000,
    lines: [
      line('opl-0001', 'ProLiant DL380 Gen11', 'Compute', 486_000),
      line('opl-0002', 'Alletra Storage MP', 'Storage', 402_000),
      line('opl-0003', 'Tech Care — Critical', 'Operational services', 214_000),
    ],
  },
  {
    accountId: 'acc-001',
    opportunityNumber: 'OPE-4820118473',
    name: 'Fleet telemetry platform',
    description: 'Edge compute at 40 sites feeding the fleet telemetry platform.',
    stage: 'Qualify',
    forecastCategory: 'Pipeline',
    closeIn: 168,
    ownerName: 'Priya Raman',
    campaignName: null,
    salesMotion: 'New logo expansion',
    totalValue: 690_000,
    lines: [
      line('opl-0004', 'Edgeline EL8000', 'Compute', 388_000),
      line('opl-0005', 'Aruba CX 6300', 'Networking', 174_000),
    ],
  },
  {
    accountId: 'acc-001',
    opportunityNumber: 'OPE-4819902244',
    name: 'Backup modernisation',
    description: 'Replace ageing backup estate ahead of the depot refresh.',
    stage: 'Closed won',
    forecastCategory: 'Closed',
    closeIn: -38,
    ownerName: 'Tom Alderidge',
    campaignName: 'FY26 Data Protection Play',
    salesMotion: 'Upsell',
    totalValue: 415_000,
    lines: [
      line('opl-0006', 'StoreOnce 5260', 'Storage', 268_000),
      line('opl-0007', 'Zerto Backup for SaaS', 'Software', 96_000),
    ],
  },

  /* ── Meridian Health Trust ─────────────────────────────────────────────── */
  {
    accountId: 'acc-002',
    opportunityNumber: 'OPE-7140558210',
    name: 'Clinical systems resilience programme',
    description: 'Dual-site resilience for the trust’s clinical record systems.',
    stage: 'Negotiate',
    forecastCategory: 'Commit',
    closeIn: 26,
    ownerName: 'Sarah Whitfield',
    campaignName: 'FY26 Healthcare Resilience',
    salesMotion: 'Upsell',
    totalValue: 2_180_000,
    lines: [
      line('opl-0008', 'Alletra 6010', 'Storage', 742_000),
      line('opl-0009', 'ProLiant DL360 Gen11', 'Compute', 512_000),
      line('opl-0010', 'Tech Care — Critical', 'Operational services', 468_000),
      line('opl-0011', 'Complete Care onboarding', 'Professional services', 158_000),
    ],
  },
  {
    accountId: 'acc-002',
    opportunityNumber: 'OPE-7140773901',
    name: 'Imaging archive expansion',
    description: 'Capacity expansion for the regional imaging archive.',
    stage: 'Propose',
    forecastCategory: 'Best case',
    closeIn: 91,
    ownerName: 'Sarah Whitfield',
    campaignName: null,
    salesMotion: 'Upsell',
    totalValue: 880_000,
    lines: [
      line('opl-0012', 'Alletra Storage MP', 'Storage', 596_000),
      line('opl-0013', 'Tech Care — Essential', 'Operational services', 198_000),
    ],
  },
  {
    accountId: 'acc-002',
    opportunityNumber: 'OPE-7139884012',
    name: 'Network segmentation review',
    description: 'Segmentation work following the trust’s security audit.',
    stage: 'Closed lost',
    forecastCategory: 'Closed',
    closeIn: -63,
    ownerName: 'Daniel Okoye',
    campaignName: null,
    salesMotion: 'Services attach',
    totalValue: 240_000,
    lines: [line('opl-0014', 'Aruba ClearPass', 'Networking', 186_000)],
  },

  /* ── Caledonia Energy plc ──────────────────────────────────────────────── */
  {
    accountId: 'acc-003',
    opportunityNumber: 'OPE-1196044517',
    name: 'Offshore platform edge rollout',
    description: 'Ruggedised edge compute across eleven offshore platforms.',
    stage: 'Negotiate',
    forecastCategory: 'Commit',
    closeIn: 12,
    ownerName: 'Callum Reid',
    campaignName: 'FY26 Edge to Cloud',
    salesMotion: 'New workload',
    totalValue: 3_460_000,
    lines: [
      line('opl-0015', 'Edgeline EL8000', 'Compute', 1_284_000),
      line('opl-0016', 'Aruba CX 8360', 'Networking', 742_000),
      line('opl-0017', 'GreenLake for Compute Ops', 'Cloud services', 618_000),
      line('opl-0018', 'Tech Care — Critical', 'Operational services', 486_000),
    ],
  },
  {
    accountId: 'acc-003',
    opportunityNumber: 'OPE-1195338806',
    name: 'Seismic HPC cluster',
    description: 'High performance cluster for seismic interpretation workloads.',
    stage: 'Qualify',
    forecastCategory: 'Pipeline',
    closeIn: 214,
    ownerName: 'Callum Reid',
    campaignName: null,
    salesMotion: 'New workload',
    totalValue: 4_120_000,
    lines: [
      line('opl-0019', 'Cray XD2000', 'HPC & AI', 2_640_000),
      line('opl-0020', 'Slingshot interconnect', 'Networking', 806_000),
    ],
  },

  /* ── Aldergate Financial Services ──────────────────────────────────────── */
  {
    accountId: 'acc-004',
    opportunityNumber: 'OPE-6042177390',
    name: 'Regulatory data platform',
    description: 'Private cloud landing zone for regulatory reporting.',
    stage: 'Propose',
    forecastCategory: 'Best case',
    closeIn: 58,
    ownerName: 'Helena Marsh',
    campaignName: 'FY26 Private Cloud Play',
    salesMotion: 'New workload',
    totalValue: 1_960_000,
    lines: [
      line('opl-0021', 'GreenLake for Private Cloud', 'Cloud services', 1_180_000),
      line('opl-0022', 'ProLiant DL560 Gen11', 'Compute', 512_000),
    ],
  },
  {
    accountId: 'acc-004',
    opportunityNumber: 'OPE-6041880025',
    name: 'Trading floor refresh',
    description: 'Low-latency refresh for the London trading floor.',
    stage: 'Closed won',
    forecastCategory: 'Closed',
    closeIn: -21,
    ownerName: 'Helena Marsh',
    campaignName: null,
    salesMotion: 'Upsell',
    totalValue: 1_105_000,
    lines: [
      line('opl-0023', 'ProLiant DL360 Gen11', 'Compute', 688_000),
      line('opl-0024', 'Aruba CX 8325', 'Networking', 302_000),
    ],
  },

  /* ── Vantage Retail Holdings ───────────────────────────────────────────── */
  {
    accountId: 'acc-005',
    opportunityNumber: 'OPE-5530294118',
    name: 'Store estate network refresh',
    description: 'Wireless and switching refresh across 310 stores.',
    stage: 'Negotiate',
    forecastCategory: 'Commit',
    closeIn: 34,
    ownerName: 'Marcus Bell',
    campaignName: 'FY26 Retail Edge',
    salesMotion: 'Upsell',
    totalValue: 1_540_000,
    lines: [
      line('opl-0025', 'Aruba AP-635', 'Networking', 604_000),
      line('opl-0026', 'Aruba CX 6200', 'Networking', 438_000),
      line('opl-0027', 'Aruba Central subscription', 'Software', 286_000),
    ],
  },
  {
    accountId: 'acc-005',
    opportunityNumber: 'OPE-5529913077',
    name: 'Distribution centre automation',
    description: 'Compute for automated picking in two distribution centres.',
    stage: 'Qualify',
    forecastCategory: 'Pipeline',
    closeIn: 147,
    ownerName: 'Marcus Bell',
    campaignName: null,
    salesMotion: 'New workload',
    totalValue: 720_000,
    lines: [line('opl-0028', 'Edgeline EL8000', 'Compute', 512_000)],
  },

  /* ── Orbital Manufacturing Ltd ─────────────────────────────────────────── */
  {
    accountId: 'acc-006',
    opportunityNumber: 'OPE-3318407762',
    name: 'Factory floor AI inspection',
    description: 'GPU inference at the line for visual quality inspection.',
    stage: 'Propose',
    forecastCategory: 'Best case',
    closeIn: 82,
    ownerName: 'Nadia Farrell',
    campaignName: 'FY26 AI at the Edge',
    salesMotion: 'New workload',
    totalValue: 1_075_000,
    lines: [
      line('opl-0029', 'ProLiant DL380a Gen11', 'HPC & AI', 648_000),
      line('opl-0030', 'AI Essentials software', 'Software', 214_000),
    ],
  },

  /* ── Kingsway Public Sector Partnership ────────────────────────────────── */
  {
    accountId: 'acc-007',
    opportunityNumber: 'OPE-2874116508',
    name: 'Shared services consolidation',
    description: 'Consolidating four member authorities onto one platform.',
    stage: 'Qualify',
    forecastCategory: 'Pipeline',
    closeIn: 196,
    ownerName: 'Owen Pritchard',
    campaignName: 'FY26 Public Sector Consolidation',
    salesMotion: 'New workload',
    totalValue: 2_640_000,
    lines: [
      line('opl-0031', 'GreenLake for Private Cloud', 'Cloud services', 1_460_000),
      line('opl-0032', 'Complete Care transition', 'Professional services', 384_000),
    ],
  },
  {
    accountId: 'acc-007',
    opportunityNumber: 'OPE-2873880194',
    name: 'Disaster recovery uplift',
    description: 'Second-site recovery capability for statutory services.',
    stage: 'Closed won',
    forecastCategory: 'Closed',
    closeIn: -96,
    ownerName: 'Owen Pritchard',
    campaignName: null,
    salesMotion: 'Services attach',
    totalValue: 560_000,
    lines: [line('opl-0033', 'Zerto Disaster Recovery', 'Software', 412_000)],
  },

  /* ── Halcyon Media Networks ────────────────────────────────────────────── */
  {
    accountId: 'acc-008',
    opportunityNumber: 'OPE-9061330472',
    name: 'Post-production storage tier',
    description: 'High-throughput tier for 8K post-production workflows.',
    stage: 'Negotiate',
    forecastCategory: 'Commit',
    closeIn: 19,
    ownerName: 'Isla Fontaine',
    campaignName: 'FY26 Media Workflows',
    salesMotion: 'Upsell',
    totalValue: 1_320_000,
    lines: [
      line('opl-0034', 'Alletra Storage MP', 'Storage', 806_000),
      line('opl-0035', 'Tech Care — Critical', 'Operational services', 264_000),
    ],
  },
];

/**
 * The fixtures, expanded into the shape the view returns.
 *
 * Derived rather than written out so the ids, emails and account links cannot
 * disagree with the seed above — the same reason `groupOf` looks up rather
 * than retypes.
 */
export const MOCK_ACCOUNT_OPPORTUNITIES: AccountOpportunity[] = SEEDS.map((seed) => ({
  opportunityId: `sfdc-${seed.opportunityNumber.slice(4)}`,
  opportunityNumber: seed.opportunityNumber,
  name: seed.name,
  description: seed.description,
  accountId: seed.accountId,
  companyGroupId: groupOf(seed.accountId),
  stage: seed.stage,
  forecastCategory: seed.forecastCategory,
  closeDate: daysFromNow(seed.closeIn),
  ownerName: seed.ownerName,
  // Invented addresses on a domain that cannot resolve — see the header note.
  ownerEmail: `${seed.ownerName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.invalid`,
  campaignName: seed.campaignName,
  salesMotion: seed.salesMotion,
  totalValue: seed.totalValue,
  currency: 'GBP',
  lines: seed.lines,
}));
