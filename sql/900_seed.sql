/*==============================================================================
  SAIP — 900  Seed
==============================================================================

  THIS IS THE MIGRATION'S STARTING CONTENT, not sample data.

  Every capability, role, section, question and dropdown option below mirrors
  what the application renders today, key for key. `mon-workshop` here is the
  same string the Account Monitoring ribbon uses as a DOM id and the same one
  the notification deep-links target.

  The test of a correct seed is therefore precise: when the front end is wired
  to read from these tables instead of its TypeScript constants, NOTHING ON
  SCREEN SHOULD CHANGE.

  Idempotent throughout — every statement MERGEs on the business key, so this
  can be re-run against a partially seeded database without duplicating a row
  or disturbing a GUID something already references.

  WHAT IS NOT SEEDED
  People. The users in the prototype are invented, and seeding invented people
  into a real database is how invented people end up in a real report. Load
  users from Entra instead; the final section shows the shape.

==============================================================================*/

SET NOCOUNT ON;
GO

/*============================================================================
  Capabilities
============================================================================*/
MERGE saip.capability AS target
USING (VALUES
    ('home.view',      N'Home',                     N'The landing page and their own portfolio scores.',                       10),
    ('accounts.view',  N'View accounts',            N'Open Account Focus for accounts aligned to them.',                       20),
    ('accounts.edit',  N'Edit account monitoring',  N'Maintain the relationship dates on an account.',                         30),
    ('meetings.log',   N'Log meetings',             N'Record a customer meeting against an account.',                          40),
    ('bizdev.view',    N'View Business Development',N'See incentives and the opportunities raised against them.',              50),
    ('bizdev.manage',  N'Manage incentives',        N'Create incentives, nominate accounts and assign them to people.',        60),
    ('executive.view', N'Executive View',           N'Read-only reporting across every account.',                              70),
    ('team.view',      N'View team''s accounts',    N'See the accounts of everyone reporting to them, not just their own.',    80),
    ('admin.access',   N'Admin portal',             N'Change questions, dropdowns, users and roles.',                          90)
) AS source (capability_key, label, description, display_order)
    ON target.capability_key = source.capability_key
WHEN MATCHED THEN UPDATE SET
    target.label         = source.label,
    target.description   = source.description,
    target.display_order = source.display_order
WHEN NOT MATCHED BY TARGET THEN
    INSERT (capability_key, label, description, display_order)
    VALUES (source.capability_key, source.label, source.description, source.display_order);
GO

/*============================================================================
  Roles
============================================================================*/
MERGE saip.[role] AS target
USING (VALUES
    ('role-admin',           N'SAIP Administrator',    N'Full access, including the admin portal. Held alongside a job role rather than instead of one — an administrator is still an account manager or a BD lead.', 1, 0),
    ('role-account-manager', N'Account Manager',       N'The default job role. Works their own aligned accounts, logs meetings and keeps the monitoring dates current.',                                              0, 0),
    ('role-bizdev',          N'Business Development',  N'Builds and runs incentives: creates them, nominates accounts, and assigns them to people or roles.',                                                          0, 0),
    ('role-line-manager',    N'Line Manager',          N'Everything an Account Manager can do, plus visibility of the accounts held by the people reporting to them.',                                                 0, 0),
    ('role-executive-view',  N'Executive View',        N'Read-only reporting across every account. No editing, no meeting logging.',                                                                                   0, 0),
    ('role-authenticated',   N'Authenticated Users',   N'Applied to everyone who signs in. Created and maintained by Power Pages, so it cannot be edited or deleted here.',                                            0, 1)
) AS source (role_key, name, description, is_administrator, is_system_managed)
    ON target.role_key = source.role_key
WHEN MATCHED THEN UPDATE SET
    target.name              = source.name,
    target.description       = source.description,
    target.is_administrator  = source.is_administrator,
    target.is_system_managed = source.is_system_managed
WHEN NOT MATCHED BY TARGET THEN
    INSERT (role_key, name, description, is_administrator, is_system_managed)
    VALUES (source.role_key, source.name, source.description, source.is_administrator, source.is_system_managed);
GO

