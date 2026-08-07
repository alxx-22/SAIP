/*==============================================================================
  SAIP — 000  Schema and conventions
  Target: SQL database in Microsoft Fabric
==============================================================================

  RUN ORDER
    000_schema_and_conventions.sql   <- you are here
    010_identity_access.sql
    020_configuration.sql
    030_account_monitoring.sql
    040_meetings.sql
    050_incentives.sql
    060_user_preferences.sql
    070_views.sql
    900_seed.sql
    990_verify.sql

  Every script is re-runnable. Objects are created only if absent, and seed
  data is MERGEd on its business key, so a partial deployment can be repeated
  without dropping anything.

  ---------------------------------------------------------------------------
  WHAT THIS DATABASE DOES AND DOES NOT OWN
  ---------------------------------------------------------------------------
  NOT OWNED, deliberately. Accounts, account alignments, service contracts and
  opportunities are mastered elsewhere and arrive in Fabric already. This
  database never creates a table for them and never holds a foreign key to one.
  Where SAIP needs to point at an account, it stores the SOURCE SYSTEM'S key in
  a column named `account_external_id` and nothing more.

  That is not laziness — a FK to a mirrored table would break the moment the
  mirror refreshed, and it would make this database undeployable on its own.
  Referential integrity across that boundary is asserted by the verification
  queries in 990, not by the engine.

  ---------------------------------------------------------------------------
  THE CONSTRAINT THAT SHAPES EVERY TABLE HERE
  ---------------------------------------------------------------------------
  These tables are surfaced to Power Pages as DATAVERSE VIRTUAL TABLES over the
  SQL Server connector. That imposes one hard rule:

      A virtual table's primary key must be a GUID or an integer.

  With anything else, reads succeed and WRITES FAIL with "No primary key exists
  in table" — which surfaces only when a user first tries to save. So every
  primary key below is `uniqueidentifier`, defaulted with NEWSEQUENTIALID() to
  keep the clustered index from fragmenting.

  Two more consequences, recorded here so they are not rediscovered:

    * A virtual table cannot sit on the 1 side of a 1:N relationship in
      Dataverse. The app therefore filters by id rather than navigating
      relationships, and these tables are designed to be queried that way.

    * The SQL connector authenticates as ONE shared identity for every portal
      user. Per-user visibility is enforced by Power Pages table permissions,
      never by this database. `created_by` columns are an audit trail, not a
      security boundary.

  ---------------------------------------------------------------------------
  WHY BUSINESS KEYS EXIST ALONGSIDE GUIDS
  ---------------------------------------------------------------------------
  Every configuration table carries BOTH a `uniqueidentifier` primary key and a
  human-readable `*_key` (e.g. 'mon-workshop', 'opt-meeting-place'). The GUID is
  what Dataverse and the joins use. The key is what the front end and the
  notification deep-links already reference, and it is stable across
  environments — which a GUID generated at deploy time is not.

  Seeding by business key is what makes dev/test/prod reproducible: the same
  MERGE produces the same logical rows with different GUIDs in each.

  ---------------------------------------------------------------------------
  FABRIC SQL SPECIFICS THAT MATTER HERE
  ---------------------------------------------------------------------------
  Fabric SQL database shares a code base with Azure SQL Database, so enforced
  PRIMARY KEY / FOREIGN KEY / UNIQUE / CHECK constraints, IDENTITY, unique
  indexes, computed columns and temporal tables all work normally. The severe
  restrictions people quote — NOT ENFORCED constraints, no IDENTITY — belong to
  Fabric DATA WAREHOUSE, which is a different item type. Do not apply them here.

  What genuinely differs, and is accounted for below:
    * Entra ID is the only identity provider. There are no SQL logins, so the
      connector's connection must use an Entra principal (ideally a service
      principal, not a person).
    * No SQL Server Agent. Anything scheduled belongs in a Data Factory pipeline.
    * No TDE or Always Encrypted; storage is encrypted with service-managed keys.
    * Every eligible table mirrors to OneLake automatically. See the note on
      temporal tables in 020 before enabling system versioning.
    * Collation is fixed at creation (default SQL_Latin1_General_CP1_CI_AS) and
      cannot be changed afterwards. Comparisons here assume case-insensitive.

==============================================================================*/

/*----------------------------------------------------------------------------
  Schema
  A dedicated schema keeps SAIP's tables separate from anything mirrored or
  staged into the same database later, and makes the Dataverse connector's
  object list readable.
----------------------------------------------------------------------------*/
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'saip')
    EXEC ('CREATE SCHEMA saip AUTHORIZATION dbo;');
GO

/*----------------------------------------------------------------------------
  Conventions applied by every later script
  ---------------------------------------------------------------------------
  Primary key      <entity>_id  uniqueidentifier  DEFAULT NEWSEQUENTIALID()
  Business key     <entity>_key nvarchar(100)     UNIQUE, immutable
  Audit            created_on / created_by / modified_on / modified_by
  Retirement       is_active bit — rows are RETIRED, not deleted, wherever
                   history references them
  Ordering         display_order int — sparse (10, 20, 30) so a row can be
                   inserted between two others without renumbering
  Text             nvarchar throughout; email sized 320 per RFC 5321
  Timestamps       datetime2(3) in UTC, defaulted with SYSUTCDATETIME()

  `modified_on` is maintained by an AFTER UPDATE trigger per table rather than
  by the application, because the application is not the only writer — the
  admin portal, a Data Factory backfill and a manual fix all need to leave the
  same trail.
----------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------
  Deployment log
  Records which scripts have run against this database, so a half-finished
  deployment can be diagnosed without guessing.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.deployment_log', 'U') IS NULL
BEGIN
    CREATE TABLE saip.deployment_log
    (
        deployment_log_id uniqueidentifier NOT NULL
            CONSTRAINT DF_deployment_log_id DEFAULT NEWSEQUENTIALID(),
        script_name       nvarchar(200)    NOT NULL,
        applied_on        datetime2(3)     NOT NULL
            CONSTRAINT DF_deployment_log_applied DEFAULT SYSUTCDATETIME(),
        applied_by        nvarchar(320)    NOT NULL
            CONSTRAINT DF_deployment_log_by DEFAULT SUSER_SNAME(),
        notes             nvarchar(1000)   NULL,
        CONSTRAINT PK_deployment_log PRIMARY KEY (deployment_log_id)
    );
END
GO

/*----------------------------------------------------------------------------
  Helper: record that a script ran. Called at the end of each file.
----------------------------------------------------------------------------*/
CREATE OR ALTER PROCEDURE saip.log_deployment
    @script_name nvarchar(200),
    @notes       nvarchar(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO saip.deployment_log (script_name, notes)
    VALUES (@script_name, @notes);
END
GO

EXEC saip.log_deployment
    @script_name = '000_schema_and_conventions.sql',
    @notes       = 'Schema, deployment log and logging procedure.';
GO
