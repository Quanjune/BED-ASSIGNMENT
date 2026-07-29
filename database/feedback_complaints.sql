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
    complaintId    INT IDENTITY(1,1) PRIMARY KEY,
    stallId        INT NOT NULL,
    userId         NVARCHAR(100) NOT NULL,
    category       NVARCHAR(50) NULL,                      -- e.g. Hygiene, Service
    description    NVARCHAR(1000) NOT NULL,
    status         NVARCHAR(20) NOT NULL DEFAULT 'Open',   -- Open / Resolved
    createdAt      DATETIME NOT NULL DEFAULT GETDATE(),
    resolutionNote NVARCHAR(1000) NULL,                    -- note left when marked Resolved (NULL while Open)
    resolvedAt     DATETIME NULL,                          -- when it was resolved (NULL while Open)
    CONSTRAINT FK_Complaints_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

-- Sample feedback across many stalls with varied ratings (stallId 1-16 exist).
INSERT INTO Feedback (stallId, userId, rating, comment) VALUES
(1,  'user123', 5, 'Tender chicken and fragrant rice. Best in Maxwell!'),
(1,  'user456', 4, 'Very good but the queue was long.'),
(1,  'user789', 5, 'Consistent quality every visit.'),
(2,  'user123', 4, 'Crispy oyster cake, worth the wait.'),
(3,  'user456', 2, 'Porridge was lukewarm when served.'),
(5,  'user123', 5, 'Best hokkien mee, great wok hei.'),
(5,  'user789', 4, 'Generous portion of prawns.'),
(6,  'user456', 5, 'Char siew was perfectly caramelised.'),
(6,  'user123', 4, 'Sio bak was crispy.'),
(9,  'user123', 3, 'Decent shui kueh, a bit oily.'),
(10, 'user456', 4, 'Silky boneless chicken rice.'),
(11, 'user456', 2, 'Prawn mee soup was too salty.'),
(13, 'user789', 5, 'Fried oyster was fresh and eggy.'),
(14, 'user123', 4, 'Satay had good charcoal flavour.'),
(15, 'user456', 5, 'Sticky, smoky BBQ wings. Amazing.'),
(16, 'user789', 3, 'Ice kachang was a bit too sweet.');
GO

-- Sample complaints spread across categories, centres and months
-- (createdAt back-dated so the "monthly trend" chart has several points).
INSERT INTO Complaints (stallId, userId, category, description, status, createdAt) VALUES
-- this month
(3,  'user456', 'Hygiene',      'Table was not cleaned and utensils looked dirty.', 'Open',     GETDATE()),
(2,  'user123', 'Service',      'Waited very long and received the wrong order.',   'Resolved', GETDATE()),
(1,  'user789', 'Food Quality', 'Chicken rice was undercooked.',                    'Open',     GETDATE()),
-- 1 month ago
(5,  'user123', 'Hygiene',      'Flies around the drink area.',                     'Resolved', DATEADD(month,-1,GETDATE())),
(6,  'user456', 'Service',      'Rude staff at the counter.',                       'Open',     DATEADD(month,-1,GETDATE())),
(9,  'user789', 'Pricing',      'Charged more than the listed menu price.',         'Open',     DATEADD(month,-1,GETDATE())),
-- 2 months ago
(13, 'user123', 'Hygiene',      'Dirty trays were not cleared.',                    'Resolved', DATEADD(month,-2,GETDATE())),
(14, 'user456', 'Food Quality', 'Satay was served cold.',                           'Open',     DATEADD(month,-2,GETDATE())),
(2,  'user789', 'Other',        'Overcrowded, no seats available.',                 'Open',     DATEADD(month,-2,GETDATE())),
-- 3 months ago
(10, 'user123', 'Service',      'Order took over 40 minutes.',                      'Resolved', DATEADD(month,-3,GETDATE())),
(11, 'user456', 'Hygiene',      'Utensils were wet and dirty.',                     'Open',     DATEADD(month,-3,GETDATE()));
GO

PRINT 'Feedback and Complaints tables created with sample data.';
GO
