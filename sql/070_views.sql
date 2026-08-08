/*==============================================================================
  SAIP — 070  Views
==============================================================================

  These exist so the Dataverse virtual tables and the app read a shape close to
  what they already use, instead of every consumer re-deriving the same joins.

  ONE CAVEAT ON VIRTUAL TABLES OVER VIEWS
  The SQL connector can surface a view, but a virtual table still needs a GUID
  or integer primary key — so every view below projects a single unambiguous id
  column suitable for that role. Where a view is read-only by nature it is
  marked, because Dataverse will happily offer create/update on something the
  database cannot honour.

==============================================================================*/

/*----------------------------------------------------------------------------
  vw_user_access — a person and everything they can reach
  ---------------------------------------------------------------------------
  The question the app actually asks on sign-in: "who is this and what may they
  see". One row per user per capability.
----------------------------------------------------------------------------*/
CREATE OR ALTER VIEW saip.vw_user_access
AS
SELECT
    u.user_id,
    u.user_key,
    u.display_name,
    u.email,
    u.is_active,
    u.last_active_on,
    r.role_id,
    r.role_key,
    r.name           AS role_name,
    r.is_administrator,
    c.capability_key,
    c.label          AS capability_label
FROM saip.[user]        u
INNER JOIN saip.user_role       ur ON ur.user_id       = u.user_id
INNER JOIN saip.[role]          r  ON r.role_id        = ur.role_id
LEFT  JOIN saip.role_capability rc ON rc.role_id       = r.role_id
LEFT  JOIN saip.capability      c  ON c.capability_id  = rc.capability_id
WHERE r.is_active = 1;
GO

/*----------------------------------------------------------------------------
  vw_incentive — the list shape, with status derived
  ---------------------------------------------------------------------------
  `status` is computed here rather than stored, for the reason given in 050:
  an incentive is historical because its end date passed, not because a job
  remembered to flip a column.
----------------------------------------------------------------------------*/
CREATE OR ALTER VIEW saip.vw_incentive
AS
SELECT
    i.incentive_id,
    i.incentive_key,
    i.title,
    i.overview,
    i.campaign_code,
    o.label                                  AS incentive_type,
    i.start_date,
    i.end_date,
    CASE
        WHEN i.end_date IS NULL              THEN 'active'
        WHEN i.end_date >= CONVERT(date, SYSUTCDATETIME()) THEN 'active'
        ELSE 'historical'
    END                                      AS status,
    (SELECT COUNT(*) FROM saip.incentive_account  a WHERE a.incentive_id = i.incentive_id) AS nominated_account_count,
    (SELECT COUNT(*) FROM saip.incentive_user     x WHERE x.incentive_id = i.incentive_id) AS assigned_user_count,
    (SELECT COUNT(*) FROM saip.incentive_role     x WHERE x.incentive_id = i.incentive_id) AS assigned_role_count,
    (SELECT COUNT(*) FROM saip.incentive_resource x WHERE x.incentive_id = i.incentive_id) AS resource_count,
    i.created_on,
    i.modified_on
FROM saip.incentive i
INNER JOIN saip.[option] o ON o.option_id = i.type_option_id;
GO

/*----------------------------------------------------------------------------
  vw_user_incentive — "My Incentives", with the REASON
  ---------------------------------------------------------------------------
  A person reaches an incentive two ways: named directly, or by holding an
  assigned role. The view returns both and says which, because "why am I seeing
  this?" is otherwise unanswerable from the UI.

  UNION rather than UNION ALL: someone named directly AND covered by a role
  would otherwise appear twice. The `assignment_reason` differs between the two
  branches, so the row is kept per reason — which is what the card renders.
----------------------------------------------------------------------------*/
CREATE OR ALTER VIEW saip.vw_user_incentive
AS
SELECT
    /*
      MD5, not SHA2_256, and cast to uniqueidentifier rather than left as
      varbinary — MD5 returns exactly 16 bytes, which is a GUID.

      This is not a security hash, it is a surrogate key, and it has to BE a
      GUID: a virtual table's primary key must be a GUID or an integer, so the
      varbinary(32) this used to project would have made the view unusable as
      one. Collision risk on a few thousand assignment rows is not a real
      consideration; failing to write is.
    */
    CAST(HASHBYTES('MD5',
         CONVERT(nvarchar(50), iu.user_id) + '|' +
         CONVERT(nvarchar(50), iu.incentive_id) + '|direct') AS uniqueidentifier) AS user_incentive_id,
    iu.user_id,
    iu.incentive_id,
    'direct'      AS assignment_reason,
    CAST(NULL AS uniqueidentifier) AS via_role_id,
    CAST(NULL AS nvarchar(200))    AS via_role_name
FROM saip.incentive_user iu

UNION

SELECT
    CAST(HASHBYTES('MD5',
         CONVERT(nvarchar(50), ur.user_id) + '|' +
         CONVERT(nvarchar(50), ir.incentive_id) + '|' +
         CONVERT(nvarchar(50), r.role_id)) AS uniqueidentifier),
    ur.user_id,
    ir.incentive_id,
    'role',
    r.role_id,
    r.name
