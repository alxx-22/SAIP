/**
 * Derived business rules.
 *
 * These thresholds are UI rules, not data — they live here rather than in the
 * mock data so they survive the swap to Dataverse untouched, and so there is
 * exactly one definition of "renewing soon" and "overdue" in the codebase.
 *
 * ASSUMPTION: the 90-day renewal window and 12-month workshop cadence come
 * from the build brief's worked examples. Confirm both with the account team
 * before release — see README placeholder checklist.
 */

import type {
  IncentiveOpportunity,
  IncentiveStatus,
  IsoDate,
  ServiceContract,
} from './types';

/** A contract renewing within this many days gets the "renewing soon" flag. */
export const RENEWAL_SOON_DAYS = 90;

/** A monitoring field older than this many months is flagged overdue. */
export const MONITORING_OVERDUE_MONTHS = 12;

const MS_PER_DAY = 86_400_000;

/** Whole days from today until `date`. Negative when the date has passed. */
export function daysUntil(date: IsoDate): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** Whole days since `date`. Negative when the date is in the future. */
export function daysSince(date: IsoDate): number {
  return -daysUntil(date);
}

/** Approximate whole months since `date`. */
export function monthsSince(date: IsoDate): number {
  const now = new Date();
  const then = new Date(`${date}T00:00:00`);
  return (
    (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth())
  );
}

/** True when a contract renews inside the "renewing soon" window. */
export function isRenewingSoon(contract: ServiceContract): boolean {
  const days = daysUntil(contract.renewalDate);
  return days >= 0 && days <= RENEWAL_SOON_DAYS;
}

/** True when a contract's renewal date has already passed. */
export function isExpired(contract: ServiceContract): boolean {
  return daysUntil(contract.renewalDate) < 0;
}

/**
 * Ribbon C derived flag: "workshop held in the last 12 months?".
 * A null date counts as *not* held — never as "unknown, assume fine".
 */
export function heldWithinLastYear(date: IsoDate | null): boolean {
  if (!date) return false;
  return monthsSince(date) < MONITORING_OVERDUE_MONTHS;
}

/**
 * True when a monitoring date is missing or older than the overdue threshold.
 * Drives the soft persistent flag on Account Monitoring fields.
 *
 * `months` defaults to the agreed business rule and should be left alone for
 * anything shown on the Account Monitoring ribbon — that flag is a fact about
 * the account, not a personal view of it. It is overridable only so a user can
 * tighten or relax their own NOTIFICATION threshold in Profile & settings.
 */
export function isOverdue(
  date: IsoDate | null,
  months: number = MONITORING_OVERDUE_MONTHS,
): boolean {
  if (!date) return true;
  return monthsSince(date) >= months;
}

/**
 * Whether an incentive is still running.
 *
 * Derived rather than stored, for the same reason notifications are: an
 * incentive is historical because its end date has passed, not because someone
 * remembered to change a field. A null `endDate` is open-ended and stays active.
 */
export function incentiveStatus(endDate: IsoDate | null): IncentiveStatus {
  if (!endDate) return 'active';
  return daysUntil(endDate) >= 0 ? 'active' : 'historical';
}

/**
 * Total value of an incentive's opportunities, excluding lost ones.
 *
 * Closed-lost is deliberately excluded: including it would inflate the headline
 * figure with revenue nobody is going to book. Closed-won IS included, because
 * the number is "what this incentive produced", not "what is still open".
 */
export function incentivePipelineValue(opportunities: IncentiveOpportunity[]): number {
  return opportunities
    .filter((o) => o.stage !== 'Closed lost')
    .reduce((total, o) => total + o.value, 0);
}

/** Currency, no decimals — these are six- and seven-figure commercial values. */
export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact currency for tight metric tiles, e.g. "£18.4M". */
export function formatCurrencyCompact(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Human date, e.g. "5 Aug 2026". Returns an em dash for null. */
export function formatDate(date: IsoDate | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

/** Relative phrasing for supporting text, e.g. "7 months ago". */
export function formatRelative(date: IsoDate | null): string {
  if (!date) return 'Never recorded';
  const days = daysSince(date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = monthsSince(date);
  if (months < 1) return 'This month';
  if (months === 1) return '1 month ago';
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

/** Today as an ISO date, for date-input maximums. */
export function todayIso(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}
