/*==============================================================================
  SAIP — 030  Account monitoring answers
==============================================================================

  The relationship dates a rep keeps current against an account.

  WHY THIS IS NOT SEVEN DATE COLUMNS
  It was, in the prototype: lastStakeholderMeeting, lastWorkshop, and so on.
  That only works while the question set is fixed in code. The whole point of
  020 is that an administrator can add "Last executive engagement" or rename it
  without a deploy — and a fixed column per question makes that a schema change,
  which is exactly what we are removing.

  So answers are stored one row per (account, question). The cost is that a
  report wanting the old shape needs a PIVOT; 070 provides one, so nobody has
  to write it twice.

  WHY TYPED VALUE COLUMNS RATHER THAN ONE nvarchar
  A single `value nvarchar(max)` would make every date comparison a string
  parse, and the overdue rule — the thing this table exists to feed — is a date
  comparison run across every account on every notification read. Typed columns
  keep that a real index-usable predicate. A CHECK constraint makes sure exactly
  one of them is populated, so "which column holds this answer" is never a guess.

  ACCOUNTS ARE NOT OURS
  `account_external_id` holds the source system's key. There is no foreign key
  and no account table in this database. See 000.

==============================================================================*/

/*----------------------------------------------------------------------------
  account_monitoring — one header row per account
  ---------------------------------------------------------------------------
  Carries the "last updated by / at" line the ribbon shows under the form. Kept
  separate from the answers so that line means "someone reviewed this account",
  not "one field changed" — a rep who checks every date and changes nothing has
  still done the review.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.account_monitoring', 'U') IS NULL
BEGIN
    CREATE TABLE saip.account_monitoring
    (
        account_monitoring_id uniqueidentifier NOT NULL
            CONSTRAINT DF_acct_mon_id DEFAULT NEWSEQUENTIALID(),
        account_external_id   nvarchar(100)    NOT NULL,
        last_reviewed_on      datetime2(3)     NULL,
        last_reviewed_by      nvarchar(320)    NULL,
        created_on            datetime2(3)     NOT NULL
            CONSTRAINT DF_acct_mon_created DEFAULT SYSUTCDATETIME(),
        modified_on           datetime2(3)     NOT NULL
            CONSTRAINT DF_acct_mon_modified DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_account_monitoring PRIMARY KEY (account_monitoring_id),
        CONSTRAINT UQ_account_monitoring_account UNIQUE (account_external_id)
    );
END
GO

/*----------------------------------------------------------------------------
  account_monitoring_answer — one row per account per question
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.account_monitoring_answer', 'U') IS NULL
BEGIN
    CREATE TABLE saip.account_monitoring_answer
    (
        answer_id           uniqueidentifier NOT NULL
            CONSTRAINT DF_ama_id DEFAULT NEWSEQUENTIALID(),
        account_external_id nvarchar(100)    NOT NULL,
        question_id         uniqueidentifier NOT NULL,

        /* Exactly one of these is populated, chosen by the question's
           input_type. A null answer is a real state — "never recorded" — and is
           represented by the ROW BEING ABSENT rather than by a row of nulls, so
           the CHECK below can stay strict. */
        value_date          date             NULL,
        value_text          nvarchar(max)    NULL,
        value_number        decimal(18, 4)   NULL,
        value_bit           bit              NULL,
        value_option_id     uniqueidentifier NULL,

        answered_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_ama_answered DEFAULT SYSUTCDATETIME(),
        answered_by         nvarchar(320)    NULL,
        modified_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_ama_modified DEFAULT SYSUTCDATETIME(),
        modified_by         nvarchar(320)    NULL,

        CONSTRAINT PK_account_monitoring_answer PRIMARY KEY (answer_id),
        CONSTRAINT UQ_ama_account_question UNIQUE (account_external_id, question_id),
        CONSTRAINT FK_ama_question FOREIGN KEY (question_id)
            REFERENCES saip.question (question_id),
        CONSTRAINT FK_ama_option FOREIGN KEY (value_option_id)
            REFERENCES saip.[option] (option_id),
        CONSTRAINT CK_ama_exactly_one_value CHECK
        (
            (CASE WHEN value_date      IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_text      IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_number    IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_bit       IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_option_id IS NULL THEN 0 ELSE 1 END) = 1
        )
    );

    /* The read path is "every answer for this account", which is what the
       ribbon loads, so lead with the account. */
    CREATE INDEX IX_ama_account
        ON saip.account_monitoring_answer (account_external_id)
        INCLUDE (question_id, value_date, value_text, value_number, value_bit, value_option_id);

    /* The notification path is the opposite: "every account overdue on THIS
       question". Filtered to date answers because that is the only type the
       overdue rule applies to. */
    CREATE INDEX IX_ama_question_date
        ON saip.account_monitoring_answer (question_id, value_date)
        WHERE value_date IS NOT NULL;
