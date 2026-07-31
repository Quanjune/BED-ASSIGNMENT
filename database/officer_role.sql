-- ============================================================
-- officer_role.sql            (Kaden - NEA inspections & hygiene grading)
--
-- WHAT THIS DOES
--   1. Widens the Users role CHECK constraint to allow 'officer'.
--   2. Seeds three NEA officer accounts.
--
-- WHY IT IS A SEPARATE FILE
--   The Users table belongs to the master script
--   ("qj and kishore masterdata.sql"). Editing that file would put my
--   change inside someone else's script and make merges painful, so this
--   follows the same ADDITIVE pattern the rest of the team already uses
--   (user_card.sql, orders_promo_columns.sql): it only alters what it
--   needs, and it is safe to run more than once.
--
-- WHY OFFICERS ARE SEEDED, NOT SELF-REGISTERED
--   Same reasoning as the vendor/stall note in the main README. A real NEA
--   officer is appointed by the agency, not created by filling in a signup
--   form. The signup validator only accepts 'customer' and 'vendor', so an
--   officer account can ONLY come from this script.
--
-- RUN ORDER
--   1) qj and kishore masterdata.sql   (master - builds Users)
--   2) masterdata_timely.sql
--   3) orders_promo_columns.sql
--   4) officer_role.sql                (this file)
--   5) Inspectionpage.sql
--
--   Re-run this file after every rebuild of the master script, because the
--   master drops and recreates Users (and therefore the old constraint).
-- ============================================================
USE HawkersDB;
GO

-- ------------------------------------------------------------
-- 1) Allow the 'officer' role
-- ------------------------------------------------------------
-- A CHECK constraint cannot be edited in place - it has to be dropped and
-- recreated with the wider list. The IF EXISTS guard is what makes this
-- script safe to run twice.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_Users_Role')
    ALTER TABLE Users DROP CONSTRAINT CHK_Users_Role;
GO

ALTER TABLE Users
    ADD CONSTRAINT CHK_Users_Role
    CHECK (role IN ('customer', 'vendor', 'admin', 'officer'));
GO

-- ------------------------------------------------------------
-- 2) Seed the NEA officer accounts
-- ------------------------------------------------------------
-- Password for all three:  Password123
-- (the same bcrypt hash the master script uses for its seeded vendor
--  accounts, so there is only one test password to remember)
--
-- No explicit userId here. The master script uses SET IDENTITY_INSERT to pin
-- stall and product IDs because an order has to point at the same dish on
-- everyone's machine. Officer IDs do not need pinning - nothing references
-- them by number - and letting IDENTITY assign them means this script still
-- works if someone has already registered an account that took the next ID.
-- Inspectionpage.sql looks the officers up BY EMAIL for the same reason.
--
-- Officers own no stall, so stallId is NULL.
IF NOT EXISTS (SELECT 1 FROM Users WHERE email = N'tan@nea.gov.sg')
    INSERT INTO Users (name, email, passwordHash, role, stallId)
    VALUES (N'Officer Tan Wei Ming', N'tan@nea.gov.sg',
            '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'officer', NULL);

IF NOT EXISTS (SELECT 1 FROM Users WHERE email = N'nurul@nea.gov.sg')
    INSERT INTO Users (name, email, passwordHash, role, stallId)
    VALUES (N'Officer Nurul Huda', N'nurul@nea.gov.sg',
            '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'officer', NULL);

IF NOT EXISTS (SELECT 1 FROM Users WHERE email = N'raj@nea.gov.sg')
    INSERT INTO Users (name, email, passwordHash, role, stallId)
    VALUES (N'Officer Rajesh Kumar', N'raj@nea.gov.sg',
            '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'officer', NULL);
GO

PRINT 'Officer role enabled. 3 NEA officer accounts ready.';
PRINT '  tan@nea.gov.sg / nurul@nea.gov.sg / raj@nea.gov.sg   password: Password123';
GO
