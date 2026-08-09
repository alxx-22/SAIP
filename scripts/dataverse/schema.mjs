/**
 * The SAIP demo tables, as data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THESE ARE NATIVE TABLES, AND WHICH ONE IS PERMANENT
 *
 * The plan is that most of this eventually arrives as Dataverse VIRTUAL tables
 * over the Fabric SQL database (see sql/README.md). These native copies exist
 * because the SQL Server connector is blocked by a tenant DLP policy, and the
 * prototype cannot wait on that to have data that survives a page reload.
 *
 * So, honestly:
 *
 *   - `saip_incentivedocument` is PERMANENT. Virtual tables cannot carry notes,
 *     so the PDF attachments have to hang off a native table no matter what
 *     happens with Fabric.
 *   - Everything else is TEMPORARY. Delete these once the virtual tables land;
 *     they are unmanaged and in their own solution, so that is a clean removal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDS ARE TEXT COLUMNS, NOT LOOKUPS. Deliberately.
 *
 * A Dataverse virtual table cannot sit on the 1 side of a 1:N relationship, so
 * the real schema will never have lookups between these entities — the app
 * filters by id instead. Modelling the demo tables with lookups would make them
 * pleasant to browse and would mean rewriting every service method at the swap.
 * Text ids keep the front end byte-identical either way, which is the whole
 * point of doing this now.
 *
 * Columns mirror `src/services/types.ts` and the `sql/` build, field for field.
 */

/** Prefix for the publisher and every schema name. */
export const PREFIX = 'saip';

const S = (name, maxLength = 200) => ({ kind: 'string', name, maxLength });
const M = (name, maxLength = 4000) => ({ kind: 'memo', name, maxLength });
const I = (name) => ({ kind: 'int', name });
const D = (name, precision = 2) => ({ kind: 'decimal', name, precision });
const DATE = (name) => ({ kind: 'date', name });
const B = (name, defaultValue = false) => ({ kind: 'bool', name, defaultValue });

/**
 * Every table gets `saip_name` as its primary name column — Dataverse requires
 * one, and a consistent choice keeps the seeding code uniform. Business keys are
 * separate `*key` columns, matching the SQL build: the key is what the front end
 * references and what stays stable across environments.
 */