/*============================================================================
  Role capabilities
  Expressed as (role_key, capability_key) pairs and resolved to GUIDs, so this
  block reads as the permission matrix it is.
============================================================================*/
;WITH grants (role_key, capability_key) AS
(
    SELECT * FROM (VALUES
        ('role-admin','home.view'),('role-admin','accounts.view'),('role-admin','accounts.edit'),
        ('role-admin','meetings.log'),('role-admin','bizdev.view'),('role-admin','bizdev.manage'),
        ('role-admin','executive.view'),('role-admin','team.view'),('role-admin','admin.access'),

        ('role-account-manager','home.view'),('role-account-manager','accounts.view'),
        ('role-account-manager','accounts.edit'),('role-account-manager','meetings.log'),
        ('role-account-manager','bizdev.view'),

        ('role-bizdev','home.view'),('role-bizdev','accounts.view'),('role-bizdev','meetings.log'),
        ('role-bizdev','bizdev.view'),('role-bizdev','bizdev.manage'),

        ('role-line-manager','home.view'),('role-line-manager','accounts.view'),
        ('role-line-manager','accounts.edit'),('role-line-manager','meetings.log'),
        ('role-line-manager','bizdev.view'),('role-line-manager','team.view'),

        ('role-executive-view','home.view'),('role-executive-view','accounts.view'),
        ('role-executive-view','executive.view'),

        ('role-authenticated','home.view')
    ) v (role_key, capability_key)
)
MERGE saip.role_capability AS target
USING
(
    SELECT r.role_id, c.capability_id
    FROM grants g
    INNER JOIN saip.[role]     r ON r.role_key       = g.role_key
    INNER JOIN saip.capability c ON c.capability_key = g.capability_key
) AS source
    ON target.role_id = source.role_id AND target.capability_id = source.capability_id
WHEN NOT MATCHED BY TARGET THEN
    INSERT (role_id, capability_id) VALUES (source.role_id, source.capability_id);
GO

/*============================================================================
  Question sections
============================================================================*/
MERGE saip.question_section AS target
USING (VALUES
    ('sec-proximity',  N'Customer Proximity',  N'How close the account team is to the customer day to day.', 'account-monitoring', 10),
    ('sec-centricity', N'Customer Centricity', N'How well the relationship is served at a senior level.',     'account-monitoring', 20),
    ('sec-meeting',    N'Meeting log',         N'Captured when a rep logs a customer meeting.',               'meeting-log',        30)
) AS source (section_key, title, description, area, display_order)
    ON target.section_key = source.section_key
WHEN MATCHED THEN UPDATE SET
    target.title         = source.title,
    target.description   = source.description,
    target.area          = source.area,
    target.display_order = source.display_order
WHEN NOT MATCHED BY TARGET THEN
    INSERT (section_key, title, description, area, display_order)
    VALUES (source.section_key, source.title, source.description, source.area, source.display_order);
GO

/*============================================================================
  Dropdowns
  `is_code_dependent` marks the lists the FRONT END still matches by exact text.
  Clear each flag as its consumer is wired to read from here — that is the
  migration checklist for the front-end work that follows this deployment.
============================================================================*/
MERGE saip.option_set AS target
USING (VALUES
    ('opt-meeting-place',      N'Meeting place',      N'Where a logged meeting took place.',                  N'Log a meeting → Where did it take place?',           0),
    ('opt-meeting-tag',        N'Meeting tag',        N'Classification applied to a logged meeting.',         N'Log a meeting → Tags; Recent Meetings chips',        1),
    ('opt-incentive-type',     N'Incentive purpose',  N'What a Business Development incentive is for.',       N'Business Development → New incentive → Purpose',     1),
    ('opt-sla-tier',           N'SLA tier',           N'Service level attached to a contract.',               N'Active Service Contracts; SLA spend breakdown',      1),
    ('opt-opportunity-stage',  N'Opportunity stage',  N'Where an opportunity sits in the sales cycle.',       N'Campaign code opportunities',                        1)
) AS source (option_set_key, name, description, usage_note, is_code_dependent)
    ON target.option_set_key = source.option_set_key
WHEN MATCHED THEN UPDATE SET
    target.name              = source.name,
    target.description       = source.description,
    target.usage_note        = source.usage_note,
    target.is_code_dependent = source.is_code_dependent
WHEN NOT MATCHED BY TARGET THEN
    INSERT (option_set_key, name, description, usage_note, is_code_dependent)
    VALUES (source.option_set_key, source.name, source.description, source.usage_note, source.is_code_dependent);
GO

