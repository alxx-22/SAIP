/*==============================================================================
  SAIP — 080  Views over the upstream dataflow tables
==============================================================================

  Two Dataflow Gen2 destinations land in this database:

      saip.[FY26 Alignments MAIN]   accounts and their sales alignments
      saip.Opportunities            Salesforce export, PRODUCT LINE grain

  Nothing in SAIP reads either table directly. Everything goes through the
  views below, for four reasons that are all about the tables not being ours:

  1. THE NAMES ARE HOSTILE.  `[FY26 Alignments MAIN]` needs bracket-quoting in
     every query, and the fiscal-year prefix means the name changes at FY27.
     One view is one place to fix that instead of every consumer.

  2. THE TABLES GET DROPPED.  A Replace-mode refresh recreates them, taking any
     index or constraint with it. Views survive that; anything heavier would not.
     This is also why no foreign key points at either table.

  3. VIRTUAL TABLES NEED A GUID KEY.  Neither table has a primary key, so each
     view projects one built with MD5 — 16 bytes, which is exactly a GUID, and
     deterministic, so the same source row gets the same key on every refresh.

  4. THE GRAIN IS WRONG FOR THE APP.  `Opportunities` is one row per product per
     opportunity. The portal shows opportunities, so the roll-up happens here,
     in SQL. Doing it in the browser would mean fetching every line through the
     Power Pages Web API, which pages at 5,000 rows and cannot aggregate.

  RE-RUNNABLE.  Every view is CREATE OR ALTER and each block is guarded on the
  source object existing, so this script is safe to run before a dataflow has
  ever executed — it prints what it skipped rather than failing.

  ─────────────────────────────────────────────────────────────────────────────
  TWO THINGS TO CONFIRM AGAINST REAL DATA — both are marked CONFIRM: below.
    - the real values in [Opportunity Sales Stage]
    - the column that actually carries the campaign code
==============================================================================*/

/*----------------------------------------------------------------------------
  vw_account_alignment — accounts and who covers them
  ---------------------------------------------------------------------------
  `Company Group ID` is the id everything else joins on. On the Opportunities
  table the same value is called `Country Sales Entity ID`; both are aliased to
  `company_group_id` so the join reads the same in every query.

  Only the columns confirmed present are mapped. The alignments table has more
  than these — add them here as they are needed rather than SELECT *, which
  would silently change shape the first time the dataflow's own query changes.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.FY26 Alignments MAIN', 'U') IS NULL
    PRINT 'SKIPPED saip.vw_account_alignment — saip.[FY26 Alignments MAIN] not found. Run the alignments dataflow, then re-run this script.';
ELSE
EXEC sp_executesql N'
CREATE OR ALTER VIEW saip.vw_account_alignment
AS
SELECT
    /* Deterministic GUID over the business key — see note 3 in the header. */
    CAST(HASHBYTES(''MD5'', CONVERT(nvarchar(4000), a.[Company Group ID])) AS uniqueidentifier)
                                              AS alignment_id,
    a.[Company Group ID]                      AS company_group_id,
    a.[Company Group Name]                    AS company_group_name,
    a.[OS SPECIALIST ID]                      AS specialist_id,
    a.[OS Sales Name]                         AS specialist_name,
    a.[OS Sales Email]                        AS specialist_email,
    a.[OS Manager ID]                         AS manager_id,
    a.[OS Manager Name]                       AS manager_name,
    a.[OS Manager Email]                      AS manager_email
FROM saip.[FY26 Alignments MAIN] a
WHERE a.[Company Group ID] IS NOT NULL;';
GO

IF OBJECT_ID('saip.vw_account_alignment', 'V') IS NOT NULL
    PRINT 'Created saip.vw_account_alignment';
GO

