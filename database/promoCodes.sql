-- promo_codes.sql
-- PromoCodes table for the promo code feature (individual feature).
-- Run in SSMS against HawkersDB. Safe to re-run (drops + recreates).
-- A code is owned by a stall (stallId -> FoodStalls) or is platform-wide
-- (stallId NULL, managed by admin). It has NO foreign keys to CartItems or
-- any cart/order table. Because of the FoodStalls FK, the master script
-- ("DB with Vendor logins.sql") MUST be run before this file.
--
-- RUN ORDER:
--   1) DB with Vendor logins.sql   (master - builds everything else)
--   2) ProductOptions.sql
--   3) promoCodes.sql    (this file)
--   4) feedback_complaints.sql   
USE HawkersDB;
GO

IF OBJECT_ID('dbo.PromoCodes', 'U') IS NOT NULL DROP TABLE dbo.PromoCodes;
GO

-- ------------------------------------------------------------
-- 4) PROMO CODES (standalone, no FKs to cart/order)
-- ------------------------------------------------------------
CREATE TABLE PromoCodes (
    promoId       INT IDENTITY(1,1) PRIMARY KEY,      -- auto-numbered unique id
    stallId       INT           NULL,                 -- owning stall; NULL = platform-wide (admin only)
    code          NVARCHAR(50)  NOT NULL UNIQUE,      -- e.g. 'SAVE5' (no two codes alike)
    discountType  NVARCHAR(10)  NOT NULL,             -- 'percent' or 'fixed'
    discountValue DECIMAL(6,2)  NOT NULL,             -- 10 = 10% off, or 5.00 = $5 off
    expiryDate    DATE          NOT NULL,             -- code works up to & including this day
    usageLimit    INT           NOT NULL,             -- max number of redemptions allowed
    timesUsed     INT           NOT NULL DEFAULT 0,   -- redemptions so far (starts at 0)
    isActive      BIT           NOT NULL DEFAULT 1,   -- 1 = live, 0 = switched off
    -- A vendor may only touch rows where stallId = their own stall. Rows with
    -- stallId NULL are platform-wide and only an admin can create or edit them.
    CONSTRAINT FK_PromoCodes_Stall FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    CONSTRAINT CHK_PromoCodes_Type    CHECK (discountType IN ('percent', 'fixed')),
    CONSTRAINT CHK_PromoCodes_Value   CHECK (discountValue > 0),
    CONSTRAINT CHK_PromoCodes_Percent CHECK (discountType <> 'percent' OR discountValue <= 100),
    CONSTRAINT CHK_PromoCodes_Usage   CHECK (usageLimit >= 1 AND timesUsed >= 0)
);
GO

-- Platform-wide codes (stallId NULL): only an admin can manage these.
INSERT INTO PromoCodes (stallId, code, discountType, discountValue, expiryDate, usageLimit, timesUsed, isActive) VALUES
(NULL, 'SAVE5',     'fixed',   5.00,  CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 100, 0, 1),  -- valid ($5 off)
(NULL, 'WELCOME10', 'percent', 10.00, CAST(DATEADD(MONTH,  3, GETDATE()) AS DATE),  50, 0, 1),  -- valid (10% off)
(NULL, 'EXPIRED20', 'percent', 20.00, CAST(DATEADD(DAY,  -30, GETDATE()) AS DATE), 100, 0, 1),  -- fails: expired
(NULL, 'MAXEDOUT',  'fixed',   3.00,  CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE),   5, 5, 1),  -- fails: limit hit
(NULL, 'INACTIVE5', 'fixed',   5.00,  CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 100, 0, 0);  -- fails: switched off
GO

-- Stall-owned codes, so a vendor login has something of its own to manage.
-- Stall 1 = Maxwell Chicken Rice (chickenrice@test.com), stall 2 = Maxwell
-- Fuzhou Oyster Cake (vendor2@hawkers.sg), stall 5 = Nam Sing Hokkien Mee.
INSERT INTO PromoCodes (stallId, code, discountType, discountValue, expiryDate, usageLimit, timesUsed, isActive) VALUES
(1, 'CHICKEN1',  'fixed',   1.00,  CAST(DATEADD(MONTH, 4, GETDATE()) AS DATE), 200,  12, 1),
(1, 'TIANTIAN15','percent', 15.00, CAST(DATEADD(MONTH, 2, GETDATE()) AS DATE),  80,   5, 1),
(2, 'OYSTER2',   'fixed',   2.00,  CAST(DATEADD(MONTH, 5, GETDATE()) AS DATE), 150,   0, 1),
(5, 'HOKKIEN10', 'percent', 10.00, CAST(DATEADD(MONTH, 3, GETDATE()) AS DATE), 120,   3, 1);
GO