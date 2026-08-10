/**
 * Logical name -> entity set name, read from the environment itself.
 *
 * NOT DERIVED, AND NOT GUESSABLE. The entity set name is what goes in the Web
 * API URL, and Dataverse's pluraliser is a real pluraliser rather than "+ s":
 * `saip_capability` became `saip_capabilities` and `saip_opportunity` became
 * `saip_opportunities`. Guessing wrong gives a 404 that reads exactly like a
 * table-permission problem, which is a long afternoon.
 *
 * These values came from `scripts/dataverse/powershell/Get-EntitySets.ps1`
 * against org b9e83276. If the tables are ever recreated in another
 * environment, re-run that script and paste its output over this file rather
 * than editing by hand.
 */

export interface EntitySet {
  /** Path segment in `/_api/<entitySet>`. */
  set: string;
  /** The GUID column, needed to PATCH and DELETE a row. */
  idField: string;
}

/**
 * The business-key column present on every SAIP table.
 *
 * Every domain id the front end routes on (`acc-001`, `mon-workshop`, a
 * contract number) is stored here, NOT in the Dataverse GUID. Rows are matched
 * on it when seeding and looked up by it when writing, so the ids in the URL
 * bar stay stable and readable across a rebuild of the tables.
 */
export const KEY_FIELD = 'saip_key';

/** Dataverse's primary name column on every one of these tables. */
export const NAME_FIELD = 'saip_name';

export const ENTITY_SETS = {
  account: { set: 'saip_accounts', idField: 'saip_accountid' },
  capability: { set: 'saip_capabilities', idField: 'saip_capabilityid' },
  incentive: { set: 'saip_incentives', idField: 'saip_incentiveid' },
  incentivedocument: {
    set: 'saip_incentivedocuments',
    idField: 'saip_incentivedocumentid',
  },
  meeting: { set: 'saip_meetings', idField: 'saip_meetingid' },
  monitoringanswer: {
    set: 'saip_monitoringanswers',
    idField: 'saip_monitoringanswerid',
  },
  opportunity: { set: 'saip_opportunities', idField: 'saip_opportunityid' },
  opportunityline: {
    set: 'saip_opportunitylines',
    idField: 'saip_opportunitylineid',
  },
  option: { set: 'saip_options', idField: 'saip_optionid' },
  optionset: { set: 'saip_optionsets', idField: 'saip_optionsetid' },
  question: { set: 'saip_questions', idField: 'saip_questionid' },
  questionsection: {
    set: 'saip_questionsections',
    idField: 'saip_questionsectionid',
  },
  role: { set: 'saip_roles', idField: 'saip_roleid' },
  score: { set: 'saip_scores', idField: 'saip_scoreid' },
  servicecontract: {
    set: 'saip_servicecontracts',
    idField: 'saip_servicecontractid',
  },
  user: { set: 'saip_users', idField: 'saip_userid' },
} as const satisfies Record<string, EntitySet>;

export type TableName = keyof typeof ENTITY_SETS;