/*============================================================================
  Options
  display_order is sparse (10, 20, 30…) so a value can be inserted between two
  others without renumbering every row after it.
============================================================================*/
;WITH opts (option_set_key, option_key, label, display_order) AS
(
    SELECT * FROM (VALUES
        ('opt-meeting-place','mp-1', N'Phone Call',              10),
        ('opt-meeting-place','mp-2', N'Teams',                   20),
        ('opt-meeting-place','mp-3', N'Customer Site',           30),
        ('opt-meeting-place','mp-4', N'CIC',                     40),
        ('opt-meeting-place','mp-5', N'Channel Partner Site',    50),

        ('opt-meeting-tag','mt-1',   N'Workshop',                10),
        ('opt-meeting-tag','mt-2',   N'Upsell',                  20),
        ('opt-meeting-tag','mt-3',   N'SLA Review',              30),
        ('opt-meeting-tag','mt-4',   N'Spend Review',            40),
        ('opt-meeting-tag','mt-5',   N'Leadership Introduction', 50),

        ('opt-incentive-type','it-1', N'Sales Training',         10),
        ('opt-incentive-type','it-2', N'Upsell',                 20),
        ('opt-incentive-type','it-3', N'Workshop',               30),
        ('opt-incentive-type','it-4', N'Sales Play',             40),

        ('opt-sla-tier','sla-1',      N'Complete Care',          10),
        ('opt-sla-tier','sla-2',      N'Tech Care Basic',        20),
        ('opt-sla-tier','sla-3',      N'Tech Care Essential',    30),
        ('opt-sla-tier','sla-4',      N'Tech Care Critical',     40),

        ('opt-opportunity-stage','stg-1', N'Qualify',            10),
        ('opt-opportunity-stage','stg-2', N'Propose',            20),
        ('opt-opportunity-stage','stg-3', N'Negotiate',          30),
        ('opt-opportunity-stage','stg-4', N'Closed won',         40),
        ('opt-opportunity-stage','stg-5', N'Closed lost',        50)
    ) v (option_set_key, option_key, label, display_order)
)
MERGE saip.[option] AS target
USING
(
    SELECT os.option_set_id, o.option_key, o.label, o.display_order
    FROM opts o
    INNER JOIN saip.option_set os ON os.option_set_key = o.option_set_key
) AS source
    ON target.option_key = source.option_key
WHEN MATCHED THEN UPDATE SET
    target.label         = source.label,
    target.display_order = source.display_order
WHEN NOT MATCHED BY TARGET THEN
    INSERT (option_set_id, option_key, label, display_order)
    VALUES (source.option_set_id, source.option_key, source.label, source.display_order);
GO

/*============================================================================
  Questions
  Ids match the DOM ids the Account Monitoring ribbon renders today, which is
  also what the notification deep-links target. Keeping them identical makes the
  wiring step a lookup rather than a mapping table.
============================================================================*/
;WITH qs (question_key, section_key, label, help_text, input_type, is_required,
          display_order, option_set_key, is_name_provisional) AS
(
    SELECT * FROM (VALUES
        ('mon-stakeholder-meeting','sec-proximity',  N'Last meeting with key stakeholders',            N'',                                                'date', 0, 10, NULL, 0),
        ('mon-workshop',           'sec-proximity',  N'Last workshop held',                            N'Drives the overdue workshop notification.',       'date', 0, 20, NULL, 0),
        ('mon-spend-review',       'sec-proximity',  N'Last spend review / SLA review with customer',  N'',                                                'date', 0, 30, NULL, 0),

        ('mon-customer-visit',     'sec-centricity', N'Last visit to customer',                        N'',                                                'date', 0, 10, NULL, 0),
        ('mon-performance-review', 'sec-centricity', N'Last performance review with customer',         N'',                                                'date', 0, 20, NULL, 0),
        /* Both flagged in the brief as working names. Renaming them here is
           exactly the change this configuration exists to make without a deploy. */
        ('mon-exec-engagement',    'sec-centricity', N'Last executive engagement',                     N'',                                                'date', 0, 30, NULL, 1),
        ('mon-sponsor-review',     'sec-centricity', N'Last service review with executive sponsor',    N'Drives the executive sponsor review notification.','date', 0, 40, NULL, 1),

        ('meet-date',              'sec-meeting',    N'Meeting date',                                  N'',                                                'date',        1, 10, NULL,                 0),
        ('meet-place',             'sec-meeting',    N'Where did it take place?',                      N'',                                                'choice',      1, 20, 'opt-meeting-place',  0),
        ('meet-subject',           'sec-meeting',    N'Subject',                                       N'',                                                'text',        1, 30, NULL,                 0),
        ('meet-comments',          'sec-meeting',    N'Comments',                                      N'What was discussed and what happens next.',       'longtext',    0, 40, NULL,                 0),
        ('meet-tags',              'sec-meeting',    N'Tags',                                          N'Classifies the meeting for reporting.',           'multichoice', 0, 50, 'opt-meeting-tag',    0)
    ) v (question_key, section_key, label, help_text, input_type, is_required,
         display_order, option_set_key, is_name_provisional)
)
MERGE saip.question AS target
USING
(
    SELECT
        q.question_key, s.section_id, q.label, q.help_text, q.input_type,
        q.is_required, q.display_order, os.option_set_id, q.is_name_provisional
    FROM qs q
    INNER JOIN saip.question_section s  ON s.section_key    = q.section_key
    LEFT  JOIN saip.option_set       os ON os.option_set_key = q.option_set_key
) AS source
    ON target.question_key = source.question_key
