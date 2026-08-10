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
import { dataverseAccountService } from './dataverse/dataverseAccountService';

// ─── SWAP POINT ──────────────────────────────────────────────────────────────
/**
 * Which implementation the app runs on, chosen at build time.
 *
 * Set `VITE_DATA_SOURCE=dataverse` before `npm run build` to produce a bundle
 * that reads the SAIPDemo Dataverse tables through the Power Pages Web API.
 * Anything else — including not setting it — keeps the mock.
 *
 * DEFAULTS TO MOCK, AND SHOULD. The Dataverse path only works inside a Power
 * Pages site: it calls the same-origin `/_api/` proxy, which does not exist on
 * a dev server or in a plain static host. Auto-detecting the host was the
 * alternative and it is worse — a build that silently changes data source
 * depending on where it is opened is impossible to reason about when a screen
 * comes back empty.
 *
 * Both implementations are imported either way. The bundler drops the unused
 * one only when the value is statically known, which it is; keeping the import
 * unconditional means a type error in the Dataverse service fails the build
 * rather than waiting until someone flips the flag.
 */
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'mock';

export const accountService: AccountService =
  DATA_SOURCE === 'dataverse' ? dataverseAccountService : mockAccountService;
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
