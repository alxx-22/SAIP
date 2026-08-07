/*==============================================================================
  SAIP — 020  Configuration held as data
==============================================================================

  The questions the app asks, the dropdowns those questions choose from, and
  the sections that group them. These are the tables that let a question be
  renamed or a meeting tag added without a code change and a deploy.

  THE KEY COLUMNS ARE THE CONTRACT
  `section_key`, `question_key` and `option_set_key` carry the exact strings the
  front end already uses — 'sec-proximity', 'mon-workshop', 'opt-meeting-place'.
  The notification deep-links target them, stored answers join on them, and the
  DOM ids in the Account Monitoring ribbon match them character for character.

  They are therefore IMMUTABLE. Renaming one detaches every answer from the
  question it answers. The admin portal shows them read-only and lets the LABEL
  change instead, which is what anyone actually means by "rename".

==============================================================================*/

/*----------------------------------------------------------------------------
  question_section
  ---------------------------------------------------------------------------
  `area` says which screen the section renders on. Constrained rather than free
  text: a section pointing at an area the app cannot render is invisible, and
  invisible-but-saved is the worst failure mode for configuration.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.question_section', 'U') IS NULL
BEGIN
    CREATE TABLE saip.question_section
    (
        section_id    uniqueidentifier NOT NULL
            CONSTRAINT DF_section_id DEFAULT NEWSEQUENTIALID(),
        section_key   nvarchar(100)    NOT NULL,  -- 'sec-proximity'
        title         nvarchar(200)    NOT NULL,
        description   nvarchar(1000)   NOT NULL
            CONSTRAINT DF_section_desc DEFAULT N'',
        area          nvarchar(50)     NOT NULL,
        display_order int              NOT NULL
            CONSTRAINT DF_section_order DEFAULT 100,
        is_enabled    bit              NOT NULL
            CONSTRAINT DF_section_enabled DEFAULT 1,
        created_on    datetime2(3)     NOT NULL
            CONSTRAINT DF_section_created DEFAULT SYSUTCDATETIME(),
        created_by    nvarchar(320)    NULL,
        modified_on   datetime2(3)     NOT NULL
            CONSTRAINT DF_section_modified DEFAULT SYSUTCDATETIME(),
        modified_by   nvarchar(320)    NULL,
        CONSTRAINT PK_question_section PRIMARY KEY (section_id),
        CONSTRAINT UQ_question_section_key UNIQUE (section_key),
        CONSTRAINT CK_question_section_area
            CHECK (area IN ('account-monitoring', 'meeting-log'))
    );
END
GO

/*----------------------------------------------------------------------------
  option_set — a reusable dropdown
  ---------------------------------------------------------------------------
  `is_code_dependent` marks a list the FRONT END still matches by exact text —
  meeting tag colours, SLA tier treatment, opportunity stage styling. Renaming
  an option on one of those does not fail loudly, it silently stops matching,
  which is precisely the change an administrator would assume is safe.

  It is a column rather than a hardcoded list in the UI so the flag can be
  cleared per list, one at a time, as each consumer is wired to read from here.
  That makes it the migration checklist for the front-end work that follows.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.option_set', 'U') IS NULL
BEGIN
    CREATE TABLE saip.option_set
    (
        option_set_id     uniqueidentifier NOT NULL
            CONSTRAINT DF_option_set_id DEFAULT NEWSEQUENTIALID(),
        option_set_key    nvarchar(100)    NOT NULL,  -- 'opt-meeting-place'
        name              nvarchar(200)    NOT NULL,
        description       nvarchar(1000)   NOT NULL
            CONSTRAINT DF_option_set_desc DEFAULT N'',
        usage_note        nvarchar(500)    NOT NULL
            CONSTRAINT DF_option_set_usage DEFAULT N'',
        is_code_dependent bit              NOT NULL
            CONSTRAINT DF_option_set_code_dep DEFAULT 0,
        created_on        datetime2(3)     NOT NULL
            CONSTRAINT DF_option_set_created DEFAULT SYSUTCDATETIME(),
        created_by        nvarchar(320)    NULL,
        modified_on       datetime2(3)     NOT NULL
            CONSTRAINT DF_option_set_modified DEFAULT SYSUTCDATETIME(),
        modified_by       nvarchar(320)    NULL,
        CONSTRAINT PK_option_set PRIMARY KEY (option_set_id),
        CONSTRAINT UQ_option_set_key UNIQUE (option_set_key)
    );
END
GO

/*----------------------------------------------------------------------------
  option — one selectable value
  ---------------------------------------------------------------------------
  `is_enabled` is how an option is retired. Deleting "Workshop" would leave
  every meeting tagged with it pointing at nothing; unticking removes it from
  the picker and keeps history readable. The app offers delete only for options
  nothing can have used yet.

  `label` is unique per set, case-insensitively — two options a user cannot tell
  apart are a data-entry trap, and the default collation is CI so the constraint
  matches how they will look on screen.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.option', 'U') IS NULL
BEGIN
    CREATE TABLE saip.[option]
    (
        option_id     uniqueidentifier NOT NULL
            CONSTRAINT DF_option_id DEFAULT NEWSEQUENTIALID(),
        option_set_id uniqueidentifier NOT NULL,
        option_key    nvarchar(100)    NOT NULL,  -- 'mp-1'
        label         nvarchar(200)    NOT NULL,
        display_order int              NOT NULL
            CONSTRAINT DF_option_order DEFAULT 100,
        is_enabled    bit              NOT NULL
            CONSTRAINT DF_option_enabled DEFAULT 1,
        created_on    datetime2(3)     NOT NULL
            CONSTRAINT DF_option_created DEFAULT SYSUTCDATETIME(),
        modified_on   datetime2(3)     NOT NULL
            CONSTRAINT DF_option_modified DEFAULT SYSUTCDATETIME(),
        modified_by   nvarchar(320)    NULL,
        CONSTRAINT PK_option PRIMARY KEY (option_id),
        CONSTRAINT UQ_option_key UNIQUE (option_key),
        CONSTRAINT UQ_option_label_per_set UNIQUE (option_set_id, label),
        CONSTRAINT FK_option_set FOREIGN KEY (option_set_id)
            REFERENCES saip.option_set (option_set_id) ON DELETE CASCADE
    );

    CREATE INDEX IX_option_set_order
        ON saip.[option] (option_set_id, display_order)
        INCLUDE (label, is_enabled);
END
GO

/*----------------------------------------------------------------------------
  question
  ---------------------------------------------------------------------------
  `input_type` decides which control renders AND which value column an answer
  lands in (see 030). The CHECK keeps the two in step: an unrecognised type
  would render nothing and store nowhere.

  `option_set_id` is required for choice types and must be null otherwise. The
  CHECK states that pairing rather than leaving a dangling reference behind when
  a question is switched away from being a dropdown.

  `is_name_provisional` carries the "Field name TBC" marker from the brief into
  the data, so the caveat travels with the record instead of living in a comment
  the account team never sees.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.question', 'U') IS NULL
BEGIN
    CREATE TABLE saip.question
    (
        question_id         uniqueidentifier NOT NULL
            CONSTRAINT DF_question_id DEFAULT NEWSEQUENTIALID(),
        question_key        nvarchar(100)    NOT NULL,  -- 'mon-workshop'
        section_id          uniqueidentifier NOT NULL,
        label               nvarchar(400)    NOT NULL,
        help_text           nvarchar(1000)   NOT NULL
            CONSTRAINT DF_question_help DEFAULT N'',
        input_type          nvarchar(30)     NOT NULL,
        is_required         bit              NOT NULL
            CONSTRAINT DF_question_required DEFAULT 0,
        display_order       int              NOT NULL
            CONSTRAINT DF_question_order DEFAULT 100,
        is_enabled          bit              NOT NULL
            CONSTRAINT DF_question_enabled DEFAULT 1,
        option_set_id       uniqueidentifier NULL,
        is_name_provisional bit              NOT NULL
            CONSTRAINT DF_question_provisional DEFAULT 0,
        created_on          datetime2(3)     NOT NULL
            CONSTRAINT DF_question_created DEFAULT SYSUTCDATETIME(),
        created_by          nvarchar(320)    NULL,
        modified_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_question_modified DEFAULT SYSUTCDATETIME(),
        modified_by         nvarchar(320)    NULL,
        CONSTRAINT PK_question PRIMARY KEY (question_id),
        CONSTRAINT UQ_question_key UNIQUE (question_key),
        CONSTRAINT UQ_question_label_per_section UNIQUE (section_id, label),
        CONSTRAINT FK_question_section FOREIGN KEY (section_id)
            REFERENCES saip.question_section (section_id),
        CONSTRAINT FK_question_option_set FOREIGN KEY (option_set_id)
            REFERENCES saip.option_set (option_set_id),
        CONSTRAINT CK_question_input_type CHECK (input_type IN
            ('date', 'text', 'longtext', 'number', 'boolean', 'choice', 'multichoice')),
        CONSTRAINT CK_question_option_set_pairing CHECK
        (
            (input_type IN ('choice', 'multichoice') AND option_set_id IS NOT NULL)
         OR (input_type NOT IN ('choice', 'multichoice') AND option_set_id IS NULL)
        )
    );

    CREATE INDEX IX_question_section_order
        ON saip.question (section_id, display_order)
        INCLUDE (label, input_type, is_enabled);
END
GO

/*----------------------------------------------------------------------------
  question_system_reference
  ---------------------------------------------------------------------------
  Things in the front end that depend on a question BY ID — a notification rule,
  a derived figure, a deep-link target.

  This is what makes the admin portal's integrity checks data-driven instead of
  a hardcoded list of question ids in the UI. A question with rows here cannot
  be hidden, retyped or deleted, because something would silently stop working.

  A table rather than a column so a question can be depended on by more than one
  thing, and so the reason can be named in the error the administrator sees.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.question_system_reference', 'U') IS NULL
BEGIN
    CREATE TABLE saip.question_system_reference
    (
        question_system_reference_id uniqueidentifier NOT NULL
            CONSTRAINT DF_qsr_id DEFAULT NEWSEQUENTIALID(),
        question_id                  uniqueidentifier NOT NULL,
        /* Shown verbatim in the admin portal's blocking message, so write it as
           the sentence an administrator should read. */
        reference_name               nvarchar(200)    NOT NULL,
        notes                        nvarchar(500)    NOT NULL
            CONSTRAINT DF_qsr_notes DEFAULT N'',
        created_on                   datetime2(3)     NOT NULL
            CONSTRAINT DF_qsr_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_question_system_reference PRIMARY KEY (question_system_reference_id),
        CONSTRAINT UQ_qsr UNIQUE (question_id, reference_name),
        CONSTRAINT FK_qsr_question FOREIGN KEY (question_id)
            REFERENCES saip.question (question_id) ON DELETE CASCADE
    );
