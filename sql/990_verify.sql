/*==============================================================================
  SAIP — 990  Verification
==============================================================================

  Run after a deployment. Every check prints PASS or FAIL with a count, so the
  output can be read at a glance and pasted into a deployment record.

  Nothing here modifies data.

  The checks fall into three groups:
    1. Structure    — did everything get created
    2. Seed         — does the configuration match what the app expects
    3. Integrity    — the rules the engine cannot express, especially the ones
                      that cross the boundary into tables we do not own

  Group 3 matters most. Foreign keys cover everything inside this database;
  what they cannot cover is a reference to an account or a campaign code that
  lives in a mirrored table, and that is exactly where a silent inconsistency
  would come from.

==============================================================================*/

SET NOCOUNT ON;
DECLARE @fail int = 0, @n int;

PRINT '--- 1. Structure -----------------------------------------------------';

;WITH expected (object_name, object_type) AS
(
    SELECT * FROM (VALUES
        ('saip.capability','U'),('saip.role','U'),('saip.role_capability','U'),
        ('saip.user','U'),('saip.user_role','U'),
        ('saip.question_section','U'),('saip.option_set','U'),('saip.option','U'),
        ('saip.question','U'),('saip.question_system_reference','U'),
        ('saip.account_monitoring','U'),('saip.account_monitoring_answer','U'),
        ('saip.account_monitoring_answer_option','U'),
        ('saip.meeting','U'),('saip.meeting_tag','U'),('saip.meeting_answer','U'),
        ('saip.incentive','U'),('saip.incentive_account','U'),
        ('saip.incentive_user','U'),('saip.incentive_role','U'),
        ('saip.incentive_resource','U'),
        ('saip.user_preference','U'),
        ('saip.vw_user_access','V'),('saip.vw_incentive','V'),
        ('saip.vw_user_incentive','V'),('saip.vw_account_monitoring_wide','V'),
        ('saip.vw_overdue_monitoring','V')
    ) v (object_name, object_type)
)
SELECT @n = COUNT(*) FROM expected e
WHERE OBJECT_ID(e.object_name, e.object_type) IS NULL;
PRINT IIF(@n = 0, 'PASS  every expected table and view exists',
                  CONCAT('FAIL  ', @n, ' expected object(s) missing'));
SET @fail += IIF(@n = 0, 0, 1);

/* The virtual-table rule from 000: a GUID or integer primary key, or writes
   fail at runtime with "No primary key exists in table". Worth asserting rather
   than trusting, because the failure surfaces only when a user first saves. */
SELECT @n = COUNT(*)
FROM sys.tables t
INNER JOIN sys.indexes i     ON i.object_id = t.object_id AND i.is_primary_key = 1
INNER JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = i.index_id
INNER JOIN sys.columns c     ON c.object_id = t.object_id AND c.column_id = ic.column_id
INNER JOIN sys.types ty      ON ty.user_type_id = c.user_type_id
WHERE SCHEMA_NAME(t.schema_id) = 'saip'
  AND ty.name NOT IN ('uniqueidentifier','int','bigint','smallint');
PRINT IIF(@n = 0, 'PASS  every primary key is GUID or integer (Dataverse virtual table rule)',
                  CONCAT('FAIL  ', @n, ' table(s) have a primary key Dataverse cannot write through'));
SET @fail += IIF(@n = 0, 0, 1);

/* Composite primary keys are equally fatal for a virtual table. */
SELECT @n = COUNT(*)
FROM (
    SELECT i.object_id
    FROM sys.tables t
    INNER JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
    INNER JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = i.index_id
    WHERE SCHEMA_NAME(t.schema_id) = 'saip'
    GROUP BY i.object_id
    HAVING COUNT(*) > 1
) x;
PRINT IIF(@n = 0, 'PASS  no composite primary keys',
                  CONCAT('FAIL  ', @n, ' table(s) have a composite primary key'));
SET @fail += IIF(@n = 0, 0, 1);

PRINT '';
PRINT '--- 2. Seed ----------------------------------------------------------';

SELECT @n = COUNT(*) FROM saip.capability;
PRINT IIF(@n = 9, 'PASS  9 capabilities', CONCAT('FAIL  expected 9 capabilities, found ', @n));
SET @fail += IIF(@n = 9, 0, 1);