WHEN MATCHED THEN UPDATE SET
    target.section_id          = source.section_id,
    target.label               = source.label,
    target.help_text           = source.help_text,
    target.is_required         = source.is_required,
    target.display_order       = source.display_order,
    target.option_set_id       = source.option_set_id,
    target.is_name_provisional = source.is_name_provisional
    /* input_type is NOT updated here on purpose: the trigger in 020 blocks
       changing it on a referenced question, and a re-run of the seed should
       never be the thing that trips that guard. */
WHEN NOT MATCHED BY TARGET THEN
    INSERT (question_key, section_id, label, help_text, input_type, is_required,
            display_order, option_set_id, is_name_provisional)
    VALUES (source.question_key, source.section_id, source.label, source.help_text,
            source.input_type, source.is_required, source.display_order,
            source.option_set_id, source.is_name_provisional);
GO

/*============================================================================
  Question system references
  What in the front end depends on a question BY ID. These rows are what make
  the admin portal's integrity checks data-driven — a question named here cannot
  be hidden, retyped or deleted.
============================================================================*/
;WITH refs (question_key, reference_name, notes) AS
(
    SELECT * FROM (VALUES
        ('mon-workshop',       N'Overdue workshop notification',          N'The notification pane derives an overdue-workshop item from this date.'),
        ('mon-sponsor-review', N'Executive sponsor review notification',  N'The notification pane derives a sponsor-review item from this date.')
    ) v (question_key, reference_name, notes)
)
MERGE saip.question_system_reference AS target
USING
(
    SELECT q.question_id, r.reference_name, r.notes
    FROM refs r
    INNER JOIN saip.question q ON q.question_key = r.question_key
) AS source
    ON target.question_id = source.question_id
   AND target.reference_name = source.reference_name
WHEN MATCHED THEN UPDATE SET target.notes = source.notes
WHEN NOT MATCHED BY TARGET THEN
    INSERT (question_id, reference_name, notes)
    VALUES (source.question_id, source.reference_name, source.notes);
GO

/*============================================================================
  Users — NOT SEEDED
============================================================================
  Load these from Entra rather than from this script. The prototype's people are
  invented, and invented people in a real database become invented people in a
  real report.

  The shape, for whatever loads them (a Data Factory pipeline against Graph, or
  a one-off import):

      MERGE saip.[user] AS target
      USING (SELECT @user_key, @entra_object_id, @display_name, @email) AS source (...)
          ON target.entra_object_id = source.entra_object_id
      WHEN MATCHED THEN UPDATE SET display_name = source.display_name,
                                   email        = source.email
      WHEN NOT MATCHED BY TARGET THEN INSERT (...) VALUES (...);

  Then grant the default role to everyone who has none:

      INSERT INTO saip.user_role (user_id, role_id)
      SELECT u.user_id, r.role_id
      FROM saip.[user] u
      CROSS JOIN saip.[role] r
      WHERE r.role_key = 'role-account-manager'
        AND NOT EXISTS (SELECT 1 FROM saip.user_role x WHERE x.user_id = u.user_id);

  Give at least one person 'role-admin' before switching the portal on, or
  nobody can reach the admin screens to grant it.
============================================================================*/

EXEC saip.log_deployment
    @script_name = '900_seed.sql',
    @notes       = 'Capabilities, roles, grants, sections, dropdowns, options, questions, system references. Users deliberately not seeded.';
GO
