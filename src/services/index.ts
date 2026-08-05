/**
 * Service registry — the single swap point for the data layer.
 *
 * Components import `useAccountService()` (or `accountService`) from here and
 * never reach into an implementation directly. To go live against Dataverse:
 *
 *   1. Add `src/services/dataverse/dataverseAccountService.ts` implementing
 *      the `AccountService` interface from `./types`.
 *   2. Change the one line marked SWAP POINT below.
 *
 * That is the entire integration surface. No component imports change.
 */

import { createContext, useContext } from 'react';
import type { AccountService } from './types';
import { mockAccountService } from './mock/mockAccountService';

// ─── SWAP POINT ──────────────────────────────────────────────────────────────
// PLACEHOLDER — currently bound to the mock implementation.
// Replace with `dataverseAccountService` when the Fabric-fed Dataverse tables
// are available. See README → "Going live".
export const accountService: AccountService = mockAccountService;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context lets tests and Storybook-style harnesses inject a different
 * implementation without touching the module-level binding above.
 */
export const AccountServiceContext = createContext<AccountService>(accountService);

export function useAccountService(): AccountService {
  return useContext(AccountServiceContext);
}

/** True while the app is running on invented data. Drives the sample-data UI. */
export const IS_USING_PLACEHOLDER_DATA = accountService === mockAccountService;

export * from './types';
