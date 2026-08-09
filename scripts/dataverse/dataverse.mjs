/**
 * Minimal Dataverse Web API client.
 *
 * No SDK: the metadata endpoints are plain OData, and a dependency that has to
 * be kept in step with a Power Platform release is a worse trade than sixty
 * lines of fetch.
 *
 * AUTH IS A BEARER TOKEN FROM THE ENVIRONMENT, never a stored credential. See
 * the README for the two ways to get one. Nothing here writes a token anywhere.
 */

const BASE = process.env.DATAVERSE_URL;
const TOKEN = process.env.DATAVERSE_TOKEN;

/*
  A dry run makes no requests, so it must not need credentials either —
  otherwise the one command meant for reviewing the schema before you have
  access is the one command you cannot run.
*/
const DRY = process.argv.includes('--dry-run');

if (!DRY && (!BASE || !TOKEN)) {
  console.error(
    'Set DATAVERSE_URL and DATAVERSE_TOKEN first — see scripts/dataverse/README.md\n' +
      'Or pass --dry-run to print the plan without either.',
  );
  process.exit(1);
}

/** `https://org.crm4.dynamics.com` → `https://org.crm4.dynamics.com/api/data/v9.2/` */
export const API = BASE
  ? `${BASE.replace(/\/+$/, '')}/api/data/v9.2/`
  : '(DATAVERSE_URL not set — dry run)';

/** Solution every created object is added to. Keeps them portable. */
export const SOLUTION = process.env.DATAVERSE_SOLUTION || 'SAIPDemo';

/**
 * One request, with the retry that Dataverse actually needs.
 *
 * 429 is normal under metadata churn — creating ~150 columns in a row will hit
 * it — and the service tells you how long to wait, so honour that rather than
 * guessing. 5xx gets a short backoff; everything else fails loudly, because a
 * silent retry on a 400 just repeats a bad payload.
 */
export async function call(method, path, body, extraHeaders = {}, attempt = 0) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    ...extraHeaders,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';

  const response = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 5) throw new Error(`${method} ${path} failed after retries: ${response.status}`);
    const retryAfter = Number(response.headers.get('Retry-After'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2000 * (attempt + 1);
    await new Promise((r) => setTimeout(r, waitMs));
    return call(method, path, body, extraHeaders, attempt + 1);
  }

  if (response.status === 404) return { notFound: true };

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).error?.message ?? text;
    } catch {
      /* Not JSON. The raw body is more useful than a parse error. */
    }
    throw new Error(`${method} ${path} → ${response.status}: ${message}`);
  }

  if (response.status === 204) return {};
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export const get = (path) => call('GET', path);
export const post = (path, body, headers) => call('POST', path, body, headers);
export const patch = (path, body, headers) => call('PATCH', path, body, headers);

/** Adds the created object to the solution rather than the Default Solution. */
export const solutionHeader = { 'MSCRM.SolutionUniqueName': SOLUTION };

/** An English label in the shape every metadata endpoint expects. */
export function label(text) {
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

/**
 * Publishes customisations.
 *
 * Tables created through the Web API are not usable by a portal until this
 * runs — the symptom otherwise is a table that exists in the maker portal but
 * cannot be added to a site, which reads like a permissions problem.
 */
export async function publishAll() {
  await post('PublishAllXml', {});
}