/*----------------------------------------------------------------------------
  vw_opportunity_line — the raw grain, cleaned up
  ---------------------------------------------------------------------------
  One row per product per opportunity, which is what the source actually is.
  Reporting wants this; the portal does not.

  TYPES. Almost every column in the source arrives as text, including the dates.
  `Close Date` is the one real `date`. Everything else date-like is converted
  with TRY_CONVERT, which yields NULL rather than failing the whole query on one
  malformed value — a hard CONVERT would take the entire view down because of a
  single bad row in a table nobody here controls.

  LINE KEY. The source has no line identifier and the same product can legitimately
  appear twice on one opportunity, so ROW_NUMBER disambiguates before hashing.
  Stable for as long as the underlying rows are, which is all a read-only view
  can honestly offer.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.Opportunities', 'U') IS NULL
    PRINT 'SKIPPED saip.vw_opportunity_line — saip.Opportunities not found. Run the opportunity dataflow, then re-run this script.';
ELSE
EXEC sp_executesql N'
CREATE OR ALTER VIEW saip.vw_opportunity_line
AS
WITH numbered AS (
    SELECT
        o.*,
        ROW_NUMBER() OVER (
            PARTITION BY o.[Opportunity ID], o.[Product Name]
            ORDER BY (SELECT NULL)
        ) AS line_seq
    FROM saip.Opportunities o
    WHERE o.[Opportunity ID] IS NOT NULL
)
SELECT
    CAST(HASHBYTES(''MD5'', CONCAT(
        CONVERT(nvarchar(200), n.[Opportunity ID]), ''|'',
        CONVERT(nvarchar(400), n.[Product Name]), ''|'',
        CONVERT(nvarchar(20),  n.line_seq)
    )) AS uniqueidentifier)                        AS line_id,

    n.[Opportunity ID]                             AS opportunity_id,
    n.[HPE Opportunity Id]                         AS opportunity_number,
    n.[Opportunity Name]                           AS opportunity_name,
    n.[Opportunity Description]                    AS opportunity_description,

    /* THE JOIN KEY. Same value the alignments table calls Company Group ID. */
    n.[Country Sales Entity ID]                    AS company_group_id,
    n.[Account ID]                                 AS account_id,
    n.[Account ST ID]                              AS account_st_id,
    n.[Account Name]                               AS account_name,

    n.[Product Name]                               AS product_name,
    n.[FY26 Product Table.Level 1]                 AS product_level_1,
    n.[FY26 Product Table.Level 2]                 AS product_level_2,
    n.[FY26 Product Table.Level 3]                 AS product_level_3,

    n.[Value (converted)]                          AS line_value,
    n.[Value (converted) Currency]                 AS line_currency,
    n.[Total Value to HPE (converted)]             AS opportunity_total_value,
    n.[Total Value to HPE (converted) Currency]    AS opportunity_currency,
    n.[HPE Sub Total (converted)]                  AS opportunity_sub_total,

    n.[Opportunity Sales Stage]                    AS stage_raw,
    n.[Forecast Category]                          AS forecast_category,
    n.[Close Date]                                 AS close_date,
    TRY_CONVERT(date, n.[Won/Lost Date])           AS won_lost_date,
    n.[Won/Lost Reason]                            AS won_lost_reason,

    n.[Opportunity Owner]                          AS owner_name,
    n.[Opportunity Owner Email]                    AS owner_email,
    n.[Sales Motion]                               AS sales_motion,
    n.[Go To Market Route]                         AS go_to_market_route,
    n.[Primary Campaign Name]                      AS campaign_name,
    n.[Campaign Influence id]                      AS campaign_influence_id,
    n.[Program]                                    AS program,
    TRY_CONVERT(date, n.[Created Date])            AS created_date,
    TRY_CONVERT(date, n.[Last Modified Date])      AS last_modified_date
FROM numbered n;';
GO

IF OBJECT_ID('saip.vw_opportunity_line', 'V') IS NOT NULL
    PRINT 'Created saip.vw_opportunity_line';
GO