END
GO

/*----------------------------------------------------------------------------
  Guard: a question depended on by the app cannot be disabled
  ---------------------------------------------------------------------------
  The admin portal blocks this, but the Web API is reachable regardless of what
  the UI renders, so the rule is enforced here too. This is the database saying
  the same thing the screen says.
----------------------------------------------------------------------------*/
CREATE OR ALTER TRIGGER saip.TR_question_protect_referenced
ON saip.question
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(is_enabled) OR UPDATE(input_type)
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM inserted i
            INNER JOIN deleted d ON d.question_id = i.question_id
            INNER JOIN saip.question_system_reference r ON r.question_id = i.question_id
            WHERE (i.is_enabled = 0 AND d.is_enabled = 1)
               OR (i.input_type <> d.input_type)
        )
        BEGIN
            THROW 50010,
                'This question is depended on by the application (see saip.question_system_reference). It cannot be hidden or have its input type changed.',
                1;
        END
    END

    IF NOT UPDATE(modified_on)
        UPDATE q SET modified_on = SYSUTCDATETIME()
        FROM saip.question q INNER JOIN inserted i ON q.question_id = i.question_id;
END
GO

CREATE OR ALTER TRIGGER saip.TR_question_block_referenced_delete
ON saip.question
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM deleted d
               INNER JOIN saip.question_system_reference r ON r.question_id = d.question_id)
        THROW 50011,
            'This question is depended on by the application and cannot be deleted. Disable it instead if it should come off the form.',
            1;

    DELETE q FROM saip.question q INNER JOIN deleted d ON q.question_id = d.question_id;
