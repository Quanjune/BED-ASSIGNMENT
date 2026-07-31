-- ============================================================
-- Inspectionpage.sql          (Kaden - NEA inspections & hygiene grading)
--
-- Two tables:
--   Inspections    - an NEA officer schedules a visit to a stall, then
--                    records the outcome once the visit has happened.
--   HygieneGrades  - the grade issued as a result of a completed
--                    inspection. A stall keeps every historical row, which
--                    is what makes "historical hygiene grade tracking"
--                    possible rather than just storing one current grade.
--
-- ADDITIVE + RE-RUNNABLE. It drops only its own two tables first, the same
-- way masterdata_timely.sql and promoCodes.sql do, so running it twice no
-- longer errors with "There is already an object named 'Inspections'".
--
-- RUN ORDER
--   1) qj and kishore masterdata.sql   (master - FoodStalls + Users)
--   2) masterdata_timely.sql
--   3) orders_promo_columns.sql
--   4) officer_role.sql                (adds the 'officer' role + accounts)
--   5) Inspectionpage.sql              (this file)
--
-- officer_role.sql MUST run first: officerId below is a foreign key to
-- Users, and the sample data looks the officers up by their email address.
-- ============================================================
USE HawkersDB;
GO

-- ------------------------------------------------------------
-- 0) SAFETY CHECK
-- ------------------------------------------------------------
-- One readable message instead of a pile of foreign key errors if the
-- earlier scripts have not been run. Same guard style as
-- masterdata_timely.sql: RAISERROR prints the message, then SET NOEXEC ON
-- makes SQL Server compile the rest of the file without running any of it.
-- It is switched off again at the very bottom.
IF OBJECT_ID('dbo.FoodStalls', 'U') IS NULL
BEGIN
    RAISERROR('FoodStalls not found. Run "qj and kishore masterdata.sql" first - Inspections references FoodStalls.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM Users WHERE role = 'officer')
BEGIN
    RAISERROR('No officer accounts found. Run "officer_role.sql" first - Inspections.officerId references Users.', 16, 1);
    SET NOEXEC ON;
END
GO

-- ------------------------------------------------------------
-- 1) DROP (children first)
-- ------------------------------------------------------------
-- HygieneGrades has a foreign key INTO Inspections, so it has to go first
-- or SQL Server refuses to drop the parent table.
IF OBJECT_ID('dbo.HygieneGrades', 'U') IS NOT NULL DROP TABLE dbo.HygieneGrades;
IF OBJECT_ID('dbo.Inspections',   'U') IS NOT NULL DROP TABLE dbo.Inspections;
GO

-- ------------------------------------------------------------
-- 2) TABLES
-- ------------------------------------------------------------
CREATE TABLE Inspections (
    inspectionId    INT IDENTITY(1,1) PRIMARY KEY,
    stallId         INT NOT NULL,
    -- The officer is a real user account, not a typed-in name. The back end
    -- takes this from the JWT, so an officer can never file an inspection
    -- under someone else's name. (Same principle as Kishore's vendor lane,
    -- where the stall comes from the token instead of the request body.)
    officerId       INT NOT NULL,
    scheduledDate   DATE NOT NULL,
    status          NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    completedDate   DATE NULL,
    score           INT NULL,
    remarks         NVARCHAR(500) NULL,
    -- When a stall fails (score below 55) the back end automatically books a
    -- re-inspection and points it back at the visit that failed, so the
    -- follow-up chain is visible in the data.
    followUpOf      INT NULL,
    createdAt       DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Inspections_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    CONSTRAINT FK_Inspections_Officer
        FOREIGN KEY (officerId) REFERENCES Users(userId),
    CONSTRAINT FK_Inspections_FollowUp
        FOREIGN KEY (followUpOf) REFERENCES Inspections(inspectionId),
    CONSTRAINT CK_Inspections_Status
        CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
    CONSTRAINT CK_Inspections_Score
        CHECK (score IS NULL OR score BETWEEN 0 AND 100),
    -- A completed inspection must actually carry a result.
    CONSTRAINT CK_Inspections_CompletedHasResult
        CHECK (status <> 'Completed' OR (completedDate IS NOT NULL AND score IS NOT NULL))
);
GO

