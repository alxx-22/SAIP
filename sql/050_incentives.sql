/*==============================================================================
  SAIP — 050  Business Development: incentives
==============================================================================

  NOMINATED IS NOT ASSIGNED, and they are two tables because they answer two
  questions. A nominated ACCOUNT is a target of the campaign. An assigned PERSON
  is responsible for acting on it. A Sales Training incentive typically has no
  accounts at all and several assignees; collapsing the two would make that
  inexpressible.

  OPPORTUNITIES ARE NOT OURS. They are mastered in the CRM and arrive in Fabric
  already. This database stores the CAMPAIGN CODE and nothing else; the join to
  opportunities is a view over the mirrored table, defined in 070 and clearly
  marked as depending on an object this deployment does not create.

==============================================================================*/

/*----------------------------------------------------------------------------
  incentive
  ---------------------------------------------------------------------------
  `status` is NOT stored. Active versus historical is a question about end_date
  and today — storing it would mean something has to remember to flip it, and
  the first time that job fails the portal quietly lies. 070 exposes it as a
  computed column on the view instead.

  `end_date` NULL means open-ended, which counts as active. That is a real
  state, not missing data: an enablement track runs until someone closes it.

  `campaign_code` is nullable because an incentive without one is legitimate —
  it simply has nothing for opportunities to be raised against, and the detail
  screen says so rather than showing an empty table.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.incentive', 'U') IS NULL
BEGIN
    CREATE TABLE saip.incentive
    (
        incentive_id      uniqueidentifier NOT NULL
            CONSTRAINT DF_incentive_id DEFAULT NEWSEQUENTIALID(),
        incentive_key     nvarchar(100)    NOT NULL,
        title             nvarchar(400)    NOT NULL,
        overview          nvarchar(max)    NOT NULL
            CONSTRAINT DF_incentive_overview DEFAULT N'',
        campaign_code     nvarchar(100)    NULL,
        /* The purpose — Sales Training, Upsell, Workshop, Sales Play — as a
           lookup into the configurable dropdown rather than a string, so the
           list can be extended without a schema change. */
        type_option_id    uniqueidentifier NOT NULL,
        start_date        date             NOT NULL,
        end_date          date             NULL,
        created_by_user_id uniqueidentifier NULL,
        created_on        datetime2(3)     NOT NULL
            CONSTRAINT DF_incentive_created DEFAULT SYSUTCDATETIME(),
        modified_on       datetime2(3)     NOT NULL
            CONSTRAINT DF_incentive_modified DEFAULT SYSUTCDATETIME(),
        modified_by       nvarchar(320)    NULL,
        CONSTRAINT PK_incentive PRIMARY KEY (incentive_id),
        CONSTRAINT UQ_incentive_key UNIQUE (incentive_key),
        CONSTRAINT FK_incentive_type FOREIGN KEY (type_option_id)
            REFERENCES saip.[option] (option_id),
        CONSTRAINT FK_incentive_creator FOREIGN KEY (created_by_user_id)
            REFERENCES saip.[user] (user_id),
        /* An incentive that ends before it starts is historical the moment it
           is saved. The create form blocks it; so does this. */
        CONSTRAINT CK_incentive_dates CHECK (end_date IS NULL OR end_date >= start_date)
    );

    /* A campaign code identifies one campaign. Filtered so the many rows
       legitimately without one do not collide. */
    CREATE UNIQUE INDEX UX_incentive_campaign_code
        ON saip.incentive (campaign_code)
        WHERE campaign_code IS NOT NULL;

    /* The list screen splits on end_date, so index it. */
    CREATE INDEX IX_incentive_end_date ON saip.incentive (end_date)
        INCLUDE (title, start_date, type_option_id);
END
GO

/*----------------------------------------------------------------------------
  incentive_account — nominated accounts (campaign TARGETS)
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.incentive_account', 'U') IS NULL
BEGIN
    CREATE TABLE saip.incentive_account
    (
        incentive_account_id uniqueidentifier NOT NULL
            CONSTRAINT DF_inc_acct_id DEFAULT NEWSEQUENTIALID(),
        incentive_id         uniqueidentifier NOT NULL,
        account_external_id  nvarchar(100)    NOT NULL,
        nominated_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_inc_acct_nominated DEFAULT SYSUTCDATETIME(),
        nominated_by         nvarchar(320)    NULL,
        CONSTRAINT PK_incentive_account PRIMARY KEY (incentive_account_id),
        CONSTRAINT UQ_incentive_account UNIQUE (incentive_id, account_external_id),
        CONSTRAINT FK_incentive_account_incentive FOREIGN KEY (incentive_id)
            REFERENCES saip.incentive (incentive_id) ON DELETE CASCADE
    );

    /* "Which incentives target this account" — the Account Focus tab's read. */
    CREATE INDEX IX_incentive_account_account
        ON saip.incentive_account (account_external_id)
        INCLUDE (incentive_id);
END
GO