END
GO

/*----------------------------------------------------------------------------
  A NOTE ON TEMPORAL TABLES
  ---------------------------------------------------------------------------
  Fabric SQL database supports SYSTEM_VERSIONING, and these configuration tables
  are the obvious candidates — "who changed this question's wording, and when"
  is exactly the audit an administrator will eventually be asked for, and it
  costs nothing to keep.

  It is NOT enabled here on purpose. Every eligible table in a Fabric SQL
  database mirrors to OneLake automatically, and the interaction between system
  versioning and mirroring needs verifying against the current mirroring
  limitations before it is switched on in an environment anyone depends on.

  To enable later, per table:

      ALTER TABLE saip.question ADD
          valid_from datetime2(3) GENERATED ALWAYS AS ROW START HIDDEN
              CONSTRAINT DF_question_valid_from DEFAULT SYSUTCDATETIME(),
          valid_to   datetime2(3) GENERATED ALWAYS AS ROW END   HIDDEN
              CONSTRAINT DF_question_valid_to DEFAULT CONVERT(datetime2(3), '9999-12-31 23:59:59.999'),
          PERIOD FOR SYSTEM_TIME (valid_from, valid_to);

      ALTER TABLE saip.question
          SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = saip.question_history));
----------------------------------------------------------------------------*/

EXEC saip.log_deployment
    @script_name = '020_configuration.sql',
    @notes       = 'question_section, option_set, option, question, question_system_reference and integrity triggers.';
GO
