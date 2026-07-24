-- ============================================================
-- feedback_complaints.sql
-- ADDITIVE script - safe to run AFTER "DB with Vendor logins.sql".
--
-- WHY THIS FILE EXISTS:
--   The Feedback and Complaints tables previously only existed inside
--   "Homepage, add to cart, history & Product page.sql", which is a FULL
--   REBUILD script - running that after the master script would drop and
--   recreate the core tables and wipe the stall/vendor data.
--   This file creates ONLY those two tables, so nothing else is touched.
--
-- RUN ORDER:
--   1) DB with Vendor logins.sql   (master - builds everything else)
--   2) ProductOptions.sql
--   3) promoCodes.sql
--   4) feedback_complaints.sql   (this file)
--   5) Inspectionpage.sql
-- ============================================================
USE HawkersDB;
GO

-- Drop first so this script can be re-run cleanly.
IF OBJECT_ID('dbo.Feedback',   'U') IS NOT NULL DROP TABLE dbo.Feedback;
IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;
GO

CREATE TABLE Feedback (
    feedbackId   INT IDENTITY(1,1) PRIMARY KEY,
    stallId      INT NOT NULL,
    userId       NVARCHAR(100) NOT NULL,
    rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      NVARCHAR(1000) NULL,
    createdAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

CREATE TABLE Complaints (
    complaintId  INT IDENTITY(1,1) PRIMARY KEY,
    stallId      INT NOT NULL,
    userId       NVARCHAR(100) NOT NULL,
    category     NVARCHAR(50) NULL,                      -- e.g. Hygiene, Service
    description  NVARCHAR(1000) NOT NULL,
    status       NVARCHAR(20) NOT NULL DEFAULT 'Open',   -- Open / Resolved
    createdAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Complaints_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

-- Sample data (stallId 1-3 exist in the master script's 16 stalls)
INSERT INTO Feedback (stallId, userId, rating, comment) VALUES
(1, 'user123', 5, 'Tender chicken and fragrant rice. Best in Maxwell!'),
(1, 'user456', 4, 'Very good but the queue was long.'),
(3, 'user123', 2, 'Hokkien mee was lukewarm when served.');
GO

INSERT INTO Complaints (stallId, userId, category, description, status) VALUES
(3, 'user456', 'Hygiene', 'Table was not cleaned and utensils looked dirty.', 'Open'),
(2, 'user123', 'Service', 'Waited very long and received the wrong order.', 'Resolved');
GO

PRINT 'Feedback and Complaints tables created with sample data.';
GO