/*----------------------------------------------------------------------------
  vw_account_opportunity — WHAT THE PORTAL READS
  ---------------------------------------------------------------------------
  One row per opportunity. This is the view behind
  `AccountService.getAccountOpportunities`, and the shape its TypeScript type
  mirrors field for field.

  Header columns repeat identically on every line of an opportunity, so MAX()
  collapses them. That is a deduplication, not an aggregation — the only true
  aggregates here are line_count and line_subtotal.

  LINE SUBTOTAL IS NOT THE OPPORTUNITY VALUE, and the two are kept apart on
  purpose. `Total Value to HPE` includes elements that never appear as a product
  line, so the figures genuinely differ in the source. The portal shows both and
  labels which is which; collapsing them to one number here would bake in a
  reconciliation nobody has agreed.

  CONFIRM: `stage` normalises [Opportunity Sales Stage] onto the five values the
  front end uses (see OPPORTUNITY_STAGES in src/services/types.ts, and the
  `is_code_dependent` flag on that option set — the app still matches these by
  exact text). The CASE below covers the common Salesforce spellings. Run the
  DISTINCT query at the bottom of this file against real data and extend it;
  anything unmatched falls through to ''Qualify'' rather than NULL, so a stage
  this CASE has never seen shows up as early-pipeline instead of vanishing from
  every filter.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.vw_opportunity_line', 'V') IS NULL
    PRINT 'SKIPPED saip.vw_account_opportunity — depends on saip.vw_opportunity_line.';
ELSE
EXEC sp_executesql N'
CREATE OR ALTER VIEW saip.vw_account_opportunity
AS
SELECT
    CAST(HASHBYTES(''MD5'', CONVERT(nvarchar(200), l.opportunity_id)) AS uniqueidentifier)
                                          AS opportunity_key,
    l.opportunity_id,
    MAX(l.opportunity_number)             AS opportunity_number,
    MAX(l.opportunity_name)               AS opportunity_name,
    MAX(l.opportunity_description)        AS opportunity_description,
    l.company_group_id,
    MAX(l.account_id)                     AS account_id,
    MAX(l.account_name)                   AS account_name,

    MAX(l.stage_raw)                      AS stage_raw,
    CASE
        WHEN MAX(l.stage_raw) LIKE ''%won%''        THEN ''Closed won''
        WHEN MAX(l.stage_raw) LIKE ''%lost%''       THEN ''Closed lost''
        WHEN MAX(l.stage_raw) LIKE ''%negotiat%''   THEN ''Negotiate''
        WHEN MAX(l.stage_raw) LIKE ''%propos%''     THEN ''Propose''
        WHEN MAX(l.stage_raw) LIKE ''%qualif%''     THEN ''Qualify''
        ELSE ''Qualify''
    END                                   AS stage,
    MAX(l.forecast_category)              AS forecast_category,
    MAX(l.close_date)                     AS close_date,
    MAX(l.won_lost_date)                  AS won_lost_date,

    MAX(l.opportunity_total_value)        AS total_value,
    MAX(l.opportunity_currency)           AS currency,
    SUM(l.line_value)                     AS line_subtotal,
    COUNT(*)                              AS line_count,

    MAX(l.owner_name)                     AS owner_name,
    MAX(l.owner_email)                    AS owner_email,
    MAX(l.sales_motion)                   AS sales_motion,
    MAX(l.campaign_name)                  AS campaign_name
FROM saip.vw_opportunity_line l
GROUP BY l.opportunity_id, l.company_group_id;';
GO

IF OBJECT_ID('saip.vw_account_opportunity', 'V') IS NOT NULL
    PRINT 'Created saip.vw_account_opportunity';
GO

/*----------------------------------------------------------------------------
  vw_account_pipeline — one row per account, for every value figure on screen
  ---------------------------------------------------------------------------
  THIS IS THE ONE THAT KEEPS THE PORTAL FAST. Every headline number — open
  pipeline, won value, opportunity count — is computed here so the browser
  fetches ONE ROW PER ACCOUNT instead of thousands of product lines.

  Surface it as a read-only virtual table. `pipeline_id` is the GUID key.

  Open vs closed is decided on the normalised stage rather than on close date:
  a deal past its close date is a stale forecast, not a closed one, and treating
  it as closed would quietly delete it from the pipeline it should be dragging
  down.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.vw_account_opportunity', 'V') IS NULL
    PRINT 'SKIPPED saip.vw_account_pipeline — depends on saip.vw_account_opportunity.';
ELSE
EXEC sp_executesql N'
CREATE OR ALTER VIEW saip.vw_account_pipeline
AS
SELECT
    CAST(HASHBYTES(''MD5'', CONVERT(nvarchar(200), o.company_group_id)) AS uniqueidentifier)
                                                        AS pipeline_id,
    o.company_group_id,
    MAX(o.account_name)                                 AS account_name,
    MAX(o.currency)                                     AS currency,

    COUNT(*)                                            AS opportunity_count,
    SUM(CASE WHEN o.stage IN (''Qualify'',''Propose'',''Negotiate'') THEN 1 ELSE 0 END)
                                                        AS open_count,
    SUM(CASE WHEN o.stage IN (''Qualify'',''Propose'',''Negotiate'')
             THEN o.total_value ELSE 0 END)             AS open_pipeline_value,
    SUM(CASE WHEN o.stage = ''Closed won''  THEN o.total_value ELSE 0 END)
                                                        AS won_value,
    SUM(CASE WHEN o.stage = ''Closed lost'' THEN o.total_value ELSE 0 END)
                                                        AS lost_value,

    /* The two dates a rep asks for first: what closes next, and how stale the
       forecast is. Both restricted to open work — a closed deal in the past is
       not news. */
    MIN(CASE WHEN o.stage IN (''Qualify'',''Propose'',''Negotiate'')
             THEN o.close_date END)                     AS next_close_date,
    SUM(CASE WHEN o.stage IN (''Qualify'',''Propose'',''Negotiate'')
              AND o.close_date < CONVERT(date, SYSUTCDATETIME())
             THEN 1 ELSE 0 END)                         AS slipped_count
