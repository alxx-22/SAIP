/*==============================================================================
  SAIP — 060  User preferences
==============================================================================

  Theme, accent and notification settings — today held in the browser's
  localStorage under `saip.settings.v1`.

  WHY MOVE THEM AT ALL
  localStorage is per browser. A rep who works on a laptop and a desk machine
  configures the portal twice and gets a different theme on each, and clearing
  site data silently resets both. None of that is business data, which is why it
  was fine to start there — but a row keyed on the user costs almost nothing and
  makes the preference follow the person.

  The provider was written for this: `SettingsProvider` keeps its shape and only
  its `load` and `persist` functions change.

==============================================================================*/

/*----------------------------------------------------------------------------
  user_preference — one row per user, created on first save
  ---------------------------------------------------------------------------
  The absence of a row is a real state: "has never chosen", which resolves to
  theme `auto` and the brand accent. Seeding a default row for every user would
  destroy that distinction and make "follow my device" indistinguishable from a
  deliberate choice of light.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.user_preference', 'U') IS NULL
BEGIN
    CREATE TABLE saip.user_preference
    (
        user_preference_id uniqueidentifier NOT NULL
            CONSTRAINT DF_user_pref_id DEFAULT NEWSEQUENTIALID(),
        user_id            uniqueidentifier NOT NULL,

        /* Appearance. 'auto' follows the operating system and is the default,
           which is why it is a real value here rather than an absence. */
        theme_mode         nvarchar(10)     NOT NULL
            CONSTRAINT DF_user_pref_mode DEFAULT N'auto',
        accent_key         nvarchar(50)     NOT NULL
            CONSTRAINT DF_user_pref_accent DEFAULT N'brand',

        /* Notifications. Severities are three columns rather than a child table
           because the set is closed and derived in code — a notification is
           critical or not because of a rule, not because someone configured a
           severity. If severities ever become configurable this becomes a
           junction against saip.option and the columns are dropped. */
        notifications_enabled bit           NOT NULL
            CONSTRAINT DF_user_pref_notif DEFAULT 1,
        show_critical         bit           NOT NULL
            CONSTRAINT DF_user_pref_critical DEFAULT 1,
        show_warning          bit           NOT NULL
            CONSTRAINT DF_user_pref_warning DEFAULT 1,
        show_info             bit           NOT NULL
            CONSTRAINT DF_user_pref_info DEFAULT 1,

        /* This person's own overdue threshold for NOTIFICATIONS only. The
           Account Monitoring ribbon keeps using the agreed business rule,
           because that flag is a fact about the account rather than a personal
           view of it. */
        overdue_after_months  int           NOT NULL
            CONSTRAINT DF_user_pref_overdue DEFAULT 12,

        created_on         datetime2(3)     NOT NULL
            CONSTRAINT DF_user_pref_created DEFAULT SYSUTCDATETIME(),
        modified_on        datetime2(3)     NOT NULL
            CONSTRAINT DF_user_pref_modified DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_user_preference PRIMARY KEY (user_preference_id),
        CONSTRAINT UQ_user_preference_user UNIQUE (user_id),
        CONSTRAINT FK_user_preference_user FOREIGN KEY (user_id)
            REFERENCES saip.[user] (user_id) ON DELETE CASCADE,
        CONSTRAINT CK_user_pref_theme
            CHECK (theme_mode IN ('light', 'dark', 'auto')),
        /* Matches the slider's bounds. Stated here too because the Web API is
           reachable regardless of what the slider allows. */
        CONSTRAINT CK_user_pref_overdue_range
            CHECK (overdue_after_months BETWEEN 3 AND 24)
    );
END
GO

CREATE OR ALTER TRIGGER saip.TR_user_preference_modified
ON saip.user_preference AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(modified_on)
        UPDATE p SET modified_on = SYSUTCDATETIME()
        FROM saip.user_preference p
        INNER JOIN inserted i ON p.user_preference_id = i.user_preference_id;
END
GO

/*----------------------------------------------------------------------------
  A NOTE ON NOTIFICATIONS
  ---------------------------------------------------------------------------
  There is no notification TABLE, and that is deliberate.

  A notification exists because a monitoring date is overdue. It is a question
  asked of the data, not a record — which is why it clears itself the moment the
  rep updates the date, with nothing to dismiss and nothing to keep in sync. A
  stored notification would need creating, expiring and reconciling, and the
  first time that job failed the portal would nag about work already done.

  The derivation lives in `saip.vw_overdue_monitoring` (070).
----------------------------------------------------------------------------*/

EXEC saip.log_deployment
    @script_name = '060_user_preferences.sql',
    @notes       = 'user_preference.';
GO
