/// <reference types="vite/client" />

/**
 * Build-time configuration.
 *
 * Declared rather than left to `vite/client`'s permissive index signature, so
 * a typo in the value is a type error at the swap point instead of a silent
 * fall through to the mock — which is exactly the failure that would be
 * mistaken for "Dataverse returned nothing".
 */
interface ImportMetaEnv {
  /** `dataverse` builds against the Power Pages Web API. Anything else = mock. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'dataverse';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