CREATE TABLE HygieneGrades (
    gradeId       INT IDENTITY(1,1) PRIMARY KEY,
    stallId       INT NOT NULL,
    -- Nullable so a grade record survives even if the inspection that
    -- produced it is later deleted (ON DELETE SET NULL below), and so a
    -- manual corrective grade can exist without an inspection behind it.
    inspectionId  INT NULL,
    grade         CHAR(1) NOT NULL,
    validFrom     DATE NOT NULL,
    validTo       DATE NOT NULL,
    createdAt     DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_HygieneGrades_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    CONSTRAINT FK_HygieneGrades_Inspection
        FOREIGN KEY (inspectionId) REFERENCES Inspections(inspectionId)
        ON DELETE SET NULL,
    CONSTRAINT CK_HygieneGrades_Grade
        CHECK (grade IN ('A', 'B', 'C', 'D')),
    CONSTRAINT CK_HygieneGrades_Period
        CHECK (validTo > validFrom)
);
GO

-- ------------------------------------------------------------
-- 3) INDEXES
-- ------------------------------------------------------------
-- Every officer screen filters by stall or sorts by date, so these are the
-- columns worth indexing.
CREATE INDEX IX_Inspections_Stall    ON Inspections (stallId, scheduledDate DESC);
CREATE INDEX IX_Inspections_Officer  ON Inspections (officerId, scheduledDate);
CREATE INDEX IX_Inspections_Status   ON Inspections (status, scheduledDate);
CREATE INDEX IX_HygieneGrades_Stall  ON HygieneGrades (stallId, validFrom DESC);
GO

-- A FILTERED unique index: one stall cannot have two OPEN visits booked on
-- the same day. Cancelled and completed rows are excluded by the WHERE, so
-- history is untouched and a stall can still be re-inspected on a date it
-- was inspected before. The back end also checks this so the user gets a
-- readable message instead of a raw SQL error - this is the safety net.
CREATE UNIQUE INDEX UX_Inspections_OpenSlot
    ON Inspections (stallId, scheduledDate)
    WHERE status = 'Scheduled';
GO

-- ============================================================
-- 4) SAMPLE DATA
-- ============================================================
-- Dates are RELATIVE to GETDATE() instead of hard-coded. That way the
-- officer worklist always has something overdue, something due today and
-- something upcoming, no matter which week the demo is recorded in.
--
-- All of section 4 is a single batch (no GO in the middle) because the
-- @officer variables would be forgotten at a batch boundary.
-- ------------------------------------------------------------
DECLARE @tan   INT = (SELECT userId FROM Users WHERE email = N'tan@nea.gov.sg');
DECLARE @nurul INT = (SELECT userId FROM Users WHERE email = N'nurul@nea.gov.sg');
DECLARE @raj   INT = (SELECT userId FROM Users WHERE email = N'raj@nea.gov.sg');

DECLARE @today DATE = CAST(GETDATE() AS DATE);

-- ---------- COMPLETED VISITS (build up grade history) ----------
INSERT INTO Inspections (stallId, officerId, scheduledDate, status, completedDate, score, remarks) VALUES
-- Stall 1 has three rounds, so its history page shows a real trend: B -> C -> A
( 1, @tan,   DATEADD(MONTH, -20, @today), 'Completed', DATEADD(MONTH, -20, @today), 74, N'Chiller running warm at 8 degrees. Advised to service the unit.'),
( 1, @nurul, DATEADD(MONTH,  -8, @today), 'Completed', DATEADD(MONTH,  -8, @today), 61, N'Grease build-up behind the stove. Chopping boards not colour-coded.'),
( 1, @tan,   DATEADD(MONTH,  -2, @today), 'Completed', DATEADD(MONTH,  -2, @today), 91, N'Chiller replaced and boards colour-coded. Clear improvement.'),

