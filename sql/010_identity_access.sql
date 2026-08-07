/*==============================================================================
  SAIP — 010  Identity and access
==============================================================================

  Users, roles, and what a role is allowed to reach.

  WHAT THIS IS AND IS NOT
  This is SAIP's view of access, not the security boundary. Power Pages web
  roles and Dataverse table permissions are what actually gate anything; these
  tables let the admin portal manage the intent behind that configuration in one
  place, and give the app something to read when deciding what to render.

  `saip_user` is NOT the identity provider either. Entra owns the account; this
  row exists so meetings, incentives and monitoring edits have something stable
  to reference, and so a leaver can be deactivated without deleting the history
  that names them.

==============================================================================*/

/*----------------------------------------------------------------------------
  capability — the closed catalogue of things a role can reach
  ---------------------------------------------------------------------------
  A TABLE, not a CHECK constraint on a string, so the admin portal can list
  capabilities with their descriptions and so adding one is a data change.

  It stays closed in practice because rows are only ever inserted by a
  deployment script: a capability means nothing unless the front end has a
  surface to protect, so inventing one at runtime would describe access that
  does not exist.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.capability', 'U') IS NULL
BEGIN
    CREATE TABLE saip.capability
    (
        capability_id   uniqueidentifier NOT NULL
            CONSTRAINT DF_capability_id DEFAULT NEWSEQUENTIALID(),
        capability_key  nvarchar(100)    NOT NULL,  -- 'accounts.edit'
        label           nvarchar(200)    NOT NULL,
        description     nvarchar(500)    NOT NULL
            CONSTRAINT DF_capability_desc DEFAULT N'',
        display_order   int              NOT NULL
            CONSTRAINT DF_capability_order DEFAULT 100,
        created_on      datetime2(3)     NOT NULL
            CONSTRAINT DF_capability_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_capability PRIMARY KEY (capability_id),
        CONSTRAINT UQ_capability_key UNIQUE (capability_key)
    );
END
GO

/*----------------------------------------------------------------------------
  role
  ---------------------------------------------------------------------------
  `is_administrator` is kept as its own column rather than being inferred from
  holding the 'admin.access' capability. The Users table surfaces it directly as
  a tickbox, and the two are allowed to diverge in exactly one direction: a role
  may hold admin.access without being THE administrator role. Deriving it would
  make that impossible to express.

  `is_system_managed` marks roles Power Pages creates and maintains itself
  (Authenticated Users, Anonymous Users). They are listed so an administrator
  can see what is being assigned, and blocked from edit or delete.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.role', 'U') IS NULL
BEGIN
    CREATE TABLE saip.[role]
    (
        role_id           uniqueidentifier NOT NULL
            CONSTRAINT DF_role_id DEFAULT NEWSEQUENTIALID(),
        role_key          nvarchar(100)    NOT NULL,  -- 'role-account-manager'
        name              nvarchar(200)    NOT NULL,
        description       nvarchar(1000)   NOT NULL
            CONSTRAINT DF_role_desc DEFAULT N'',
        is_administrator  bit              NOT NULL
            CONSTRAINT DF_role_is_admin DEFAULT 0,
        is_system_managed bit              NOT NULL
            CONSTRAINT DF_role_is_system DEFAULT 0,
        /* Mirrors the adx_webrole row this maps to, once the Power Pages side
           exists. Null until then; populated by the portal configuration step
           rather than by this script, because the GUID is minted by Dataverse. */
        webrole_id        uniqueidentifier NULL,
        is_active         bit              NOT NULL
            CONSTRAINT DF_role_active DEFAULT 1,
        created_on        datetime2(3)     NOT NULL
            CONSTRAINT DF_role_created DEFAULT SYSUTCDATETIME(),
        created_by        nvarchar(320)    NULL,
        modified_on       datetime2(3)     NOT NULL
            CONSTRAINT DF_role_modified DEFAULT SYSUTCDATETIME(),
        modified_by       nvarchar(320)    NULL,
        CONSTRAINT PK_role PRIMARY KEY (role_id),
        CONSTRAINT UQ_role_key UNIQUE (role_key)
    );

    /* At most one administrator role. A filtered unique index states the rule
       the admin portal enforces, so a second one cannot be created by a script
       or a direct write that bypasses the UI. */
    CREATE UNIQUE INDEX UX_role_single_administrator
        ON saip.[role] (is_administrator)
        WHERE is_administrator = 1;
END
GO

