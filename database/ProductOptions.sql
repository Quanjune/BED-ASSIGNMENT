-- ===============================================================
-- ProductAddons.sql
-- Product customisation options (addons) for all 64 products.
-- Run AFTER RealStallData.sql (needs Products + CartItems to exist).
-- Safe to re-run: drops the addon tables first.
-- ===============================================================
USE HawkersDB;
GO

IF OBJECT_ID('CartItemAddons','U') IS NOT NULL DROP TABLE CartItemAddons;
IF OBJECT_ID('AddonOptions','U')  IS NOT NULL DROP TABLE AddonOptions;
IF OBJECT_ID('AddonGroups','U')   IS NOT NULL DROP TABLE AddonGroups;
GO

-- A group of choices for a product, e.g. "Choice of Chicken".
-- groupType: 'radio' = pick exactly one, 'checkbox' = pick any number.
-- isRequired: 1 = customer must choose before adding to cart (radio only).
CREATE TABLE AddonGroups (
    groupId     INT IDENTITY(1,1) PRIMARY KEY,
    productId   INT NOT NULL,
    title       NVARCHAR(100) NOT NULL,
    groupType   NVARCHAR(10)  NOT NULL,   -- 'radio' | 'checkbox'
    isRequired  BIT NOT NULL DEFAULT 0,
    sortOrder   INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_AddonGroups_Product FOREIGN KEY (productId) REFERENCES Products(productId)
);
GO

-- A single option inside a group, e.g. "Roasted (+$0.50)".
CREATE TABLE AddonOptions (
    optionId    INT IDENTITY(1,1) PRIMARY KEY,
    groupId     INT NOT NULL,
    label       NVARCHAR(100) NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0,
    sortOrder   INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_AddonOptions_Group FOREIGN KEY (groupId) REFERENCES AddonGroups(groupId)
);
GO

-- The addons a customer actually chose for one cart line.
-- One row per chosen option. priceAtAdd freezes the price at add-time.
CREATE TABLE CartItemAddons (
    cartItemAddonId INT IDENTITY(1,1) PRIMARY KEY,
    cartItemId      INT NOT NULL,
    optionId        INT NOT NULL,
    label           NVARCHAR(100) NOT NULL,
    priceAtAdd      DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT FK_CartItemAddons_CartItem FOREIGN KEY (cartItemId) REFERENCES CartItems(cartItemId),
    CONSTRAINT FK_CartItemAddons_Option   FOREIGN KEY (optionId)   REFERENCES AddonOptions(optionId)
);
GO