SELECT @n = COUNT(*) FROM saip.[role];
PRINT IIF(@n = 6, 'PASS  6 roles', CONCAT('FAIL  expected 6 roles, found ', @n));
SET @fail += IIF(@n = 6, 0, 1);

SELECT @n = COUNT(*) FROM saip.[role] WHERE is_administrator = 1;
PRINT IIF(@n = 1, 'PASS  exactly one administrator role',
                  CONCAT('FAIL  expected 1 administrator role, found ', @n));
SET @fail += IIF(@n = 1, 0, 1);

/* The administrator role must be able to reach the admin portal, or nobody can
   grant anything ever again. */
SELECT @n = COUNT(*)
FROM saip.[role] r
INNER JOIN saip.role_capability rc ON rc.role_id = r.role_id
INNER JOIN saip.capability c ON c.capability_id = rc.capability_id
WHERE r.is_administrator = 1 AND c.capability_key = 'admin.access';
PRINT IIF(@n = 1, 'PASS  the administrator role holds admin.access',
                  'FAIL  the administrator role cannot reach the admin portal');
SET @fail += IIF(@n = 1, 0, 1);

SELECT @n = COUNT(*) FROM saip.question;
PRINT IIF(@n = 12, 'PASS  12 questions', CONCAT('FAIL  expected 12 questions, found ', @n));
SET @fail += IIF(@n = 12, 0, 1);

SELECT @n = COUNT(*) FROM saip.[option];
PRINT IIF(@n = 23, 'PASS  23 dropdown options', CONCAT('FAIL  expected 23 options, found ', @n));
SET @fail += IIF(@n = 23, 0, 1);

/* The keys the front end joins on. If any of these is absent the app will
   render a form with a missing field and no error anywhere. */
;WITH required_keys (k) AS
(
    SELECT * FROM (VALUES
        ('mon-stakeholder-meeting'),('mon-workshop'),('mon-spend-review'),
        ('mon-customer-visit'),('mon-performance-review'),
        ('mon-exec-engagement'),('mon-sponsor-review'),
        ('meet-date'),('meet-place'),('meet-subject'),('meet-comments'),('meet-tags')
    ) v (k)
)
SELECT @n = COUNT(*) FROM required_keys rk
WHERE NOT EXISTS (SELECT 1 FROM saip.question q WHERE q.question_key = rk.k);
PRINT IIF(@n = 0, 'PASS  every question key the front end expects is present',
                  CONCAT('FAIL  ', @n, ' expected question key(s) missing'));
SET @fail += IIF(@n = 0, 0, 1);

SELECT @n = COUNT(*) FROM saip.question_system_reference;
PRINT IIF(@n >= 2, 'PASS  notification-driving questions are marked as referenced',
                   'FAIL  no question_system_reference rows — the admin portal will allow hiding a question a notification needs');
SET @fail += IIF(@n >= 2, 0, 1);

PRINT '';
PRINT '--- 3. Integrity -----------------------------------------------------';

/* A choice question with no list renders an empty picker. */
SELECT @n = COUNT(*) FROM saip.question
WHERE input_type IN ('choice','multichoice') AND option_set_id IS NULL;
PRINT IIF(@n = 0, 'PASS  every dropdown question has a list behind it',
                  CONCAT('FAIL  ', @n, ' dropdown question(s) have no option set'));
SET @fail += IIF(@n = 0, 0, 1);

/* An enabled list with nothing selectable is a picker that opens onto nothing. */
SELECT @n = COUNT(*) FROM saip.option_set os
WHERE EXISTS (SELECT 1 FROM saip.question q WHERE q.option_set_id = os.option_set_id AND q.is_enabled = 1)
  AND NOT EXISTS (SELECT 1 FROM saip.[option] o WHERE o.option_set_id = os.option_set_id AND o.is_enabled = 1);
PRINT IIF(@n = 0, 'PASS  every in-use dropdown has at least one selectable option',
                  CONCAT('FAIL  ', @n, ' in-use dropdown(s) have nothing selectable'));
SET @fail += IIF(@n = 0, 0, 1);

/* An answer whose value column disagrees with the question type reads as null
   to every typed query — the answer is present but invisible. The trigger in
   030 prevents new ones; this catches anything loaded around it. */
