/**
 * The Power Pages Web API, wrapped.
 *
 * Everything the Dataverse service does goes through here, so retries, paging,
 * the anti-forgery token and error translation exist once rather than at thirty
 * call sites.
 *
 * WHY `/_api` AND NOT THE DATAVERSE URL DIRECTLY. A browser calling
 * `https://org….crm.dynamics.com/api/data/v9.2/` needs a bearer token, and the
 * portal has no way to mint one for the signed-in visitor — that is the 401 we
 * already walked into from the address bar. Power Pages instead proxies the Web
 * API at a same-origin `/_api/` path and authenticates using the portal session
 * cookie. Same service, no token handling, and the request is subject to the
 * visitor's TABLE PERMISSIONS rather than an application identity.
 *
 * THE COROLLARY, WHICH IS THE USUAL CAUSE OF AN EMPTY SCREEN: a table is not
 * reachable here until it has been switched on in the portal. Two things are
 * needed for each one — a site setting `Webapi/<logical name>/enabled` and a
 * table permission granting the web role read (and, for the four write paths,
 * write). Without them Dataverse answers 403 or an empty collection, neither of
 * which mentions the setting. `describeFailure` below says so explicitly, so
 * the message in the console names the actual fix.
 */

import { ENTITY_SETS, KEY_FIELD, type TableName } from './entitySets';

/** Same-origin base. Power Pages serves the proxied Web API from here. */
const API_ROOT = '/_api/';

/** One OData collection response. */
interface ODataCollection<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

/** Any row: the columns vary per table and every one of them is optional. */
export type Row = Record<string, unknown>;

/* ─── Anti-forgery token ──────────────────────────────────────────────────── */

/**
 * Power Pages rejects an unsafe request without `__RequestVerificationToken`.
 *
 * Two ways to get one, because which is available depends on the portal
 * version: the `shell` helper the platform injects, and the `/_layout/tokenhtml`
 * endpoint it is built on. Trying the helper first avoids a network round trip
 * on the sites that have it.
 *
 * Cached for the page's lifetime — the token is per session, not per request,
 * and fetching one before every write would double the cost of saving a form.
 */
let cachedToken: Promise<string> | null = null;

interface PortalShell {
  getTokenDeferred?: () => PromiseLike<string>;
}

function readToken(): Promise<string> {
  const shell = (window as unknown as { shell?: PortalShell }).shell;
  if (shell?.getTokenDeferred) {
    return Promise.resolve(shell.getTokenDeferred());
  }

  return fetch('/_layout/tokenhtml', { headers: { 'Cache-Control': 'no-cache' } })
    .then((response) => response.text())
    .then((html) => {
      /*
        The endpoint returns an HTML fragment holding the token in a hidden
        input. Parsed with DOMParser rather than a regex because the value is
        base64 and HTML-attribute-escaped, and a regex over that is the kind of
        thing that works until a token happens to contain a quote.
      */
      const input = new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector<HTMLInputElement>('input[name="__RequestVerificationToken"]');
      if (!input?.value) {
        throw new Error(
          'Could not read the Power Pages anti-forgery token. Writes will fail. ' +
            'This usually means the app is running outside a Power Pages site.',
        );
      }
      return input.value;
    });
}

function requestVerificationToken(): Promise<string> {
  // Not cached on failure: a transient error should not poison every later
  // write for the rest of the session.
  if (!cachedToken) {
    cachedToken = readToken().catch((error) => {
      cachedToken = null;
      throw error;
    });
  }
  return cachedToken;
}

/* ─── Errors ──────────────────────────────────────────────────────────────── */

export class WebApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'WebApiError';
  }
}

/**
 * Turns a failed response into a message that names the fix.
 *
 * Dataverse's own message is used when there is one — its 400s are precise and
 * swallowing them in favour of "Bad Request" helps nobody. The 403 and 404
 * branches add the portal configuration context that Dataverse cannot know
 * about, because those two statuses almost always mean the table has not been
 * exposed rather than that anything is wrong with the request.
 */
async function describeFailure(response: Response, url: string): Promise<WebApiError> {
  let detail = response.statusText;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body?.error?.message) detail = body.error.message;
  } catch {
    /* A non-JSON body (an HTML sign-in page, typically) leaves statusText. */
  }

  if (response.status === 403) {
    detail +=
      ' — a 403 here is nearly always a missing table permission for the ' +
      "signed-in user's web role, not a bad request.";
  }
  if (response.status === 404) {
    detail +=
      ' — check the site setting `Webapi/<table>/enabled` is set to true and ' +
      'that the entity set name in entitySets.ts matches this environment.';
  }
  if (response.status === 401) {
    detail += ' — the portal session has expired. Signing in again should fix it.';
  }

  return new WebApiError(`${response.status} ${detail}`, response.status, url);
}

/* ─── Requests ────────────────────────────────────────────────────────────── */