FROM saip.incentive_role ir
INNER JOIN saip.user_role ur ON ur.role_id = ir.role_id
INNER JOIN saip.[role]    r  ON r.role_id  = ir.role_id
WHERE r.is_active = 1;
GO

/*----------------------------------------------------------------------------
  vw_account_monitoring_wide — the old fixed-column shape, rebuilt
  ---------------------------------------------------------------------------
  030 stores answers one row per question, which is what makes the question set
  configurable. Reporting and anything expecting the prototype's shape still
  wants one row per account, so this pivots it back.

  READ-ONLY. Do not surface this as a writable virtual table — a pivot has no
  sensible update path. Writes go to saip.account_monitoring_answer.

  The column list names the SEEDED questions explicitly. That is the honest
  trade of the EAV design: a question added by an administrator appears in the
  answer table immediately and in this view only when someone extends it. The
  app reads the answer table, so nothing on screen depends on this.
----------------------------------------------------------------------------*/
CREATE OR ALTER VIEW saip.vw_account_monitoring_wide
AS
SELECT
    m.account_external_id,
    MAX(CASE WHEN q.question_key = 'mon-stakeholder-meeting' THEN a.value_date END) AS last_stakeholder_meeting,
    MAX(CASE WHEN q.question_key = 'mon-workshop'            THEN a.value_date END) AS last_workshop,
    MAX(CASE WHEN q.question_key = 'mon-spend-review'        THEN a.value_date END) AS last_spend_or_sla_review,
    MAX(CASE WHEN q.question_key = 'mon-customer-visit'      THEN a.value_date END) AS last_customer_visit,
    MAX(CASE WHEN q.question_key = 'mon-performance-review'  THEN a.value_date END) AS last_performance_review,
    MAX(CASE WHEN q.question_key = 'mon-exec-engagement'     THEN a.value_date END) AS last_executive_engagement,
    MAX(CASE WHEN q.question_key = 'mon-sponsor-review'      THEN a.value_date END) AS last_service_review_with_sponsor,
    m.last_reviewed_on,
    m.last_reviewed_by
FROM saip.account_monitoring m
LEFT JOIN saip.account_monitoring_answer a ON a.account_external_id = m.account_external_id
LEFT JOIN saip.question                  q ON q.question_id         = a.question_id
GROUP BY m.account_external_id, m.last_reviewed_on, m.last_reviewed_by;
GO

/*----------------------------------------------------------------------------
  vw_overdue_monitoring — where notifications come from
  ---------------------------------------------------------------------------
  A notification is a question asked of the data, not a stored record. This view
  IS the notification list.

  A MISSING ANSWER COUNTS AS OVERDUE, and that is the important case: a question
  never answered is not "unknown, assume fine", it is the strongest possible
  signal that nobody has done the thing. The LEFT JOIN plus the null branch is
  what expresses that, and it is why the account header table exists — without a
  row per account there would be nothing to left-join FROM.

  The threshold is a parameter of the read, not of the data: the caller passes
  the user's own `overdue_after_months`. The view exposes the age in months and
  lets the caller compare, so one view serves every threshold.
----------------------------------------------------------------------------*/
CREATE OR ALTER VIEW saip.vw_overdue_monitoring
AS
SELECT
    m.account_external_id,
    q.question_id,
    q.question_key,
    q.label                AS question_label,
    a.value_date           AS last_answered_date,
    CASE
        WHEN a.value_date IS NULL THEN NULL
        ELSE DATEDIFF(month, a.value_date, CONVERT(date, SYSUTCDATETIME()))
    END                    AS months_since,
    /* Never recorded is the severe case; overdue-but-recorded is the softer one.
       Matches the severity the notification pane already renders. */
    CASE WHEN a.value_date IS NULL THEN 'critical' ELSE 'warning' END AS severity
FROM saip.account_monitoring m
CROSS JOIN saip.question q
INNER JOIN saip.question_section s
        ON s.section_id = q.section_id
       AND s.area = 'account-monitoring'
       AND s.is_enabled = 1
LEFT  JOIN saip.account_monitoring_answer a
        ON a.account_external_id = m.account_external_id
       AND a.question_id         = q.question_id
WHERE q.is_enabled = 1
  AND q.input_type = 'date';
GO

/*----------------------------------------------------------------------------
  vw_incentive_opportunity — MOVED TO 080
  ---------------------------------------------------------------------------
  This used to be a guarded view over a hypothetical `dbo.opportunity`, written
  before the shape of the CRM feed was known.

  It is now built in `080_upstream_views.sql` over the real thing —
  `saip.Opportunities`, the Salesforce dataflow destination — which lands in the
  saip schema at product line-item grain rather than in dbo at header grain.
  Both of those differences mattered enough that guessing was worse than
  waiting.

  Nothing to do here. 080 creates it.
----------------------------------------------------------------------------*/

EXEC saip.log_deployment
    @script_name = '070_views.sql',
    @notes       = 'vw_user_access, vw_incentive, vw_user_incentive, vw_account_monitoring_wide, vw_overdue_monitoring.';
GO