FROM saip.vw_account_opportunity o
WHERE o.company_group_id IS NOT NULL
GROUP BY o.company_group_id;';
GO

IF OBJECT_ID('saip.vw_account_pipeline', 'V') IS NOT NULL
    PRINT 'Created saip.vw_account_pipeline';
GO

/*----------------------------------------------------------------------------
  vw_incentive_opportunity — incentives joined to real CRM opportunities
  ---------------------------------------------------------------------------
  Supersedes the placeholder in 070_views.sql, which pointed at a
  `dbo.opportunity` object that was never going to exist.

  CONFIRM: the join is on `campaign_name`. The Opportunities table has three
  campaign-shaped columns — [Primary Campaign Name], [Campaign Influence id] and
  [Program] — and which one carries the code an incentive is created with is a
  question for whoever runs the campaigns. Change the ON clause here once, and
  every consumer follows.

  Matching is case-insensitive already, because the database collation is
  CI_AS. Trimmed on both sides, because campaign names typed by hand pick up
  trailing spaces and an invisible space is a miserable thing to debug.
----------------------------------------------------------------------------*/
IF OBJECT_ID('saip.vw_account_opportunity', 'V') IS NULL
    PRINT 'SKIPPED saip.vw_incentive_opportunity — depends on saip.vw_account_opportunity.';
ELSE
EXEC sp_executesql N'
CREATE OR ALTER VIEW saip.vw_incentive_opportunity
AS
SELECT
    CAST(HASHBYTES(''MD5'', CONCAT(
        CONVERT(nvarchar(50), i.incentive_id), ''|'',
        CONVERT(nvarchar(200), o.opportunity_id)
    )) AS uniqueidentifier)          AS incentive_opportunity_id,
    i.incentive_id,
    i.incentive_key,
    i.campaign_code,
    o.opportunity_id,
    o.opportunity_number,
    o.opportunity_name,
    o.company_group_id,
    o.account_name,
    o.stage,
    o.total_value,
    o.currency,
    o.close_date,
    o.owner_name
FROM saip.incentive i
INNER JOIN saip.vw_account_opportunity o
        ON LTRIM(RTRIM(o.campaign_name)) = LTRIM(RTRIM(i.campaign_code))
WHERE i.campaign_code IS NOT NULL;';
GO

IF OBJECT_ID('saip.vw_incentive_opportunity', 'V') IS NOT NULL
    PRINT 'Created saip.vw_incentive_opportunity (over saip.Opportunities)';
GO

EXEC saip.log_deployment
    @script_name = '080_upstream_views.sql',
    @notes       = 'vw_account_alignment, vw_opportunity_line, vw_account_opportunity, vw_account_pipeline, vw_incentive_opportunity.';
GO

/*==============================================================================
  RUN THESE TWO BY HAND once the dataflows have populated, and act on them.
==============================================================================

-- 1. The real stage values. Extend the CASE in vw_account_opportunity to match.
SELECT [Opportunity Sales Stage] AS stage_raw, COUNT(*) AS rows_
FROM saip.Opportunities
GROUP BY [Opportunity Sales Stage]
ORDER BY rows_ DESC;

-- 2. Does every opportunity's account exist in the alignments table?
--    Rows here are opportunities the portal cannot attribute to an account —
--    they will be invisible on every account page until the alignment lands.
SELECT TOP (200) o.company_group_id, MAX(o.account_name) AS account_name, COUNT(*) AS opportunities
FROM saip.vw_account_opportunity o
LEFT JOIN saip.vw_account_alignment a ON a.company_group_id = o.company_group_id
WHERE a.company_group_id IS NULL
GROUP BY o.company_group_id
ORDER BY opportunities DESC;

==============================================================================*/