SELECT @n = COUNT(*)
FROM saip.account_monitoring_answer a
INNER JOIN saip.question q ON q.question_id = a.question_id
WHERE (q.input_type = 'date'    AND a.value_date      IS NULL)
   OR (q.input_type = 'number'  AND a.value_number    IS NULL)
   OR (q.input_type = 'boolean' AND a.value_bit       IS NULL)
   OR (q.input_type = 'choice'  AND a.value_option_id IS NULL)
   OR (q.input_type IN ('text','longtext') AND a.value_text IS NULL);
PRINT IIF(@n = 0, 'PASS  every monitoring answer is in the column its question type expects',
                  CONCAT('FAIL  ', @n, ' answer(s) are stored in the wrong value column'));
SET @fail += IIF(@n = 0, 0, 1);

/* Every answer needs a header row, or vw_overdue_monitoring cannot left-join
   from the account and a never-answered question stops being reported. */
SELECT @n = COUNT(DISTINCT a.account_external_id)
FROM saip.account_monitoring_answer a
WHERE NOT EXISTS (SELECT 1 FROM saip.account_monitoring m
                  WHERE m.account_external_id = a.account_external_id);
PRINT IIF(@n = 0, 'PASS  every answered account has a monitoring header row',
                  CONCAT('FAIL  ', @n, ' account(s) have answers but no header row'));
SET @fail += IIF(@n = 0, 0, 1);

/* Assignment hygiene: naming someone who is also covered by an assigned role
   is harmless but misleading, and the admin portal warns about it. */
SELECT @n = COUNT(*)
FROM saip.incentive_user iu
WHERE EXISTS
(
    SELECT 1 FROM saip.incentive_role ir
    INNER JOIN saip.user_role ur ON ur.role_id = ir.role_id
    WHERE ir.incentive_id = iu.incentive_id AND ur.user_id = iu.user_id
);
PRINT IIF(@n = 0, 'PASS  no redundant direct assignments',
                  CONCAT('INFO  ', @n, ' direct assignment(s) are already covered by a role — harmless, but the list reads longer than it is'));

/* Users with no role at all can sign in and see nothing. */
SELECT @n = COUNT(*)
FROM saip.[user] u
WHERE u.is_active = 1
  AND NOT EXISTS (SELECT 1 FROM saip.user_role ur WHERE ur.user_id = u.user_id);
PRINT IIF(@n = 0, 'PASS  every active user holds at least one role',
                  CONCAT('FAIL  ', @n, ' active user(s) hold no role and will see an empty portal'));
SET @fail += IIF(@n = 0, 0, 1);

PRINT '';
PRINT '--- 4. Cross-boundary references (cannot be enforced by FK) -----------';
PRINT 'These point at accounts and campaign codes mastered outside this';
PRINT 'database. Compare them against the mirrored tables by hand, or extend';
PRINT 'these queries once the mirrored object names are known.';
PRINT '';

SELECT @n = COUNT(DISTINCT account_external_id) FROM
(
    SELECT account_external_id FROM saip.account_monitoring
    UNION SELECT account_external_id FROM saip.meeting
    UNION SELECT account_external_id FROM saip.incentive_account
) x;
PRINT CONCAT('INFO  ', @n, ' distinct account_external_id value(s) referenced');

SELECT @n = COUNT(*) FROM saip.incentive WHERE campaign_code IS NOT NULL;
PRINT CONCAT('INFO  ', @n, ' incentive(s) carry a campaign code to match opportunities on');

IF OBJECT_ID('saip.vw_incentive_opportunity', 'V') IS NULL
    PRINT 'INFO  saip.vw_incentive_opportunity not created — set @opportunity_object in 070_views.sql and re-run once the CRM mirror exists';
ELSE
    PRINT 'PASS  saip.vw_incentive_opportunity exists';

PRINT '';
PRINT '======================================================================';
PRINT IIF(@fail = 0, 'RESULT: PASS — deployment verified',
                     CONCAT('RESULT: FAIL — ', @fail, ' check(s) failed, see above'));
PRINT '======================================================================';
GO

SELECT script_name, applied_on, applied_by, notes
FROM saip.deployment_log
ORDER BY applied_on;
GO