( 2, @nurul, DATEADD(MONTH,  -6, @today), 'Completed', DATEADD(MONTH,  -6, @today), 95, N'Excellent cleanliness. No issues found.'),
( 3, @tan,   DATEADD(MONTH,  -5, @today), 'Completed', DATEADD(MONTH,  -5, @today), 72, N'Cooked food stored above raw. Follow-up required.'),
( 4, @raj,   DATEADD(MONTH, -11, @today), 'Completed', DATEADD(MONTH, -11, @today), 88, N'Good handling practices. Minor spillage near the wash area.'),
( 5, @nurul, DATEADD(MONTH,  -4, @today), 'Completed', DATEADD(MONTH,  -4, @today), 67, N'Staff not wearing hair nets. Verbal warning issued.'),
( 6, @tan,   DATEADD(MONTH,  -9, @today), 'Completed', DATEADD(MONTH,  -9, @today), 83, N'Satisfactory. Reminded to date-label prepared items.'),
( 7, @raj,   DATEADD(MONTH,  -3, @today), 'Completed', DATEADD(MONTH,  -3, @today), 52, N'Pest droppings found under the prep counter. Re-inspection booked.'),
( 8, @nurul, DATEADD(MONTH,  -7, @today), 'Completed', DATEADD(MONTH,  -7, @today), 90, N'Very well kept. Temperature logs up to date.'),
( 9, @tan,   DATEADD(MONTH, -13, @today), 'Completed', DATEADD(MONTH, -13, @today), 79, N'Acceptable. Ventilation hood due for cleaning.'),
(10, @raj,   DATEADD(MONTH,  -1, @today), 'Completed', DATEADD(MONTH,  -1, @today), 86, N'Clean throughout. No action required.'),
(11, @nurul, DATEADD(MONTH, -14, @today), 'Completed', DATEADD(MONTH, -14, @today), 58, N'Hand wash sink blocked by storage. Corrected on the spot.'),
(12, @tan,   DATEADD(MONTH,  -2, @today), 'Completed', DATEADD(MONTH,  -2, @today), 93, N'Exemplary. Used as a good practice example.');

-- ---------- OPEN VISITS (this is what fills the officer worklist) ----------
INSERT INTO Inspections (stallId, officerId, scheduledDate, status) VALUES
(13, @tan,   DATEADD(DAY,  -9, @today)),   -- OVERDUE  - date passed, still open
( 7, @raj,   DATEADD(DAY,  -3, @today)),   -- OVERDUE  - the stall 7 re-inspection
( 3, @tan,             @today        ),    -- DUE TODAY
( 5, @tan,             @today        ),    -- DUE TODAY
(14, @nurul, DATEADD(DAY,   4, @today)),   -- upcoming
( 2, @tan,   DATEADD(DAY,   9, @today)),   -- upcoming
(15, @raj,   DATEADD(DAY,  16, @today)),   -- upcoming
(16, @nurul, DATEADD(DAY,  23, @today));   -- upcoming

-- ---------- A CANCELLED VISIT ----------
-- Proves the Cancelled status is reachable, and that the filtered unique
-- index lets stall 13 be re-booked on a day it was cancelled on before.
INSERT INTO Inspections (stallId, officerId, scheduledDate, status, remarks) VALUES
(13, @nurul, DATEADD(DAY, -9, @today), 'Cancelled', N'Stall closed for renovation on the day. Rebooked.');

-- ---------- GRADES ISSUED BY THOSE COMPLETED VISITS ----------
-- Banding used by the back end: A >= 85, B >= 70, C >= 55, D below 55.
-- Every grade runs for one year from the completion date, so some of these
-- have already expired - which is exactly what the "expiring soon" and
-- "overdue" panels on the officer pages are there to surface.
INSERT INTO HygieneGrades (stallId, inspectionId, grade, validFrom, validTo)
SELECT i.stallId,
       i.inspectionId,
       CASE WHEN i.score >= 85 THEN 'A'
            WHEN i.score >= 70 THEN 'B'
            WHEN i.score >= 55 THEN 'C'
            ELSE 'D' END,
       i.completedDate,
       DATEADD(YEAR, 1, i.completedDate)
FROM Inspections i
WHERE i.status = 'Completed';
GO

PRINT 'Inspections + HygieneGrades ready.';
GO

-- Quick check - handy when demonstrating that the data actually landed.
SELECT status, COUNT(*) AS rowCount FROM Inspections   GROUP BY status;
SELECT grade,  COUNT(*) AS rowCount FROM HygieneGrades GROUP BY grade;
GO

-- Turn execution back on (paired with the SET NOEXEC ON guards in step 0).
SET NOEXEC OFF;
GO
