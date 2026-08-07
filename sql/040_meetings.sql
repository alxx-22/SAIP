/*==============================================================================
  SAIP — 040  Meeting log
==============================================================================

  A HYBRID, AND DELIBERATELY NOT THE SAME SHAPE AS 030
  Account monitoring is answers-only, because every one of its questions is
  configurable. A meeting is not like that. It has a spine — when, where, what,
  which account — that reporting groups by, that the CRM will eventually want,
  and that no administrator should be able to remove from the form. Those are
  real columns.

  Anything an administrator ADDS to the meeting section is a configured question
  and lands in `meeting_answer`, using the same pattern as 030.

  The alternative — putting the spine through the EAV table too — would make
  "meetings per account per month" a pivot over four joins, on the one table
  most likely to be reported on. The asymmetry is the point, not an oversight.

==============================================================================*/

/*----------------------------------------------------------------------------
  meeting
  ---------------------------------------------------------------------------
  `place_option_id` is a lookup rather than a string, so renaming "Teams" in the
  admin portal renames it everywhere at once instead of leaving history spelled
  the old way. That is the whole argument for configuration-as-data, applied to
  the data the configuration describes.

  `logged_by_user_id` is NO ACTION against saip.user: a leaver is deactivated,
  never deleted, precisely so the meetings they logged keep their author.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.meeting', 'U') IS NULL
BEGIN
    CREATE TABLE saip.meeting
    (
        meeting_id          uniqueidentifier NOT NULL
            CONSTRAINT DF_meeting_id DEFAULT NEWSEQUENTIALID(),
        account_external_id nvarchar(100)    NOT NULL,
        meeting_date        date             NOT NULL,
        place_option_id     uniqueidentifier NULL,
        subject             nvarchar(400)    NOT NULL,
        comments            nvarchar(max)    NOT NULL
            CONSTRAINT DF_meeting_comments DEFAULT N'',
        logged_by_user_id   uniqueidentifier NULL,
        logged_on           datetime2(3)     NOT NULL
            CONSTRAINT DF_meeting_logged DEFAULT SYSUTCDATETIME(),
        modified_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_meeting_modified DEFAULT SYSUTCDATETIME(),
        modified_by         nvarchar(320)    NULL,
        CONSTRAINT PK_meeting PRIMARY KEY (meeting_id),
        CONSTRAINT FK_meeting_place FOREIGN KEY (place_option_id)
            REFERENCES saip.[option] (option_id),
        CONSTRAINT FK_meeting_user FOREIGN KEY (logged_by_user_id)
            REFERENCES saip.[user] (user_id),
        /* A meeting logged in the future is a typo, not a plan — the modal
           caps the picker at today and this agrees. */
        CONSTRAINT CK_meeting_date_not_future
            CHECK (meeting_date <= CONVERT(date, SYSUTCDATETIME()))
    );

    /* "Recent meetings for this account", newest first — the exact read the
       Account Focus tab performs. */
    CREATE INDEX IX_meeting_account_date
        ON saip.meeting (account_external_id, meeting_date DESC)
        INCLUDE (subject, place_option_id, logged_by_user_id);

    CREATE INDEX IX_meeting_logged_by ON saip.meeting (logged_by_user_id);
END
GO

/*----------------------------------------------------------------------------
  meeting_tag
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.meeting_tag', 'U') IS NULL
BEGIN
    CREATE TABLE saip.meeting_tag
    (
        meeting_tag_id uniqueidentifier NOT NULL
            CONSTRAINT DF_meeting_tag_id DEFAULT NEWSEQUENTIALID(),
        meeting_id     uniqueidentifier NOT NULL,
        option_id      uniqueidentifier NOT NULL,
        CONSTRAINT PK_meeting_tag PRIMARY KEY (meeting_tag_id),
        CONSTRAINT UQ_meeting_tag UNIQUE (meeting_id, option_id),
        CONSTRAINT FK_meeting_tag_meeting FOREIGN KEY (meeting_id)
            REFERENCES saip.meeting (meeting_id) ON DELETE CASCADE,
        CONSTRAINT FK_meeting_tag_option FOREIGN KEY (option_id)
            REFERENCES saip.[option] (option_id)
    );

    /* "Every meeting tagged Workshop" — the reporting direction. */
    CREATE INDEX IX_meeting_tag_option ON saip.meeting_tag (option_id, meeting_id);
END
GO

/*----------------------------------------------------------------------------
  meeting_answer — administrator-added questions on the meeting form
  ---------------------------------------------------------------------------
  Same typed-column pattern as 030, and the same reasoning. Empty until someone
  adds a question to the meeting-log section, which is the point: the form can
  grow without this table changing.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.meeting_answer', 'U') IS NULL
BEGIN
    CREATE TABLE saip.meeting_answer
    (
        meeting_answer_id uniqueidentifier NOT NULL
            CONSTRAINT DF_meeting_answer_id DEFAULT NEWSEQUENTIALID(),
        meeting_id        uniqueidentifier NOT NULL,
        question_id       uniqueidentifier NOT NULL,
        value_date        date             NULL,
        value_text        nvarchar(max)    NULL,
        value_number      decimal(18, 4)   NULL,
        value_bit         bit              NULL,
        value_option_id   uniqueidentifier NULL,
        CONSTRAINT PK_meeting_answer PRIMARY KEY (meeting_answer_id),
        CONSTRAINT UQ_meeting_answer UNIQUE (meeting_id, question_id),
        CONSTRAINT FK_meeting_answer_meeting FOREIGN KEY (meeting_id)
            REFERENCES saip.meeting (meeting_id) ON DELETE CASCADE,
        CONSTRAINT FK_meeting_answer_question FOREIGN KEY (question_id)
            REFERENCES saip.question (question_id),
        CONSTRAINT FK_meeting_answer_option FOREIGN KEY (value_option_id)
            REFERENCES saip.[option] (option_id),
        CONSTRAINT CK_meeting_answer_exactly_one_value CHECK
        (
            (CASE WHEN value_date      IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_text      IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_number    IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_bit       IS NULL THEN 0 ELSE 1 END)
          + (CASE WHEN value_option_id IS NULL THEN 0 ELSE 1 END) = 1
        )
    );
END
GO

CREATE OR ALTER TRIGGER saip.TR_meeting_modified ON saip.meeting AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(modified_on)
        UPDATE m SET modified_on = SYSUTCDATETIME()
        FROM saip.meeting m INNER JOIN inserted i ON m.meeting_id = i.meeting_id;
END
GO

EXEC saip.log_deployment
    @script_name = '040_meetings.sql',
    @notes       = 'meeting, meeting_tag, meeting_answer.';
GO