END
GO

/*----------------------------------------------------------------------------
  multi-select answers
  ---------------------------------------------------------------------------
  A separate table because a multichoice answer is a set, and cramming it into
  value_text as a delimited list would make "which accounts chose X" a LIKE scan
  and would lose the foreign key to the option.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.account_monitoring_answer_option', 'U') IS NULL
BEGIN
    CREATE TABLE saip.account_monitoring_answer_option
    (
        answer_option_id uniqueidentifier NOT NULL
            CONSTRAINT DF_amao_id DEFAULT NEWSEQUENTIALID(),
        answer_id        uniqueidentifier NOT NULL,
        option_id        uniqueidentifier NOT NULL,
        CONSTRAINT PK_ama_option PRIMARY KEY (answer_option_id),
        CONSTRAINT UQ_amao UNIQUE (answer_id, option_id),
        CONSTRAINT FK_amao_answer FOREIGN KEY (answer_id)
            REFERENCES saip.account_monitoring_answer (answer_id) ON DELETE CASCADE,
        CONSTRAINT FK_amao_option FOREIGN KEY (option_id)
            REFERENCES saip.[option] (option_id)
    );
END
GO

/*----------------------------------------------------------------------------
  Guard: the value column must match the question's input type
  ---------------------------------------------------------------------------
  The CHECK above proves exactly one value is set; it cannot prove it is the
  RIGHT one, because that depends on another table. A date landing in
  value_text would read as null to every date query and the answer would
  silently vanish from the overdue rule — a failure with no error attached to
  it, which is why this is worth a trigger.
----------------------------------------------------------------------------*/
CREATE OR ALTER TRIGGER saip.TR_ama_value_matches_type
ON saip.account_monitoring_answer
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        INNER JOIN saip.question q ON q.question_id = i.question_id
        WHERE (q.input_type = 'date'        AND i.value_date      IS NULL)
           OR (q.input_type IN ('text','longtext') AND i.value_text IS NULL)
           OR (q.input_type = 'number'      AND i.value_number    IS NULL)
           OR (q.input_type = 'boolean'     AND i.value_bit       IS NULL)
           OR (q.input_type = 'choice'      AND i.value_option_id IS NULL)
    )
        THROW 50020,
            'The populated value column does not match the question''s input type.',
            1;

    /* A choice answer must point at an option belonging to THAT question's
       list, not merely at some option somewhere. The foreign key cannot express
       that on its own. */
    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        INNER JOIN saip.question q ON q.question_id = i.question_id
        INNER JOIN saip.[option] o ON o.option_id = i.value_option_id
        WHERE i.value_option_id IS NOT NULL
          AND o.option_set_id <> q.option_set_id
    )
        THROW 50021,
            'The selected option does not belong to the dropdown this question uses.',
            1;
END
GO

EXEC saip.log_deployment
    @script_name = '030_account_monitoring.sql',
    @notes       = 'account_monitoring, account_monitoring_answer(+_option) and type-integrity trigger.';
GO
