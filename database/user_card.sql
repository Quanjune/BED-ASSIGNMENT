-- ============================================================
-- user_card.sql  (Aswin - User accounts)
-- Adds a saved-card column to the Users table.
-- ADDITIVE: run AFTER the master. Safe to re-run (checks first).
--
-- SECURITY: only the LAST 4 digits are stored - never the full card
-- number. Real payment processing is handled by the bank interface
-- (out of scope per the case study).
-- ============================================================
USE HawkersDB;
GO

IF COL_LENGTH('dbo.Users', 'cardLast4') IS NULL
    ALTER TABLE Users ADD cardLast4 CHAR(4) NULL;   -- last 4 digits only
GO

PRINT 'Users card column ready.';
GO
