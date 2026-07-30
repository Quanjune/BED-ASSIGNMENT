-- ================================================================
-- orders_promo_columns.sql   (QJ - Customer)
--
-- Adds promoCode + discount to Orders so a redeemed promo code is
-- recorded on the order it was used for.
--
-- Reuses Timely's PromoCodes table - no changes to their schema.
--
-- ADDITIVE. Drops nothing. Safe to re-run.
-- RUN AFTER: the master script (kishore_data.sql) and promoCodes.sql
-- ================================================================
USE HawkersDB;
GO

-- Which code was redeemed (NULL = no promo used on this order).
IF COL_LENGTH('dbo.Orders', 'promoCode') IS NULL
    ALTER TABLE Orders ADD promoCode NVARCHAR(50) NULL;
GO

-- How much money the code took off. 0 when no code was used.
IF COL_LENGTH('dbo.Orders', 'discount') IS NULL
    ALTER TABLE Orders ADD discount DECIMAL(10,2) NOT NULL DEFAULT 0;
GO

-- No FK to PromoCodes on purpose: the code is stored as text so the
-- order history still reads correctly even if the vendor later deletes
-- or renames that promo code.

PRINT 'Orders promo columns ready.';
GO