export const TABLES = [
  /* ── Identity and access ─────────────────────────────────────────────── */
  {
    schema: 'Capability',
    display: 'SAIP Capability',
    plural: 'SAIP Capabilities',
    description: 'One thing a role can be allowed to do.',
    columns: [S('key', 100), M('description', 1000)],
  },
  {
    schema: 'Role',
    display: 'SAIP Role',
    plural: 'SAIP Roles',
    description: 'A web role and the capabilities it grants.',
    columns: [
      S('key', 100),
      M('description', 1000),
      B('isadministrator'),
      B('issystemmanaged'),
      // Comma-separated capability keys. A junction table would be tidier, but
      // the virtual-table version cannot have one — see the note at the top.
      M('capabilitykeys', 4000),
    ],
  },
  {
    schema: 'User',
    display: 'SAIP User',
    plural: 'SAIP Users',
    description: 'A person who can sign in, and the roles they hold.',
    columns: [
      S('key', 100),
      S('email', 200),
      S('status', 50),
      DATE('lastsignin'),
      M('rolekeys', 4000),
    ],
  },

  /* ── Configuration ───────────────────────────────────────────────────── */
  {
    schema: 'QuestionSection',
    display: 'SAIP Question Section',
    plural: 'SAIP Question Sections',
    description: 'Groups questions on a form.',
    columns: [
      S('key', 100),
      M('description', 1000),
      S('area', 100),
      I('sortorder'),
      B('isenabled', true),
    ],
  },
  {
    schema: 'OptionSet',
    display: 'SAIP Dropdown',
    plural: 'SAIP Dropdowns',
    description: 'A reusable list of choices.',
    columns: [
      S('key', 100),
      M('description', 1000),
      S('usage', 400),
      // Marks a list the front end still matches by exact text.
      B('iscodedependent'),
    ],
  },
  {
    schema: 'Option',
    display: 'SAIP Dropdown Option',
    plural: 'SAIP Dropdown Options',
    description: 'One selectable value in a dropdown.',
    columns: [S('key', 100), S('optionsetkey', 100), I('sortorder'), B('isenabled', true)],
  },
  {
    schema: 'Question',
    display: 'SAIP Question',
    plural: 'SAIP Questions',
    description: 'One field the app asks for.',
    columns: [
      S('key', 100),
      S('sectionkey', 100),
      M('helptext', 1000),
      S('inputtype', 50),
      B('isrequired'),
      I('sortorder'),
      B('isenabled', true),
      S('optionsetkey', 100),
      B('nameprovisional'),
      // Things in the front end that depend on this question BY ID. Non-empty
      // means it cannot be deleted, disabled or retyped.
      M('systemreferences', 2000),
    ],
  },

  /* ── Account data (demo only — mastered upstream in production) ──────── */
  {
    schema: 'Account',
    display: 'SAIP Account',
    plural: 'SAIP Accounts',
    description: 'DEMO ONLY. Accounts are mastered upstream and arrive via Fabric.',
    columns: [
      S('key', 100),
      // The join key to everything upstream — Company Group ID on the
      // alignments table, Country Sales Entity ID on Opportunities.
      S('companygroupid', 100),
      S('industry', 200),
      S('region', 200),
      D('annualservicesrevenue'),
      S('currencycode', 10),
      I('activecontractcount'),
      DATE('lastmeetingdate'),
    ],
  },
  {
    schema: 'ServiceContract',
    display: 'SAIP Service Contract',
    plural: 'SAIP Service Contracts',
    description: 'DEMO ONLY. Contracts are mastered upstream.',
    columns: [
      S('key', 100),
      S('accountkey', 100),
      S('sla', 100),
      D('value'),
      S('currencycode', 10),
      M('cities', 2000),
      DATE('renewaldate'),
    ],
  },
  {
    schema: 'Opportunity',
    display: 'SAIP Opportunity',
    plural: 'SAIP Opportunities',
    description: 'DEMO ONLY. Opportunities come from the CRM export.',
    columns: [
      S('key', 100),
      S('opportunitynumber', 50),
      S('accountkey', 100),
      S('companygroupid', 100),
      M('description', 2000),
      S('stage', 50),
      S('forecastcategory', 50),
      DATE('closedate'),
      D('totalvalue'),
      S('currencycode', 10),
      S('ownername', 200),
      S('owneremail', 200),
      S('campaignname', 200),
      S('salesmotion', 100),
    ],
  },
  {
    schema: 'OpportunityLine',
    display: 'SAIP Opportunity Line',
    plural: 'SAIP Opportunity Lines',
    description: 'DEMO ONLY. One product line on an opportunity — the real grain.',
    columns: [
      S('key', 100),
      S('opportunitynumber', 50),
      S('productcategory', 200),
      D('value'),
      S('currencycode', 10),
    ],
  },
  {
    schema: 'Score',
    display: 'SAIP Account Score',
    plural: 'SAIP Account Scores',
    description: 'DEMO ONLY. Scores are computed in Fabric analytics.',
    columns: [
      S('key', 100),
      S('accountkey', 100),
      S('scorekey', 50),
      I('value'),
      S('status', 50),
      I('deltapoints'),
      M('explainer', 1000),
    ],
  },

  /* ── Things the app WRITES ───────────────────────────────────────────── */
  {
    schema: 'MonitoringAnswer',
    display: 'SAIP Monitoring Answer',
    plural: 'SAIP Monitoring Answers',
    description: 'One answer to one monitoring question, for one account.',
    columns: [
      S('key', 200),
      S('accountkey', 100),
      S('questionkey', 100),
      DATE('valuedate'),
      S('updatedby', 200),
    ],
  },
  {
    schema: 'Meeting',
    display: 'SAIP Meeting',
    plural: 'SAIP Meetings',
    description: 'A logged customer meeting.',
    columns: [
      S('key', 100),
      S('accountkey', 100),
      DATE('meetingdate'),
      S('place', 100),
      M('tags', 1000),
      M('subject', 1000),
      M('comments', 4000),
      S('loggedby', 200),
    ],
  },

  /* ── Incentives ──────────────────────────────────────────────────────── */
  {
    schema: 'Incentive',
    display: 'SAIP Incentive',
    plural: 'SAIP Incentives',
    description: 'A Business Development campaign.',
    columns: [
      S('key', 100),
      M('overview', 4000),
      S('campaigncode', 100),
      S('type', 100),
      DATE('startdate'),
      DATE('enddate'),
      S('createdby', 200),
      M('nominatedaccountkeys', 4000),
      M('assigneduserkeys', 4000),
      M('assignedrolekeys', 4000),
    ],
  },
  {
    schema: 'IncentiveDocument',
    display: 'SAIP Incentive Document',
    plural: 'SAIP Incentive Documents',
    description:
      'PERMANENT. Carries the PDF attachments — virtual tables cannot hold notes, so this stays native whatever happens with Fabric.',
    // The whole reason this table exists. One-way: it cannot be turned off
    // later, which is why it is set at creation rather than added after.
    hasNotes: true,
    columns: [
      S('key', 100),
      S('incentivekey', 100),
      S('mimetype', 100),
      I('sizebytes'),
      I('sortorder'),
      DATE('uploadedon'),
      S('uploadedby', 200),
    ],
  },
];