const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = path.startsWith('/') ? path : API_ROOT + path;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
  };

  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    headers['__RequestVerificationToken'] = await requestVerificationToken();
    // Ask for the saved row back, so a write returns what Dataverse actually
    // stored rather than an echo of what we sent.
    if (method === 'POST' || method === 'PATCH') {
      headers.Prefer = 'return=representation';
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.ok) return response;

    if (RETRYABLE.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
      // Honour Retry-After when the service sends one; otherwise back off.
      const header = Number(response.headers.get('Retry-After'));
      const wait = Number.isFinite(header) && header > 0 ? header * 1000 : 2 ** attempt * 500;
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }

    throw await describeFailure(response, url);
  }

  throw new WebApiError('Request failed after retries.', 0, url);
}

/**
 * Reads a whole collection, following paging.
 *
 * Power Pages caps a page at 5,000 rows and hands back `@odata.nextLink` for
 * the rest. Every caller here wants the complete set, so the loop lives once
 * rather than being forgotten in the one place a table finally outgrows a page.
 */
export async function readAll<T extends Row = Row>(
  table: TableName,
  query = '',
): Promise<T[]> {
  let path = ENTITY_SETS[table].set + (query ? `?${query}` : '');
  const rows: T[] = [];

  // Bounded so a paging bug cannot spin forever against a live site.
  for (let page = 0; page < 50; page++) {
    const response = await request('GET', path);
    const body = (await response.json()) as ODataCollection<T>;
    rows.push(...body.value);

    const next = body['@odata.nextLink'];
    if (!next) return rows;
    path = next;
  }

  return rows;
}

/** Reads one row by business key, or null. */
export async function readByKey<T extends Row = Row>(
  table: TableName,
  key: string,
  select?: string,
): Promise<T | null> {
  const parts = [`$filter=${KEY_FIELD} eq '${escapeODataString(key)}'`, '$top=1'];
  if (select) parts.push(`$select=${select}`);
  const rows = await readAll<T>(table, parts.join('&'));
  return rows[0] ?? null;
}

/**
 * The Dataverse GUID for a business key.
 *
 * Cached per table for the life of the page: an id is immutable once written,
 * and saving a monitoring form otherwise costs one lookup per field.
 */
const idCache = new Map<string, string>();

export async function idForKey(table: TableName, key: string): Promise<string | null> {
  const cacheKey = `${table}:${key}`;
  const cached = idCache.get(cacheKey);
  if (cached) return cached;

  const { idField } = ENTITY_SETS[table];
  const row = await readByKey(table, key, idField);
  const id = row?.[idField];
  if (typeof id !== 'string') return null;

  idCache.set(cacheKey, id);
  return id;
}

export async function create<T extends Row = Row>(
  table: TableName,
  body: Row,
): Promise<T> {
  const response = await request('POST', ENTITY_SETS[table].set, body);
  return (await response.json()) as T;
}

export async function update<T extends Row = Row>(
  table: TableName,
  id: string,
  body: Row,
): Promise<T> {
  const response = await request('PATCH', `${ENTITY_SETS[table].set}(${id})`, body);
  return (await response.json()) as T;
}

export async function remove(table: TableName, id: string): Promise<void> {
  await request('DELETE', `${ENTITY_SETS[table].set}(${id})`);
}

/**
 * Creates or updates, matched on the business key.
 *
 * The same rule the seeder uses, for the same reason: a form saved twice must
 * update one row rather than leave two behind, and the front end knows the
 * business key long before it knows the GUID.
 */
export async function upsertByKey<T extends Row = Row>(
  table: TableName,
  key: string,
  body: Row,
): Promise<T> {
  const id = await idForKey(table, key);
  if (id) return update<T>(table, id, body);

  const created = await create<T>(table, { ...body, [KEY_FIELD]: key });
  const newId = created[ENTITY_SETS[table].idField];
  if (typeof newId === 'string') idCache.set(`${table}:${key}`, newId);
  return created;
}

/* ─── Value helpers ───────────────────────────────────────────────────────── */

/**
 * Escapes a string for an OData filter literal.
 *
 * An account called O'Brien would otherwise produce a filter that fails to
 * parse — and the resulting 400 reads like a Web API misconfiguration rather
 * than an apostrophe.
 */
export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Builds `field eq 'a' or field eq 'b'`, in chunks.
 *
 * Used to fetch child rows for many parents in one request instead of N. The
 * chunking is not optional: a URL is limited to a couple of thousand
 * characters, and a filter listing every account in a large portfolio sails
 * past that and comes back as a 414 with no useful message.
 */
export function orFilterChunks(
  field: string,
  values: string[],
  perChunk = 40,
): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < values.length; i += perChunk) {
    chunks.push(
      values
        .slice(i, i + perChunk)
        .map((value) => `${field} eq '${escapeODataString(value)}'`)
        .join(' or '),
    );
  }
  return chunks;
}

/** Text column -> string, with null and non-strings collapsed to ''. */
export function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Number column -> number, with null collapsed to 0. */
export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Boolean column -> boolean. */
export function bool(value: unknown): boolean {
  return value === true;
}

/**
 * DateOnly column -> `YYYY-MM-DD`, or null.
 *
 * Sliced rather than parsed. These columns are DateOnly precisely so a business
 * date does not move across a timezone boundary, and `new Date(...)` on the way
 * out would reintroduce exactly the shift the column type exists to prevent.
 */
export function day(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 10) return null;
  return value.slice(0, 10);
}

/** Comma-separated list column -> array, empties dropped. */
export function list(value: unknown): string[] {
  return str(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
