-- promo_codes.sql
-- PromoCodes table for the promo code feature (individual feature).
-- Run in SSMS against HawkersDB. Safe to re-run (drops + recreates).
-- Standalone table: NO foreign keys to CartItems or any cart/order table.
USE HawkersDB;
GO

IF OBJECT_ID('dbo.PromoCodes', 'U') IS NOT NULL DROP TABLE dbo.PromoCodes;
GO

CREATE TABLE PromoCodes (
    promoId       INT IDENTITY(1,1) PRIMARY KEY,      -- auto-numbered unique id
    code          NVARCHAR(50)  NOT NULL UNIQUE,      -- e.g. 'SAVE5' (no two codes alike)
    discountType  NVARCHAR(10)  NOT NULL,             -- 'percent' or 'fixed'
    discountValue DECIMAL(6,2)  NOT NULL,             -- 10 = 10% off, or 5.00 = $5 off
    expiryDate    DATE          NOT NULL,             -- code works up to & including this day
    usageLimit    INT           NOT NULL,             -- max number of redemptions allowed
    timesUsed     INT           NOT NULL DEFAULT 0,   -- redemptions so far (starts at 0)
    isActive      BIT           NOT NULL DEFAULT 1,   -- 1 = live, 0 = switched off
    -- CHECK constraints: the DB itself rejects bad data, even if the API is bypassed
    CONSTRAINT CHK_PromoCodes_Type    CHECK (discountType IN ('percent', 'fixed')),
    CONSTRAINT CHK_PromoCodes_Value   CHECK (discountValue > 0),
    CONSTRAINT CHK_PromoCodes_Percent CHECK (discountType <> 'percent' OR discountValue <= 100),
    CONSTRAINT CHK_PromoCodes_Usage   CHECK (usageLimit >= 1 AND timesUsed >= 0)
);
GO

-- Sample codes: one for each branch of the validate endpoint, so every
-- outcome can be demonstrated in Postman. Expiry dates are relative to
-- today (DATEADD) so the demo data never goes stale.
INSERT INTO PromoCodes (code, discountType, discountValue, expiryDate, usageLimit, timesUsed, isActive) VALUES
('SAVE5',     'fixed',   5.00,  CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 100, 0, 1),  -- valid ($5 off)
('WELCOME10', 'percent', 10.00, CAST(DATEADD(MONTH,  3, GETDATE()) AS DATE),  50, 0, 1),  -- valid (10% off)
('EXPIRED20', 'percent', 20.00, CAST(DATEADD(DAY,  -30, GETDATE()) AS DATE), 100, 0, 1),  -- fails: expired
('MAXEDOUT',  'fixed',   3.00,  CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE),   5, 5, 1),  -- fails: limit hit
('INACTIVE5', 'fixed',   5.00,  CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 100, 0, 0);  -- fails: switched off
GO

PRINT 'PromoCodes table created with 5 sample codes.';
GO