/** Builds the metadata payload for one table. */
export function tableBody(table, label) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: `${PREFIX}_${table.schema}`,
    DisplayName: label(table.display),
    DisplayCollectionName: label(table.plural),
    Description: label(table.description),
    OwnershipType: 'UserOwned',
    IsActivity: false,
    HasActivities: false,
    HasNotes: table.hasNotes === true,
    Attributes: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        SchemaName: `${PREFIX}_Name`,
        DisplayName: label('Name'),
        RequiredLevel: { Value: 'ApplicationRequired' },
        MaxLength: 400,
        FormatName: { Value: 'Text' },
        IsPrimaryName: true,
      },
    ],
  };
}

/** Builds the metadata payload for one column. */
export function columnBody(column, label) {
  const schemaName = `${PREFIX}_${column.name}`;
  const displayName = label(
    // "companygroupid" → "Companygroupid" is ugly but unambiguous; the logical
    // name is what everything actually joins on.
    column.name.charAt(0).toUpperCase() + column.name.slice(1),
  );
  const common = { SchemaName: schemaName, DisplayName: displayName, RequiredLevel: { Value: 'None' } };

  switch (column.kind) {
    case 'string':
      return {
        ...common,
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        MaxLength: column.maxLength,
        FormatName: { Value: 'Text' },
      };
    case 'memo':
      return {
        ...common,
        '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
        MaxLength: column.maxLength,
        Format: 'TextArea',
      };
    case 'int':
      return {
        ...common,
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
        MinValue: -2147483648,
        MaxValue: 2147483647,
        Format: 'None',
      };
    case 'decimal':
      return {
        ...common,
        '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
        MinValue: -100000000000,
        MaxValue: 100000000000,
        Precision: column.precision,
      };
    case 'date':
      /*
        DateOnly behaviour, not UserLocal. Every date in SAIP is a business date
        — a renewal, a close, the day a workshop happened — and UserLocal would
        shift them across a timezone boundary, so a contract renewing on the 1st
        would read as the 31st for anyone west of the person who entered it.
      */
      return {
        ...common,
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        Format: 'DateOnly',
        DateTimeBehavior: { Value: 'DateOnly' },
      };
    case 'bool':
      return {
        ...common,
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
        DefaultValue: column.defaultValue,
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
          TrueOption: { Value: 1, Label: label('Yes') },
          FalseOption: { Value: 0, Label: label('No') },
        },
      };
    default:
      throw new Error(`Unknown column kind: ${column.kind}`);
  }
}