-- ---- Product 1 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (1, 'Choice of Chicken', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Steamed', 0.00, 0),
(@gid, 'Roasted', 0.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (1, 'Choice of Rice', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (1, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 2.00, 0),
(@gid, 'Extra Chilli Sauce', 0.30, 1),
(@gid, 'Achar (Pickles)', 0.80, 2),
(@gid, 'Braised Egg', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (1, 'Spice Level', 'radio', 1, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 2 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (2, 'Chicken Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (2, 'Choice of Rice', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (2, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Roasted Skin', 1.00, 0),
(@gid, 'Extra Chilli', 0.30, 1),
(@gid, 'Braised Egg', 1.00, 2);
GO

-- ---- Product 3 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (3, 'Pork Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Crispy Belly', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (3, 'Choice of Rice', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (3, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Char Siew', 2.00, 0),
(@gid, 'Braised Egg', 1.00, 1),
(@gid, 'Extra Chilli', 0.30, 2);
GO

-- ---- Product 4 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (4, 'Sauce', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Lemon Sauce', 0.00, 0),
(@gid, 'Curry Sauce', 0.00, 1),
(@gid, 'Black Pepper', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (4, 'Choice of Rice', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (4, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Cutlet', 2.50, 0),
(@gid, 'Fried Egg', 1.00, 1),
(@gid, 'Extra Sauce', 0.50, 2);
GO

-- ---- Product 5 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (5, 'Quantity Style', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Single', 0.00, 0),
(@gid, 'Double Stack', 2.80, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (5, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Oysters', 1.50, 0),
(@gid, 'Sweet Chilli Dip', 0.30, 1),
(@gid, 'Garlic Chilli Dip', 0.30, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (5, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 6 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (6, 'Egg Style', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Sunny Side Up', 0.00, 0),
(@gid, 'Well Done', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (6, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Egg', 0.80, 0),
(@gid, 'Extra Oysters', 1.50, 1),
(@gid, 'Chilli Dip', 0.30, 2);
GO

-- ---- Product 7 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (7, 'Seafood Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard', 0.00, 0),
(@gid, 'Extra Loaded', 2.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (7, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Extra Squid', 1.50, 1),
(@gid, 'Chilli Dip', 0.30, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (7, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 8 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (8, 'Drink in Set', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Soft Drink', 0.00, 0),
(@gid, 'Kopi', 0.00, 1),
(@gid, 'Teh', 0.00, 2),
(@gid, 'Bottled Water', 0.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (8, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Oyster Cake', 3.00, 0),
(@gid, 'Extra Chilli', 0.30, 1);
GO

-- ---- Product 9 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (9, 'Doneness', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Well Done', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (9, 'Side', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fries', 0.00, 0),
(@gid, 'Mashed Potato', 0.50, 1),
(@gid, 'Coleslaw', 0.00, 2),
(@gid, 'Baked Beans', 0.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (9, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Gravy', 0.50, 0),
(@gid, 'Fried Egg', 1.00, 1),
(@gid, 'Extra Chicken Chop', 4.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (9, 'Add a Drink', 'radio', 0, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 10 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (10, 'Pepper Intensity', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Mild', 0.00, 0),
(@gid, 'Bold', 0.00, 1),
(@gid, 'Extra Peppery', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (10, 'Side', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fries', 0.00, 0),
(@gid, 'Mashed Potato', 0.50, 1),
(@gid, 'Coleslaw', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (10, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Black Pepper Sauce', 0.50, 0),
(@gid, 'Fried Egg', 1.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (10, 'Add a Drink', 'radio', 0, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 11 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (11, 'Mushroom Sauce', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Mushrooms', 1.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (11, 'Side', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fries', 0.00, 0),
(@gid, 'Mashed Potato', 0.50, 1),
(@gid, 'Coleslaw', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (11, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Mushroom Sauce', 0.50, 0),
(@gid, 'Fried Egg', 1.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (11, 'Add a Drink', 'radio', 0, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 12 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (12, 'Combo Side Swap', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fries + Coleslaw', 0.00, 0),
(@gid, 'Fries + Salad', 0.00, 1),
(@gid, 'Double Fries', 0.50, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (12, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken Chop', 4.00, 0),
(@gid, 'Extra Sauce', 0.50, 1),
(@gid, 'Fried Egg', 1.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (12, 'Add a Drink', 'radio', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 13 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (13, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (13, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Century Egg', 1.00, 0),
(@gid, 'Extra Pork', 1.50, 1),
(@gid, 'You Tiao (Dough Fritter)', 1.00, 2),
(@gid, 'Spring Onion', 0.00, 3),
(@gid, 'Ginger Strips', 0.00, 4);
GO

-- ---- Product 14 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (14, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (14, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 1.50, 0),
(@gid, 'Century Egg', 1.00, 1),
(@gid, 'You Tiao', 1.00, 2),
(@gid, 'Spring Onion', 0.00, 3);
GO

-- ---- Product 15 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (15, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (15, 'Fish Type', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Batang', 0.00, 0),
(@gid, 'Snakehead', 1.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (15, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Fish Slices', 2.00, 0),
(@gid, 'Ginger Strips', 0.00, 1),
(@gid, 'You Tiao', 1.00, 2);
GO

-- ---- Product 16 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (16, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (16, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Pork', 1.50, 0),
(@gid, 'Extra Fish', 2.00, 1),
(@gid, 'Century Egg', 1.00, 2),
(@gid, 'You Tiao', 1.00, 3);
GO

-- ---- Product 17 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (17, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 2.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (17, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Extra Sotong', 1.50, 1),
(@gid, 'Sambal Chilli', 0.30, 2),
(@gid, 'Extra Lime', 0.00, 3),
(@gid, 'Pork Lard', 0.50, 4);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (17, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 18 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (18, 'Prawn Amount', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard', 0.00, 0),
(@gid, 'Extra Prawns', 1.80, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (18, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Sotong', 1.50, 0),
(@gid, 'Sambal Chilli', 0.30, 1),
(@gid, 'Pork Lard', 0.50, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (18, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 19 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (19, 'Seafood Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard', 0.00, 0),
(@gid, 'Extra Loaded', 2.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (19, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Extra Clams', 1.50, 1),
(@gid, 'Sambal Chilli', 0.30, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (19, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 20 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (20, 'Add-ons', 'checkbox', 0, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Sambal Chilli', 0.30, 1),
(@gid, 'Pork Lard', 0.50, 2),
(@gid, 'Extra Lime', 0.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (20, 'Spice Level', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 21 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (21, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (21, 'Gravy Thickness', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Thick', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (21, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Pork', 1.50, 0),
(@gid, 'Ngoh Hiang', 1.20, 1),
(@gid, 'Fish Cake', 0.80, 2),
(@gid, 'Extra Garlic', 0.00, 3),
(@gid, 'Extra Vinegar', 0.00, 4);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (21, 'Spice Level', 'radio', 1, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 22 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (22, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (22, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Ngoh Hiang', 1.20, 0),
(@gid, 'Fish Cake', 0.80, 1),
(@gid, 'Extra Garlic', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (22, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 23 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (23, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (23, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Extra Fish Slices', 1.50, 1),
(@gid, 'Ngoh Hiang', 1.20, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (23, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 24 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (24, 'Gravy Thickness', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Thick', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (24, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Pork', 1.50, 0),
(@gid, 'Fish Cake', 0.80, 1),
(@gid, 'Extra Garlic', 0.00, 2),
(@gid, 'Extra Vinegar', 0.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (24, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 25 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (25, 'Quantity', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, '1 Piece', 0.00, 0),
(@gid, '3 Pieces', 3.40, 1),
(@gid, '6 Pieces', 6.80, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (25, 'Dipping Sauce', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Chilli Sauce', 0.30, 0),
(@gid, 'Curry Dip', 0.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (25, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 26 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (26, 'Quantity', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, '1 Piece', 0.00, 0),
(@gid, '3 Pieces', 3.40, 1),
(@gid, '6 Pieces', 6.80, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (26, 'Dipping Sauce', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Chilli Sauce', 0.30, 0),
(@gid, 'Curry Dip', 0.50, 1);
GO

-- ---- Product 27 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (27, 'Quantity', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, '1 Piece', 0.00, 0),
(@gid, '3 Pieces', 3.80, 1),
(@gid, '6 Pieces', 7.60, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (27, 'Dipping Sauce', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Chilli Sauce', 0.30, 0),
(@gid, 'Sweet Sauce', 0.30, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (27, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 28 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (28, 'Bag Size', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Small Bag', 0.00, 0),
(@gid, 'Large Bag', 2.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (28, 'Dipping Sauce', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Chilli Sauce', 0.30, 0),
(@gid, 'Curry Dip', 0.50, 1);
GO

-- ---- Product 29 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (29, 'Sambal Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Mild Sambal', 0.00, 0),
(@gid, 'Spicy Sambal', 0.00, 1),
(@gid, 'Extra Spicy', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (29, 'Egg Style', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fried Egg', 0.00, 0),
(@gid, 'Omelette', 0.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (29, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fried Chicken Wing', 1.50, 0),
(@gid, 'Otah', 1.20, 1),
(@gid, 'Fish Cake', 0.80, 2),
(@gid, 'Extra Anchovies & Peanuts', 0.50, 3);
GO

-- ---- Product 30 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (30, 'Sambal Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Mild', 0.00, 0),
(@gid, 'Spicy', 0.00, 1),
(@gid, 'Extra Spicy', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (30, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken Wing', 1.80, 0),
(@gid, 'Otah', 1.20, 1),
(@gid, 'Extra Sambal', 0.30, 2);
GO

-- ---- Product 31 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (31, 'Sambal Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Mild', 0.00, 0),
(@gid, 'Spicy', 0.00, 1),
(@gid, 'Extra Spicy', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (31, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Cutlet', 2.50, 0),
(@gid, 'Otah', 1.20, 1),
(@gid, 'Fried Egg', 1.00, 2),
(@gid, 'Extra Sambal', 0.30, 3);
GO

-- ---- Product 32 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (32, 'Sambal Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Mild', 0.00, 0),
(@gid, 'Spicy', 0.00, 1),
(@gid, 'Extra Spicy', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (32, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Fish Fillet', 2.50, 0),
(@gid, 'Otah', 1.20, 1),
(@gid, 'Fried Egg', 1.00, 2);
GO

-- ---- Product 33 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (33, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'For 1', 0.00, 0),
(@gid, 'For 2', 4.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (33, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 2.00, 0),
(@gid, 'Extra Sausage (Lup Cheong)', 1.50, 1),
(@gid, 'Salted Fish', 1.00, 2),
(@gid, 'Extra Dark Sauce', 0.00, 3),
(@gid, 'Vegetables', 1.00, 4);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (33, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 34 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (34, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'For 1', 0.00, 0),
(@gid, 'For 2', 4.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (34, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Pork Ribs', 2.50, 0),
(@gid, 'Salted Fish', 1.00, 1),
(@gid, 'Vegetables', 1.00, 2);
GO

-- ---- Product 35 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (35, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 4.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (35, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Fish Head', 4.00, 0),
(@gid, 'Tofu', 1.50, 1),
(@gid, 'Vegetables', 1.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (35, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 36 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (36, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'For 1', 0.00, 0),
(@gid, 'For 2', 4.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (36, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Seafood', 2.50, 0),
(@gid, 'Extra Tofu', 1.50, 1),
(@gid, 'Vegetables', 1.00, 2);
GO

-- ---- Product 37 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (37, 'Choice of Rice', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (37, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 2.00, 0),
(@gid, 'Fried Egg', 1.00, 1),
(@gid, 'Vegetables', 1.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (37, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 38 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (38, 'Choice of Rice', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (38, 'Prawn Style', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Stir-Fried', 0.00, 0),
(@gid, 'Cereal', 1.00, 1),
(@gid, 'Salted Egg', 1.50, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (38, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 2.50, 0),
(@gid, 'Vegetables', 1.00, 1);
GO

-- ---- Product 39 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (39, 'Choice of Rice', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (39, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Seafood', 3.00, 0),
(@gid, 'Vegetables', 1.00, 1),
(@gid, 'Fried Egg', 1.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (39, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 40 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (40, 'Choice of Rice', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'White Rice', 0.00, 0),
(@gid, 'Chicken Stock Rice', 0.50, 1),
(@gid, 'Brown Rice', 0.50, 2),
(@gid, 'Extra Rice', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (40, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Upgrade Portion', 2.00, 0),
(@gid, 'Fried Egg', 1.00, 1),
(@gid, 'Vegetables', 1.00, 2);
GO

-- ---- Product 41 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (41, 'Main Swap', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard Main', 0.00, 0),
(@gid, 'Premium Main', 2.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (41, 'Add a Drink', 'radio', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (41, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Side', 2.00, 0),
(@gid, 'Soup of the Day', 2.50, 1);
GO

-- ---- Product 42 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (42, 'Main Swap', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard Premium Main', 0.00, 0),
(@gid, 'Deluxe Upgrade', 2.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (42, 'Add a Drink', 'radio', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (42, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Side', 2.00, 0),
(@gid, 'Soup of the Day', 2.50, 1);
GO

-- ---- Product 43 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (43, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard', 0.00, 0),
(@gid, 'Sharing (2 pax)', 5.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (43, 'Add a Drink', 'radio', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (43, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Side', 2.00, 0),
(@gid, 'Dessert', 3.00, 1);
GO

-- ---- Product 44 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (44, 'Herbal Strength', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Strong Brew', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (44, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Meat', 2.50, 0),
(@gid, 'Rice', 1.00, 1),
(@gid, 'Add Noodles', 1.50, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (44, 'Add a Drink', 'radio', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 45 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (45, 'Rice Size', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (45, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 2.50, 0),
(@gid, 'Onsen Egg', 1.20, 1),
(@gid, 'Miso Soup', 1.50, 2),
(@gid, 'Extra Teriyaki Sauce', 0.50, 3);
GO

-- ---- Product 46 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (46, 'Rice Size', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (46, 'Salmon Style', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Sashimi', 0.00, 0),
(@gid, 'Aburi (Seared)', 1.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (46, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Salmon', 4.00, 0),
(@gid, 'Onsen Egg', 1.20, 1),
(@gid, 'Miso Soup', 1.50, 2);
GO

-- ---- Product 47 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (47, 'Rice Size', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (47, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Ebi Tempura', 3.00, 0),
(@gid, 'Onsen Egg', 1.20, 1),
(@gid, 'Miso Soup', 1.50, 2);
GO

-- ---- Product 48 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (48, 'Curry Spice', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Mild', 0.00, 0),
(@gid, 'Medium', 0.00, 1),
(@gid, 'Hot', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (48, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Katsu', 3.50, 0),
(@gid, 'Extra Curry Sauce', 1.00, 1),
(@gid, 'Miso Soup', 1.50, 2);
GO

-- ---- Product 49 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (49, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (49, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Cockles', 1.50, 0),
(@gid, 'Extra Chinese Sausage', 1.20, 1),
(@gid, 'Pork Lard', 0.50, 2),
(@gid, 'Extra Egg', 0.80, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (49, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 50 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (50, 'Cockle Amount', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard', 0.00, 0),
(@gid, 'Extra Cockles', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (50, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Chinese Sausage', 1.20, 0),
(@gid, 'Pork Lard', 0.50, 1),
(@gid, 'Extra Egg', 0.80, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (50, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 51 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (51, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (51, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Cockles', 1.50, 1),
(@gid, 'Extra Egg', 0.80, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (51, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 52 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (52, 'Seafood Level', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Standard', 0.00, 0),
(@gid, 'Extra Loaded', 2.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (52, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Extra Sotong', 1.50, 1),
(@gid, 'Cockles', 1.50, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (52, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 53 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (53, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (53, 'Gravy Thickness', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Thick', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (53, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Fish Cake', 0.80, 0),
(@gid, 'Ngoh Hiang', 1.20, 1),
(@gid, 'Extra Garlic', 0.00, 2),
(@gid, 'Extra Vinegar', 0.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (53, 'Spice Level', 'radio', 1, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 54 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (54, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (54, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 1.50, 0),
(@gid, 'Fish Cake', 0.80, 1),
(@gid, 'Extra Garlic', 0.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (54, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 55 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (55, 'Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Large', 1.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (55, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Prawns', 1.80, 0),
(@gid, 'Fish Cake', 0.80, 1),
(@gid, 'Ngoh Hiang', 1.20, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (55, 'Spice Level', 'radio', 1, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 56 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (56, 'Add-ons', 'checkbox', 0, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Fish Cake', 0.80, 0),
(@gid, 'Extra Garlic', 0.00, 1),
(@gid, 'Extra Vinegar', 0.00, 2),
(@gid, 'Chilli', 0.30, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (56, 'Spice Level', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Chilli', 0.00, 0),
(@gid, 'Mild', 0.00, 1),
(@gid, 'Spicy', 0.00, 2),
(@gid, 'Extra Spicy', 0.00, 3);
GO

-- ---- Product 57 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (57, 'Chai Poh Topping', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Chai Poh', 0.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (57, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chilli', 0.30, 0),
(@gid, 'Add 2 pc', 1.30, 1);
GO

-- ---- Product 58 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (58, 'Chai Poh Topping', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Extra Chai Poh', 0.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (58, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chilli', 0.30, 0),
(@gid, 'Add 2 pc', 1.20, 1);
GO

-- ---- Product 59 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (59, 'Sauce', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Sweet Sauce', 0.00, 0),
(@gid, 'Sweet + Sesame', 0.00, 1),
(@gid, 'Extra Sweet Sauce', 0.30, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (59, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fried Shallots', 0.30, 0),
(@gid, 'Extra Chilli', 0.30, 1);
GO

-- ---- Product 60 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (60, 'Combo Drink', 'radio', 0, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Soya Bean', 1.20, 1),
(@gid, 'Barley', 1.20, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (60, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chai Poh', 0.50, 0),
(@gid, 'Extra Chilli', 0.30, 1);
GO

-- ---- Product 61 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (61, 'Doneness', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Regular', 0.00, 0),
(@gid, 'Well Done', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (61, 'Side Swap', 'radio', 1, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Fries + Salad', 0.00, 0),
(@gid, 'Mashed Potato + Salad', 0.50, 1),
(@gid, 'Double Fries', 0.50, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (61, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken Chop', 4.50, 0),
(@gid, 'Mushroom Sauce', 0.80, 1),
(@gid, 'Black Pepper Sauce', 0.80, 2),
(@gid, 'Fried Egg', 1.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (61, 'Add a Drink', 'radio', 0, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 62 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (62, 'Patty Doneness', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Medium', 0.00, 0),
(@gid, 'Well Done', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (62, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Patty', 3.50, 0),
(@gid, 'Cheese Slice', 1.00, 1),
(@gid, 'Fried Egg', 1.00, 2),
(@gid, 'Bacon', 1.80, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (62, 'Add a Drink', 'radio', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 63 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (63, 'Fish Portion', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, '1 Fillet', 0.00, 0),
(@gid, '2 Fillets', 3.50, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (63, 'Sauce', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Tartar Sauce', 0.50, 0),
(@gid, 'Extra Lemon', 0.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (63, 'Add-ons', 'checkbox', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Fries', 2.00, 0),
(@gid, 'Fried Egg', 1.00, 1);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (63, 'Add a Drink', 'radio', 0, 3);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO

-- ---- Product 64 ----
DECLARE @gid INT;
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (64, 'Pasta Base', 'radio', 1, 0);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Aglio Olio', 0.00, 0),
(@gid, 'Tomato', 0.00, 1),
(@gid, 'Creamy Carbonara', 1.00, 2);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (64, 'Add-ons', 'checkbox', 0, 1);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'Extra Chicken', 3.00, 0),
(@gid, 'Cheese', 1.00, 1),
(@gid, 'Mushrooms', 1.00, 2),
(@gid, 'Chilli Flakes', 0.00, 3);
INSERT INTO AddonGroups (productId, title, groupType, isRequired, sortOrder) VALUES (64, 'Add a Drink', 'radio', 0, 2);
SET @gid = SCOPE_IDENTITY();
INSERT INTO AddonOptions (groupId, label, price, sortOrder) VALUES
(@gid, 'No Drink', 0.00, 0),
(@gid, 'Kopi', 1.20, 1),
(@gid, 'Teh', 1.20, 2),
(@gid, 'Soft Drink', 1.50, 3),
(@gid, 'Bottled Water', 1.00, 4);
GO