/*----------------------------------------------------------------------------
  role_capability — what each role can reach
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.role_capability', 'U') IS NULL
BEGIN
    CREATE TABLE saip.role_capability
    (
        role_capability_id uniqueidentifier NOT NULL
            CONSTRAINT DF_role_capability_id DEFAULT NEWSEQUENTIALID(),
        role_id            uniqueidentifier NOT NULL,
        capability_id      uniqueidentifier NOT NULL,
        granted_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_role_capability_granted DEFAULT SYSUTCDATETIME(),
        granted_by         nvarchar(320)    NULL,
        CONSTRAINT PK_role_capability PRIMARY KEY (role_capability_id),
        CONSTRAINT UQ_role_capability UNIQUE (role_id, capability_id),
        CONSTRAINT FK_role_capability_role FOREIGN KEY (role_id)
            REFERENCES saip.[role] (role_id) ON DELETE CASCADE,
        CONSTRAINT FK_role_capability_capability FOREIGN KEY (capability_id)
            REFERENCES saip.capability (capability_id)
    );

    CREATE INDEX IX_role_capability_role ON saip.role_capability (role_id);
END
GO

/*----------------------------------------------------------------------------
  user
  ---------------------------------------------------------------------------
  `entra_object_id` is the join to the real identity and is the column the
  Power Pages contact should be matched on. Email is shown to humans and can
  change; the object id cannot.

  `last_active_on` is a WRITE-ON-SIGN-IN column, not derived. Deriving "last
  active" from the latest meeting or monitoring edit would report a rep who
  reads the portal daily but edits nothing as inactive.

  Users are RETIRED (`is_active = 0`), never deleted — meetings, incentives and
  monitoring edits all name their author, and deleting the row would strand
  that history. The FKs below are deliberately NO ACTION for the same reason.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.user', 'U') IS NULL
BEGIN
    CREATE TABLE saip.[user]
    (
        user_id         uniqueidentifier NOT NULL
            CONSTRAINT DF_user_id DEFAULT NEWSEQUENTIALID(),
        user_key        nvarchar(100)    NOT NULL,  -- stable app-facing id
        entra_object_id uniqueidentifier NULL,      -- the real identity
        display_name    nvarchar(200)    NOT NULL,
        email           nvarchar(320)    NOT NULL,
        /* The Dataverse contact this user maps to. Null until the portal side
           is configured; the app can run on email matching in the meantime. */
        contact_id      uniqueidentifier NULL,
        last_active_on  datetime2(3)     NULL,
        is_active       bit              NOT NULL
            CONSTRAINT DF_user_active DEFAULT 1,
        created_on      datetime2(3)     NOT NULL
            CONSTRAINT DF_user_created DEFAULT SYSUTCDATETIME(),
        created_by      nvarchar(320)    NULL,
        modified_on     datetime2(3)     NOT NULL
            CONSTRAINT DF_user_modified DEFAULT SYSUTCDATETIME(),
        modified_by     nvarchar(320)    NULL,
        CONSTRAINT PK_user PRIMARY KEY (user_id),
        CONSTRAINT UQ_user_key UNIQUE (user_key),
        CONSTRAINT UQ_user_email UNIQUE (email)
    );

    /* Null-tolerant uniqueness: many rows may have no Entra id yet during
       onboarding, but no two may share one. */
    CREATE UNIQUE INDEX UX_user_entra_object
        ON saip.[user] (entra_object_id)
        WHERE entra_object_id IS NOT NULL;

    CREATE INDEX IX_user_active ON saip.[user] (is_active) INCLUDE (display_name, email);
END
GO

/*----------------------------------------------------------------------------
  user_role
  ---------------------------------------------------------------------------
  A SET, even though the Users table presents it as one job role plus an admin
  tickbox. That presentation is a UI decision; the store stays a set so a role
  can be granted outside those two controls without a schema change.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.user_role', 'U') IS NULL
BEGIN
    CREATE TABLE saip.user_role
    (
        user_role_id uniqueidentifier NOT NULL
            CONSTRAINT DF_user_role_id DEFAULT NEWSEQUENTIALID(),
        user_id      uniqueidentifier NOT NULL,
        role_id      uniqueidentifier NOT NULL,
        assigned_on  datetime2(3)     NOT NULL
            CONSTRAINT DF_user_role_assigned DEFAULT SYSUTCDATETIME(),
        assigned_by  nvarchar(320)    NULL,
        CONSTRAINT PK_user_role PRIMARY KEY (user_role_id),
        CONSTRAINT UQ_user_role UNIQUE (user_id, role_id),
        CONSTRAINT FK_user_role_user FOREIGN KEY (user_id)
            REFERENCES saip.[user] (user_id) ON DELETE CASCADE,
        /* NO ACTION on purpose: a role still held by anyone must not be
           deletable. The admin portal blocks it, and this makes the database
           agree rather than silently cascading the grant away. */
        CONSTRAINT FK_user_role_role FOREIGN KEY (role_id)
            REFERENCES saip.[role] (role_id)
    );

    CREATE INDEX IX_user_role_role ON saip.user_role (role_id);
END
GO

/*----------------------------------------------------------------------------
  modified_on maintenance
  ---------------------------------------------------------------------------
  A trigger rather than an application concern, because the application is not
  the only writer — the admin portal, a backfill pipeline and a manual fix all
  need to leave the same trail.
----------------------------------------------------------------------------*/
CREATE OR ALTER TRIGGER saip.TR_role_modified ON saip.[role] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(modified_on)
        UPDATE r SET modified_on = SYSUTCDATETIME()
        FROM saip.[role] r INNER JOIN inserted i ON r.role_id = i.role_id;
END
GO

CREATE OR ALTER TRIGGER saip.TR_user_modified ON saip.[user] AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(modified_on)
        UPDATE u SET modified_on = SYSUTCDATETIME()
        FROM saip.[user] u INNER JOIN inserted i ON u.user_id = i.user_id;
END
GO

EXEC saip.log_deployment
    @script_name = '010_identity_access.sql',
    @notes       = 'capability, role, role_capability, user, user_role.';
GO