/*----------------------------------------------------------------------------
  incentive_user / incentive_role — assignment (who is RESPONSIBLE)
  ---------------------------------------------------------------------------
  Two tables rather than one polymorphic "assignee" table with a type column.
  Polymorphic keys cannot carry a foreign key, and these two both can — which
  is what stops an assignment surviving the deletion of the role it points at.

  Assigning by ROLE is the more useful of the two: anyone joining the role picks
  the incentive up without a list being edited. Assigning by name is for the
  exceptions.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.incentive_user', 'U') IS NULL
BEGIN
    CREATE TABLE saip.incentive_user
    (
        incentive_user_id uniqueidentifier NOT NULL
            CONSTRAINT DF_inc_user_id DEFAULT NEWSEQUENTIALID(),
        incentive_id      uniqueidentifier NOT NULL,
        user_id           uniqueidentifier NOT NULL,
        assigned_on       datetime2(3)     NOT NULL
            CONSTRAINT DF_inc_user_assigned DEFAULT SYSUTCDATETIME(),
        assigned_by       nvarchar(320)    NULL,
        CONSTRAINT PK_incentive_user PRIMARY KEY (incentive_user_id),
        CONSTRAINT UQ_incentive_user UNIQUE (incentive_id, user_id),
        CONSTRAINT FK_incentive_user_incentive FOREIGN KEY (incentive_id)
            REFERENCES saip.incentive (incentive_id) ON DELETE CASCADE,
        CONSTRAINT FK_incentive_user_user FOREIGN KEY (user_id)
            REFERENCES saip.[user] (user_id) ON DELETE CASCADE
    );

    /* "What is assigned to me" — the My Incentives read. */
    CREATE INDEX IX_incentive_user_user ON saip.incentive_user (user_id, incentive_id);
END
GO

IF OBJECT_ID('saip.incentive_role', 'U') IS NULL
BEGIN
    CREATE TABLE saip.incentive_role
    (
        incentive_role_id uniqueidentifier NOT NULL
            CONSTRAINT DF_inc_role_id DEFAULT NEWSEQUENTIALID(),
        incentive_id      uniqueidentifier NOT NULL,
        role_id           uniqueidentifier NOT NULL,
        assigned_on       datetime2(3)     NOT NULL
            CONSTRAINT DF_inc_role_assigned DEFAULT SYSUTCDATETIME(),
        assigned_by       nvarchar(320)    NULL,
        CONSTRAINT PK_incentive_role PRIMARY KEY (incentive_role_id),
        CONSTRAINT UQ_incentive_role UNIQUE (incentive_id, role_id),
        CONSTRAINT FK_incentive_role_incentive FOREIGN KEY (incentive_id)
            REFERENCES saip.incentive (incentive_id) ON DELETE CASCADE,
        /* NO ACTION: a role with incentives assigned to it must not be
           deletable out from under them. The admin portal blocks it and the
           database agrees. */
        CONSTRAINT FK_incentive_role_role FOREIGN KEY (role_id)
            REFERENCES saip.[role] (role_id)
    );

    CREATE INDEX IX_incentive_role_role ON saip.incentive_role (role_id, incentive_id);
END
GO

/*----------------------------------------------------------------------------
  incentive_resource — supporting documents
  ---------------------------------------------------------------------------
  METADATA ONLY. The bytes live in SharePoint or as a Dataverse annotation;
  putting multi-megabyte PDFs in this database would bloat every mirror to
  OneLake for no analytical benefit.

  `storage_url` NULL means "no file behind this yet", which is exactly what the
  prototype shows today — the View and Download actions are disabled and say so
  rather than pretending.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.incentive_resource', 'U') IS NULL
BEGIN
    CREATE TABLE saip.incentive_resource
    (
        resource_id       uniqueidentifier NOT NULL
            CONSTRAINT DF_resource_id DEFAULT NEWSEQUENTIALID(),
        incentive_id      uniqueidentifier NOT NULL,
        file_name         nvarchar(400)    NOT NULL,
        mime_type         nvarchar(100)    NOT NULL
            CONSTRAINT DF_resource_mime DEFAULT N'application/pdf',
        size_bytes        bigint           NULL,
        storage_url       nvarchar(1000)   NULL,
        /* The Dataverse annotation holding the bytes, when that is the store. */
        annotation_id     uniqueidentifier NULL,
        uploaded_by_user_id uniqueidentifier NULL,
        uploaded_on       datetime2(3)     NOT NULL
            CONSTRAINT DF_resource_uploaded DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_incentive_resource PRIMARY KEY (resource_id),
        CONSTRAINT FK_resource_incentive FOREIGN KEY (incentive_id)
            REFERENCES saip.incentive (incentive_id) ON DELETE CASCADE,
        CONSTRAINT FK_resource_user FOREIGN KEY (uploaded_by_user_id)
            REFERENCES saip.[user] (user_id)
    );

    CREATE INDEX IX_resource_incentive ON saip.incentive_resource (incentive_id);
END
GO

CREATE OR ALTER TRIGGER saip.TR_incentive_modified ON saip.incentive AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(modified_on)
        UPDATE i SET modified_on = SYSUTCDATETIME()
        FROM saip.incentive i INNER JOIN inserted ins ON i.incentive_id = ins.incentive_id;
END
GO

EXEC saip.log_deployment
    @script_name = '050_incentives.sql',
    @notes       = 'incentive, incentive_account, incentive_user, incentive_role, incentive_resource.';
GO
