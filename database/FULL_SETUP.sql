-- ============================================================
-- FULL_SETUP.sql  —  ONE-FILE rebuild of HawkersDB (all features, current)
-- Combines the current team scripts in order:
--   1) qj and kishore masterdata.sql  (master: core tables, 64 products, add-ons,
--      vendor + officer accounts, ~640 sample orders, cardLast4). Self-contained:
--      creates the DB if missing and drops ALL tables first. NEVER drops the database.
--   2) masterdata_timely.sql          (promo codes, feedback WITH vendor replies, complaints)
--   3) orders_promo_columns.sql       (adds promoCode + discount columns to Orders)
--   4) Inspectionpage.sql             (inspections + hygiene grades)
--
-- Superseded / NOT included: promoCodes.sql, feedback_complaints.sql, user_card.sql.
--
-- HOW TO USE: open in SSMS, run the WHOLE file (F5). Safe to re-run.
-- Logins: admin@hawkers.sg/Admin123 · siti@test.com/Password123 ·
--         chickenrice@test.com/Password123 (vendor) · tan@nea.gov.sg/Password123 (officer)
-- ============================================================


-- ############################################################
-- 1) MASTER - core + products + add-ons + orders + vendor/officer accounts
-- ############################################################
-- ============================================================
-- HawkersDB full rebuild (current).sql        (Kishore - Vendor Management)
-- ONE master script that rebuilds HawkersDB from scratch with the CURRENT,
-- LIVE data (real stalls, 64 products WITH images, vendor accounts, agreements).
--
-- This REPLACES the older "DB with Vendor logins.sql", whose seed data had
-- gone stale (old stall names, only 32 image-less placeholder products).
-- Everyone on the team should run THIS file so the shared database matches.
--
-- RUN ORDER:
--   1) kishore_data.sql        (this file - builds everything)
--   2) ProductOptions.sql      (addons - needs all 64 products)
--   3) promoCodes.sql
--   4) feedback_complaints.sql
--   5) Inspectionpage.sql
--
--   user_card.sql is NO LONGER NEEDED - cardLast4 is built in below.
--
-- Run the WHOLE file in SSMS. Safe to re-run any time.
--
-- IDs are inserted explicitly (SET IDENTITY_INSERT) so stallId / productId /
-- centerId are IDENTICAL on every machine. That is what keeps the vendor side
-- and the ordering side correlated: an order that points at productId 17 means
-- the same dish for everyone.
-- ============================================================

IF DB_ID('HawkersDB') IS NULL
    CREATE DATABASE HawkersDB;
GO

USE HawkersDB;
GO

-- ------------------------------------------------------------
-- 1) DROP everything, child -> parent (FKs decide the order).
-- ------------------------------------------------------------
-- Dependent tables owned by other teammates must be dropped FIRST: they
-- hold foreign keys into CartItems / Products / FoodStalls, so those DROPs
-- fail otherwise and the script half-applies.
IF OBJECT_ID('dbo.CartItemAddons',  'U') IS NOT NULL DROP TABLE dbo.CartItemAddons;
IF OBJECT_ID('dbo.AddonOptions',    'U') IS NOT NULL DROP TABLE dbo.AddonOptions;
IF OBJECT_ID('dbo.AddonGroups',     'U') IS NOT NULL DROP TABLE dbo.AddonGroups;
IF OBJECT_ID('dbo.HygieneGrades',   'U') IS NOT NULL DROP TABLE dbo.HygieneGrades;
IF OBJECT_ID('dbo.Inspections',     'U') IS NOT NULL DROP TABLE dbo.Inspections;
IF OBJECT_ID('dbo.Feedback',        'U') IS NOT NULL DROP TABLE dbo.Feedback;
IF OBJECT_ID('dbo.Complaints',      'U') IS NOT NULL DROP TABLE dbo.Complaints;
IF OBJECT_ID('dbo.PromoCodes',      'U') IS NOT NULL DROP TABLE dbo.PromoCodes;
IF OBJECT_ID('dbo.StallAgreements',   'U') IS NOT NULL DROP TABLE dbo.StallAgreements;
IF OBJECT_ID('dbo.RentalPayments',    'U') IS NOT NULL DROP TABLE dbo.RentalPayments;   -- legacy
IF OBJECT_ID('dbo.RentalAgreements',  'U') IS NOT NULL DROP TABLE dbo.RentalAgreements; -- legacy
IF OBJECT_ID('dbo.MenuItems',         'U') IS NOT NULL DROP TABLE dbo.MenuItems;        -- legacy
IF OBJECT_ID('dbo.CartItems',         'U') IS NOT NULL DROP TABLE dbo.CartItems;
IF OBJECT_ID('dbo.OrderItems',        'U') IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.Orders',            'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Products',          'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.Users',             'U') IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.FoodStalls',        'U') IS NOT NULL DROP TABLE dbo.FoodStalls;
IF OBJECT_ID('dbo.HawkerCenters',     'U') IS NOT NULL DROP TABLE dbo.HawkerCenters;
GO

-- ------------------------------------------------------------
-- 2) CREATE TABLES
-- ------------------------------------------------------------
CREATE TABLE HawkerCenters (
    centerId     INT IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(100) NOT NULL,
    description  NVARCHAR(500) NULL,
    location     NVARCHAR(200) NULL,
    imagePath    NVARCHAR(300) NULL
);
GO

CREATE TABLE FoodStalls (
    stallId      INT IDENTITY(1,1) PRIMARY KEY,
    centerId     INT NOT NULL,
    name         NVARCHAR(100) NOT NULL,
    imagePath    NVARCHAR(300) NULL,
    CONSTRAINT FK_FoodStalls_Center
        FOREIGN KEY (centerId) REFERENCES HawkerCenters(centerId)
);
GO

-- A vendor account owns exactly one stall. Customers/admin: stallId NULL.
CREATE TABLE Users (
    userId        INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100)  NOT NULL,
    email         NVARCHAR(255)  NOT NULL UNIQUE,
    passwordHash  NVARCHAR(255)  NOT NULL,
    role          NVARCHAR(20)   NOT NULL DEFAULT 'customer',
    stallId       INT            NULL,
    cardLast4     CHAR(4)        NULL,          -- last 4 digits only, never the full number
    createdAt     DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_Users_Role CHECK (role IN ('customer','vendor','admin','officer')),
    CONSTRAINT FK_Users_Stall FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

CREATE TABLE Products (
    productId    INT IDENTITY(1,1) PRIMARY KEY,
    stallId      INT NOT NULL,
    name         NVARCHAR(100) NOT NULL,
    description  NVARCHAR(500) NULL,
    imagePath    NVARCHAR(300) NULL,
    basePrice    DECIMAL(10,2) NOT NULL DEFAULT 0,
    likes        INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_Products_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

CREATE TABLE CartItems (
    cartItemId   INT IDENTITY(1,1) PRIMARY KEY,
    userId       NVARCHAR(100) NOT NULL,
    productId    INT NOT NULL,
    quantity     INT NOT NULL DEFAULT 1,
    unitPrice    DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_CartItems_Product
        FOREIGN KEY (productId) REFERENCES Products(productId)
);
GO

CREATE TABLE Orders (
    orderId      INT IDENTITY(1,1) PRIMARY KEY,
    userId       NVARCHAR(100) NOT NULL,
    centerId     INT NULL,
    subtotal     DECIMAL(10,2) NOT NULL DEFAULT 0,
    total        DECIMAL(10,2) NOT NULL DEFAULT 0,
    paymentMethod NVARCHAR(30) NULL,
    fulfillment  NVARCHAR(30) NULL,
    status       NVARCHAR(30) NOT NULL DEFAULT 'paid',
    createdAt    DATETIME NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE OrderItems (
    orderItemId  INT IDENTITY(1,1) PRIMARY KEY,
    orderId      INT NOT NULL,
    productName  NVARCHAR(100) NOT NULL,
    quantity     INT NOT NULL,
    itemTotal    DECIMAL(10,2) NOT NULL,
    productId    INT NULL,                    -- which product this line was
    stallId      INT NULL,                    -- which stall sold it
    CONSTRAINT FK_OrderItems_Order
        FOREIGN KEY (orderId) REFERENCES Orders(orderId),
    CONSTRAINT FK_OrderItems_Product
        FOREIGN KEY (productId) REFERENCES Products(productId),
    CONSTRAINT FK_OrderItems_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

CREATE TABLE StallAgreements (
    agreementId   INT IDENTITY(1,1) PRIMARY KEY,
    stallId       INT NOT NULL,
    name          NVARCHAR(150) NOT NULL,
    agreementType NVARCHAR(30)  NOT NULL,
    startDate     DATE NOT NULL,
    expiryDate    DATE NOT NULL,
    monthlyRent   DECIMAL(10,2) NULL,
    status        NVARCHAR(20)  NOT NULL DEFAULT 'Active',
    CONSTRAINT FK_StallAgreements_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    CONSTRAINT CHK_StallAgreements_Type
        CHECK (agreementType IN ('Rental','Store Licence','Food Safety','Fire Safety','Other')),
    CONSTRAINT CHK_StallAgreements_Status
        CHECK (status IN ('Active','Terminated')),
    CONSTRAINT CHK_StallAgreements_Dates
        CHECK (expiryDate > startDate)
);
GO

-- ------------------------------------------------------------
-- 3) DATA  (exact snapshot of the live database)
-- ------------------------------------------------------------

-- ---------- HAWKER CENTRES (4) ----------
SET IDENTITY_INSERT HawkerCenters ON;
INSERT INTO HawkerCenters (centerId, name, description, location, imagePath) VALUES
(1, N'Maxwell Food Centre', N'Iconic Chinatown hawker centre famed for chicken rice and traditional local fare.', N'1 Kadayanallur Street', N'/media/images/hawker_center/maxwell_food_centre.svg'),
(2, N'Old Airport Road Food Centre', N'Beloved heritage food centre with a huge variety of classic local dishes.', N'51 Old Airport Road', N'/media/images/hawker_center/51_old_airport_road_food_centre.jpg'),
(3, N'Chinatown Complex Market', N'Singapore''s largest hawker centre with hundreds of stalls.', N'335 Smith Street', N'/media/images/hawker_center/chinatown_complex_market.jpg'),
(4, N'Tiong Bahru Market', N'Beloved neighbourhood market and food centre in Tiong Bahru.', N'30 Seng Poh Road', N'/media/images/hawker_center/tiong_bahru_market.jpg');
SET IDENTITY_INSERT HawkerCenters OFF;
GO

-- ---------- FOOD STALLS (16) ----------
SET IDENTITY_INSERT FoodStalls ON;
INSERT INTO FoodStalls (stallId, centerId, name, imagePath) VALUES
(1, 1, N'Maxwell Chicken Rice', N'/media/images/food_stall/maxwell _food_center/chicken rice stall.jpg'),
(2, 1, N'Maxwell Fuzhou Oyster Cake', N'/media/images/food_stall/maxwell _food_center/maxwell_fuzhou_oyster_cake.jpg'),
(3, 1, N'Taste Fusion Hainanese Chicken Chop', N'/media/images/food_stall/maxwell _food_center/taste_fusion_hiananese_chicken_chop.jpg'),
(4, 1, N'Zhen Zhen Porridge', N'/media/images/food_stall/maxwell _food_center/zhen_zhen_porridge.jpg'),
(5, 2, N'Nam Sing Hokkien Mee', N'/media/images/food_stall/old_airport_road_food_center/nam_sing_hokkien_mee.jpg'),
(6, 2, N'Xin Mei Xiang Lor Mee', N'/media/images/food_stall/old_airport_road_food_center/xin_mei_xiang_lor_mee.jpg'),
(7, 2, N'Wang Wang Crispy Curry Puff', N'/media/images/food_stall/old_airport_road_food_center/wang_wang_crispy_curry_puff.jpg'),
(8, 2, N'Super Shiok Nasi Lemak', N'/media/images/food_stall/old_airport_road_food_center/Super Shiok Nasi Lemak.jpg'),
(9, 3, N'Lian He Ben Ji Claypot Rice', N'/media/images/food_stall/chinatown_complex_market/lian_he_ben_ji_claypot.jpg'),
(10, 3, N'Woo Ji Cooked Food', N'/media/images/food_stall/chinatown_complex_market/woo_ji_cooked_food.jpg'),
(11, 3, N'Chang Ji Gourmet', N'/media/images/food_stall/chinatown_complex_market/chang_ji_gourmet.jpg'),
(12, 3, N'Shin Okaya', N'/media/images/food_stall/chinatown_complex_market/Shin Okaya.png'),
(13, 4, N'Tiong Bahru Fried Kway Teow', N'/media/images/food_stall/tiong_bahru_market/tiong_bahru_fried_kway_teow.JPG'),
(14, 4, N'Lor Mee 178', N'/media/images/food_stall/tiong_bahru_market/lor_mee_178.jpg'),
(15, 4, N'Jian Bo Shui Kueh', N'/media/images/food_stall/tiong_bahru_market/jian_bo_shui_kueh.jpg'),
(16, 4, N'Western Stall', N'/media/images/food_stall/tiong_bahru_market/Western Stall.jpg');
SET IDENTITY_INSERT FoodStalls OFF;
GO

-- ---------- USERS (admin + customer + 16 vendors + registered customers) ----------
-- All seeded test accounts use password:  Password123   (stored as a bcrypt hash)
SET IDENTITY_INSERT Users ON;
INSERT INTO Users (userId, name, email, passwordHash, role, stallId) VALUES
(1, N'Admin', N'admin@hawkers.sg', '$2b$10$uH9IybQcFDv189qx2GTTgeIw9cKICO.TiXe9PqYl56s70GzTAxWdi', 'admin', NULL),
(2, N'Siti', N'siti@test.com', '$2b$10$Ba/QQTqV0Gsl6aw9OBxQcewdSe6l3wX.8fOeMb/VT1/vnSG3wc6ri', 'customer', NULL),
(3, N'Maxwell Chicken Rice', N'chickenrice@test.com', '$2b$10$up5QhYDn7wtwCLoRX7ZyX.a7XI.fO0BRS4J1OJ3ODZvaNwTE2JClO', 'vendor', 1),
(4, N'Maxwell Fuzhou Oyster Cake', N'vendor2@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 2),
(5, N'Taste Fusion Hainanese Chicken Chop', N'vendor3@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 3),
(6, N'Zhen Zhen Porridge', N'vendor4@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 4),
(7, N'Nam Sing Hokkien Mee', N'vendor5@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 5),
(8, N'Xin Mei Xiang Lor Mee', N'vendor6@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 6),
(9, N'Wang Wang Crispy Curry Puff', N'vendor7@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 7),
(10, N'Super Shiok Nasi Lemak', N'vendor8@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 8),
(11, N'Lian He Ben Ji Claypot Rice', N'vendor9@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 9),
(12, N'Woo Ji Cooked Food', N'vendor10@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 10),
(13, N'Chang Ji Gourmet', N'vendor11@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 11),
(14, N'Shin Okaya', N'vendor12@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 12),
(15, N'Tiong Bahru Fried Kway Teow', N'vendor13@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 13),
(16, N'Lor Mee 178', N'vendor14@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 14),
(17, N'Jian Bo Shui Kueh', N'vendor15@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 15),
(18, N'Western Stall', N'vendor16@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 16),
(19, N'Kishore', N'grkishore07@gmail.com', '$2b$10$XizY0BkLRYOBGPucmgmK9uGVxomN.3KTOHtYKBhfu7LRuDMpWpOEe', 'customer', NULL),
-- NEA officer accounts (Aswin, for Kaden's inspection feature). Password: Password123
(20, N'Officer Tan Wei Ming', N'tan@nea.gov.sg', '$2b$10$Ba/QQTqV0Gsl6aw9OBxQcewdSe6l3wX.8fOeMb/VT1/vnSG3wc6ri', 'officer', NULL),
(21, N'Officer Nurul Huda',   N'nurul@nea.gov.sg', '$2b$10$Ba/QQTqV0Gsl6aw9OBxQcewdSe6l3wX.8fOeMb/VT1/vnSG3wc6ri', 'officer', NULL);
SET IDENTITY_INSERT Users OFF;
GO

-- ---------- PRODUCTS (64 : the real menu, with image paths) ----------
SET IDENTITY_INSERT Products ON;
INSERT INTO Products (productId, stallId, name, description, imagePath, basePrice, likes) VALUES
(1, 1, N'Steamed Chicken Rice', N'Roasted chicken with fragrant rice', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Maxwell Chicken Rice/Steam Chicken Rice.jpg', 5.00, 42),
(2, 1, N'Roasted Chicken Rice', N'Savoury roasted chicken over fragrant rice.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Maxwell Chicken Rice/Roasted Chicken.webp', 5.50, 30),
(3, 1, N'Roast Pork Rice', N'Crispy roasted pork belly with rice', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Maxwell Chicken Rice/roast pork rice.jpg', 6.00, 21),
(4, 1, N'Lemon Cutlet Rice', N'Crispy chicken cutlet with tangy lemon sauce.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Maxwell Chicken Rice/Lemon Cutlet.jpg', 6.50, 15),
(5, 2, N'Classic Oyster Cake', N'Deep-fried fritter with oysters and minced pork.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Fuzhou Oyster/Classic Oyster.png', 3.00, 55),
(6, 2, N'Egg Oyster Cake', N'Oyster cake with a fried egg on top.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Fuzhou Oyster/Egg Oyster.png', 3.50, 21),
(7, 2, N'Seafood Oyster Cake', N'Loaded with oysters, prawns and squid.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Fuzhou Oyster/Seafood Oyster.png', 4.50, 18),
(8, 2, N'Oyster Cake Set', N'Two oyster cakes with chilli sauce and drink.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Fuzhou Oyster/Oyster Set.png', 5.50, 12),
(9, 3, N'Grilled Chicken Chop', N'Grilled chicken chop with house gravy.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Grill Chicken.png', 7.00, 34),
(10, 3, N'Black Pepper Chicken Chop', N'Chicken chop in bold black pepper sauce.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Black Pepper Chicken Chop.png', 7.50, 26),
(11, 3, N'Mushroom Chicken Chop', N'Chicken chop smothered in mushroom sauce.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Mushroom Chicken.png', 7.50, 19),
(12, 3, N'Chicken Chop Combo', N'Chicken chop with fries and coleslaw.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Chicken Combo.png', 9.00, 14),
(13, 4, N'Century Egg Pork Porridge', N'Smooth congee with century egg and pork.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Porridge/Century egg pork.png', 4.00, 33),
(14, 4, N'Chicken Porridge', N'Comforting congee with shredded chicken.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Porridge/Chicken Porridge.png', 4.00, 19),
(15, 4, N'Fish Slice Porridge', N'Silky congee with fresh sliced fish.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Porridge/Fish Slice Porridge.png', 4.50, 16),
(16, 4, N'Deluxe Porridge', N'Congee with pork, century egg and fish.', N'/media/images/ProductImage/Maxwell Food Centre Stalls/Porridge/Deleuxe Porridge.png', 5.50, 11),
(17, 5, N'Classic Hokkien Mee', N'Wok-fried noodles in rich prawn stock.', N'/media/images/ProductImage/Old Airport Road Stalls/Hokkien Mee/classic.png', 6.00, 48),
(18, 5, N'Prawn Hokkien Mee', N'Hokkien mee with extra fresh prawns.', N'/media/images/ProductImage/Old Airport Road Stalls/Hokkien Mee/Prawn.png', 7.50, 25),
(19, 5, N'Seafood Hokkien Mee', N'Prawn noodles loaded with seafood.', N'/media/images/ProductImage/Old Airport Road Stalls/Hokkien Mee/Seafood.png', 9.00, 17),
(20, 5, N'Mini Hokkien Mee', N'Smaller portion of prawn noodles.', N'/media/images/ProductImage/Old Airport Road Stalls/Hokkien Mee/Mini.png', 4.50, 13),
(21, 6, N'Pork Lor Mee', N'Thick noodles in braised gravy with pork.', N'/media/images/ProductImage/Old Airport Road Stalls/Lor mee/Pork.png', 4.50, 38),
(22, 6, N'Ngoh Hiang Lor Mee', N'Lor mee topped with fried ngoh hiang.', N'/media/images/ProductImage/Old Airport Road Stalls/Lor mee/ngoh hiang.png', 5.50, 20),
(23, 6, N'Seafood Lor Mee', N'Lor mee with prawns and fish slices.', N'/media/images/ProductImage/Old Airport Road Stalls/Lor mee/seafood.png', 6.50, 15),
(24, 6, N'Small Lor Mee', N'Smaller bowl of classic lor mee.', N'/media/images/ProductImage/Old Airport Road Stalls/Lor mee/small.png', 3.50, 10),
(25, 7, N'Chicken Curry Puff', N'Crispy puff filled with curried chicken.', N'/media/images/ProductImage/Old Airport Road Stalls/Curry Puff/Chicken.png', 1.80, 29),
(26, 7, N'Sardine Curry Puff', N'Flaky puff with spiced sardine filling.', N'/media/images/ProductImage/Old Airport Road Stalls/Curry Puff/Sardine.png', 1.80, 18),
(27, 7, N'Otah Curry Puff', N'Curry puff filled with spicy otah.', N'/media/images/ProductImage/Old Airport Road Stalls/Curry Puff/otah.png', 2.00, 15),
(28, 7, N'Mini Curry Puffs', N'A bag of bite-sized curry puffs.', N'/media/images/ProductImage/Old Airport Road Stalls/Curry Puff/mini.png', 3.50, 12),
(29, 8, N'Classic Nasi Lemak', N'Coconut rice with egg, anchovies and sambal.', N'/media/images/ProductImage/Old Airport Road Stalls/Nasi Lemak/Classic.png', 4.00, 44),
(30, 8, N'Chicken Wing Nasi Lemak', N'Nasi lemak with a fried chicken wing.', N'/media/images/ProductImage/Old Airport Road Stalls/Nasi Lemak/Chicken wing.png', 5.50, 31),
(31, 8, N'Chicken Cutlet Nasi Lemak', N'Nasi lemak with crispy chicken cutlet.', N'/media/images/ProductImage/Old Airport Road Stalls/Nasi Lemak/Chicken Cut.png', 6.00, 22),
(32, 8, N'Fish Fillet Nasi Lemak', N'Nasi lemak with golden fish fillet.', N'/media/images/ProductImage/Old Airport Road Stalls/Nasi Lemak/Fish Fillet.png', 6.00, 16),
(33, 9, N'Claypot Chicken Rice', N'Smoky claypot rice with chicken and sausage.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Claypot/Chicken.png', 6.00, 40),
(34, 9, N'Claypot Pork Rib Rice', N'Claypot rice with tender pork ribs.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Claypot/pork rib.png', 7.00, 22),
(35, 9, N'Claypot Fish Head', N'Rich claypot fish head in savoury sauce.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Claypot/fishhead.png', 12.00, 17),
(36, 9, N'Claypot Seafood Tofu', N'Silky tofu and seafood in a claypot.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Claypot/Seafood Tofu.png', 8.50, 13),
(37, 10, N'Chicken Cooked Food', N'House-style braised chicken with rice.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Cooked Food/Chicken.png', 5.00, 27),
(38, 10, N'Prawn Cooked Food', N'Stir-fried prawns with rice.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Cooked Food/Prawn.png', 7.00, 19),
(39, 10, N'Seafood Cooked Food', N'Mixed seafood platter with rice.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Cooked Food/Seafood.png', 8.50, 14),
(40, 10, N'Mini Cooked Food Set', N'Smaller portion cooked food set.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Cooked Food/Mini.png', 4.00, 11),
(41, 11, N'Gourmet Set A', N'Signature gourmet set with main and side.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Gourmet/Set A.png', 8.00, 24),
(42, 11, N'Gourmet Set B', N'Gourmet set with premium main course.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Gourmet/Set B.png', 9.50, 18),
(43, 11, N'Gourmet Set C', N'Deluxe gourmet set for a hearty meal.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Gourmet/Set C.png', 11.00, 13),
(44, 11, N'Braised Herbal Special', N'House braised herbal specialty dish.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Gourmet/Only BH.png', 7.50, 10),
(45, 12, N'Chicken Don', N'Japanese rice bowl with grilled chicken.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Shin Okaya/Chicken Don.png', 8.00, 36),
(46, 12, N'Salmon Don', N'Rice bowl topped with fresh salmon.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Shin Okaya/Salmon don.png', 12.00, 28),
(47, 12, N'Ebi Don', N'Rice bowl with crispy prawn tempura.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Shin Okaya/Ebi Don.png', 10.00, 20),
(48, 12, N'Katsu Curry', N'Breaded cutlet with Japanese curry rice.', N'/media/images/ProductImage/Chinatown Complex Market Stalls/Shin Okaya/Katsu curry.png', 9.50, 17),
(49, 13, N'Classic Char Kway Teow', N'Smoky wok-fried flat noodles.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Kway Teow/Classic.png', 5.00, 51),
(50, 13, N'Cockle Char Kway Teow', N'Char kway teow loaded with cockles.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Kway Teow/cockles.png', 6.00, 23),
(51, 13, N'Prawn Char Kway Teow', N'Char kway teow with fresh prawns.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Kway Teow/prawn.png', 6.50, 18),
(52, 13, N'Seafood Char Kway Teow', N'Char kway teow with mixed seafood.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Kway Teow/seafood.png', 7.50, 14),
(53, 14, N'Classic Lor Mee', N'Thick noodles in starchy braised gravy.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Lor Mee/classic.png', 4.00, 39),
(54, 14, N'Chicken Lor Mee', N'Lor mee topped with braised chicken.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Lor Mee/Chicken.png', 5.00, 21),
(55, 14, N'Prawn Lor Mee', N'Lor mee with succulent prawns.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Lor Mee/prawn.png', 6.00, 16),
(56, 14, N'Mini Lor Mee', N'Smaller bowl of lor mee.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Lor Mee/mini.png', 3.00, 12),
(57, 15, N'Shui Kueh (3 pc)', N'Steamed rice cakes with preserved radish.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Shui Kueh/3 pc.png', 2.00, 30),
(58, 15, N'Shui Kueh (5 pc)', N'Five steamed rice cakes with chai poh.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Shui Kueh/5 pc.png', 3.00, 22),
(59, 15, N'Chee Cheong Fun', N'Silky rice noodle rolls with sweet sauce.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Shui Kueh/Chee Cheong Fun.png', 3.00, 18),
(60, 15, N'Shui Kueh Set', N'Shui kueh with chee cheong fun combo.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Shui Kueh/Set.png', 5.00, 13),
(61, 16, N'Chicken Chop', N'Grilled chicken chop with fries and salad.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Western/Chicken Chop.png', 8.00, 35),
(62, 16, N'Beef Burger', N'Juicy beef patty burger with fries.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Western/Beef Burger.png', 9.00, 26),
(63, 16, N'Fish & Chips', N'Battered fish fillet with golden fries.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Western/F & C.png', 8.50, 20),
(64, 16, N'Grilled Chicken Pasta', N'Pasta tossed with grilled chicken.', N'/media/images/ProductImage/Tiong Bahru Market Stalls/Western/Grilled Chicken Pasta.png', 8.50, 15);
SET IDENTITY_INSERT Products OFF;
GO

-- ---------- STALL AGREEMENTS / LICENCES ----------
-- Dates use DATEADD relative to today so the Expired / Expiring Soon
-- badges always demo correctly no matter when you rebuild.
DECLARE @t DATE = CAST(GETDATE() AS DATE);
INSERT INTO StallAgreements (stallId, name, agreementType, startDate, expiryDate, monthlyRent, status) VALUES
(1, 'Stall Unit 01-10 Tenancy',         'Rental',        DATEADD(day,-335,@t), DATEADD(day, 395,@t), 1850.00, 'Active'),
(1, 'SFA Food Shop Licence',            'Food Safety',   DATEADD(day,-351,@t), DATEADD(day,  14,@t), NULL,    'Active'),
(1, 'Business Registration (ACRA)',     'Store Licence', DATEADD(day,-700,@t), DATEADD(day, 760,@t), NULL,    'Active'),
(1, 'Fire Safety Certificate (SCDF)',   'Fire Safety',   DATEADD(day,-180,@t), DATEADD(day, 185,@t), NULL,    'Active'),
(2, 'Stall Unit 01-11 Tenancy',         'Rental',        DATEADD(day, -60,@t), DATEADD(day, 670,@t), 1600.00, 'Active'),
(2, 'SFA Food Shop Licence',            'Food Safety',   DATEADD(day,-385,@t), DATEADD(day, -20,@t), NULL,    'Active'),
(2, 'Business Registration (ACRA)',     'Store Licence', DATEADD(day,-500,@t), DATEADD(day, 230,@t), NULL,    'Active'),
(2, 'Fire Safety Certificate (SCDF)',   'Fire Safety',   DATEADD(day, -90,@t), DATEADD(day, 275,@t), NULL,    'Active'),
(3, 'Stall Unit 01-12 Tenancy',         'Rental',        DATEADD(day,-400,@t), DATEADD(day, 330,@t), 1400.00, 'Active'),
(3, 'SFA Food Shop Licence',            'Food Safety',   DATEADD(day,-100,@t), DATEADD(day, 265,@t), NULL,    'Active'),
(3, 'Old Tenancy (2024-2025)',          'Rental',        DATEADD(day,-800,@t), DATEADD(day, -70,@t), 1250.00, 'Terminated'),
(4, 'Stall Unit 01-15 Tenancy',         'Rental',        DATEADD(day, -30,@t), DATEADD(day, 700,@t), 2100.00, 'Active'),
(4, 'Fire Safety Certificate (SCDF)',   'Fire Safety',   DATEADD(day, -10,@t), DATEADD(day, 355,@t), NULL,    'Active'),
(5,  'Stall Unit 02-01 Tenancy', 'Rental', DATEADD(day,-120,@t), DATEADD(day, 610,@t), 1750.00, 'Active'),
(6,  'Stall Unit 02-02 Tenancy', 'Rental', DATEADD(day,-250,@t), DATEADD(day, 480,@t), 1900.00, 'Active'),
(7,  'Stall Unit 02-03 Tenancy', 'Rental', DATEADD(day,-500,@t), DATEADD(day, 230,@t), 1500.00, 'Active'),
(8,  'Stall Unit 02-04 Tenancy', 'Rental', DATEADD(day, -45,@t), DATEADD(day, 685,@t), 1650.00, 'Active'),
(9,  'Stall Unit 03-01 Tenancy', 'Rental', DATEADD(day,-300,@t), DATEADD(day, 430,@t), 1300.00, 'Active'),
(10, 'Stall Unit 03-02 Tenancy', 'Rental', DATEADD(day,-150,@t), DATEADD(day, 580,@t), 1450.00, 'Active'),
(11, 'Stall Unit 03-03 Tenancy', 'Rental', DATEADD(day,-600,@t), DATEADD(day, 130,@t), 1550.00, 'Active'),
(12, 'Stall Unit 03-04 Tenancy', 'Rental', DATEADD(day, -20,@t), DATEADD(day, 710,@t), 1400.00, 'Active'),
(13, 'Stall Unit 04-01 Tenancy', 'Rental', DATEADD(day,-365,@t), DATEADD(day, 365,@t), 2200.00, 'Active'),
(14, 'Stall Unit 04-02 Tenancy', 'Rental', DATEADD(day,-200,@t), DATEADD(day, 530,@t), 2400.00, 'Active'),
(15, 'Stall Unit 04-03 Tenancy', 'Rental', DATEADD(day, -80,@t), DATEADD(day, 650,@t), 2000.00, 'Active'),
(16, 'Stall Unit 04-04 Tenancy', 'Rental', DATEADD(day,-420,@t), DATEADD(day, 310,@t), 1200.00, 'Active');
GO

PRINT 'HawkersDB rebuild complete: 4 centres, 16 stalls, 19 user accounts, 64 products (with images), 25 agreements.';
GO


-- ================================================================
-- ================================================================
-- PART 2 - PRODUCT ADDONS   (QJ - Customer)
-- Appended from ProductOptions.sql. Runs after the products above
-- exist, so the productId references below always resolve.
-- ================================================================
-- ================================================================

-- ===============================================================
-- ProductAddons.sql
-- Product customisation options (addons) for all 64 products.
-- Run AFTER RealStallData.sql (needs Products + CartItems to exist).
-- Safe to re-run: drops the addon tables first.

-- RUN ORDER:
--   1) DB with Vendor logins.sql   (master - builds everything else)
--   2) ProductOptions.sql (this file)
--   3) promoCodes.sql
--   4) feedback_complaints.sql   
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


-- ================================================================
-- ================================================================
-- PART 3 - SAMPLE ORDERS  (Kishore - Vendor Management, Sprint 3)
-- Seeds Orders + OrderItems so BOTH the customer Order History page AND
-- the vendor Stall Performance dashboard have real data to show.
-- On a freshly rebuilt DB nobody has "checked out" yet, so without this
-- block Orders/OrderItems are empty and every one of those pages renders
-- a blank / zeroed state.
--
-- WHAT THIS GENERATES
--   * ~640 orders spread over the last 150 days. The date is recent-weighted
--     (a squared random draw) so there are more orders lately - that makes the
--     dashboard's trend line climb and the "vs previous period" arrows turn
--     positive, and keeps the freshest orders at the top of Order History.
--   * Order times land in real meal windows (breakfast / lunch / dinner) so
--     the "Peak Hours" chart on the performance page is meaningful.
--   * Stalls are filled by even rotation, so ALL 16 vendors' dashboards get
--     sales - no vendor ever logs in to an empty page.
--   * Every line item carries productId AND stallId, so the performance model
--     links each sale straight to the stall (its most accurate 'stallId' mode)
--     instead of guessing by product name.
--   * ~1 in 20 orders is 'cancelled'. The revenue maths correctly leaves those
--     out, which is exactly the behaviour we want to demonstrate.
--
-- WHO OWNS THE ORDERS
--   The two real customer logins get a modest, believable number of orders
--   each so their Order History pages look right when you log in:
--       Kishore (userId 19, grkishore07@gmail.com)  -> first 24 orders
--       Siti    (userId 2,  siti@test.com)          -> next  20 orders
--   The rest are attributed to walk-in customer ids (1001..1040). Orders.userId
--   is just a string with no FK, so these are harmless: they still power the
--   vendor dashboards and the admin analytics totals, they simply don't clutter
--   any one person's history page.
--
-- Money mirrors backend/models/orderModel.js calculateFees() exactly:
--   delivery = +$5 fee plus the shortfall up to the $12 minimum; takeaway = free.
-- ================================================================
-- ================================================================
USE HawkersDB;
GO

SET NOCOUNT ON;

-- Clean slate so re-running just this block on its own never double-seeds.
-- (The full rebuild at the top of the file already drops these tables, so on
--  a normal whole-file run this DELETE simply hits two empty tables.)
DELETE FROM OrderItems;
DELETE FROM Orders;
GO

DECLARE @N INT = 640;          -- total orders to create
DECLARE @i INT = 1;

DECLARE @orderId INT, @stallId INT, @centerId INT, @userId NVARCHAR(100);
DECLARE @createdAt DATETIME, @daysAgo INT, @hour INT, @minute INT;
DECLARE @fulfillment NVARCHAR(30), @payment NVARCHAR(30), @status NVARCHAR(30);
DECLARE @lines INT, @k INT, @productId INT, @qty INT;
DECLARE @pname NVARCHAR(100), @price DECIMAL(10,2);
DECLARE @subtotal DECIMAL(10,2), @total DECIMAL(10,2), @minFee DECIMAL(10,2);
DECLARE @r FLOAT;

WHILE @i <= @N
BEGIN
    -- Even rotation guarantees every stall gets a fair share of sales.
    SET @stallId  = ((@i - 1) % 16) + 1;
    SET @centerId = (SELECT centerId FROM FoodStalls WHERE stallId = @stallId);

    -- First 24 orders -> Kishore, next 20 -> Siti, the rest -> walk-in ids.
    SET @userId =
        CASE WHEN @i <= 24 THEN N'19'
             WHEN @i <= 44 THEN N'2'
             ELSE CONVERT(NVARCHAR(100), 1001 + (@i % 40)) END;

    -- Recent-weighted day (0 = today). Squaring a 0..1 draw bunches orders
    -- toward the present, so the trend lines climb over the window.
    SET @r = RAND(CHECKSUM(NEWID()));
    SET @daysAgo = CAST(150.0 * (@r * @r) AS INT);

    -- Drop the order into a real meal window so Peak Hours is realistic.
    SET @r = RAND(CHECKSUM(NEWID()));
    SET @hour =
        CASE WHEN @r < 0.30 THEN 7  + (ABS(CHECKSUM(NEWID())) % 4)    -- breakfast 07-10
             WHEN @r < 0.75 THEN 11 + (ABS(CHECKSUM(NEWID())) % 4)    -- lunch     11-14
             ELSE                18 + (ABS(CHECKSUM(NEWID())) % 4) END; -- dinner   18-21
    SET @minute = ABS(CHECKSUM(NEWID())) % 60;
    SET @createdAt =
        DATEADD(minute, @minute,
        DATEADD(hour,   @hour,
        CAST(DATEADD(day, -@daysAgo, CAST(GETDATE() AS date)) AS DATETIME)));

    SET @fulfillment = CASE WHEN RAND(CHECKSUM(NEWID())) < 0.60 THEN 'takeaway' ELSE 'delivery' END;
    SET @payment =
        CASE ABS(CHECKSUM(NEWID())) % 3 WHEN 0 THEN 'card' WHEN 1 THEN 'paynow' ELSE 'cash' END;
    SET @status = CASE WHEN ABS(CHECKSUM(NEWID())) % 20 = 0 THEN 'cancelled' ELSE 'paid' END;

    -- Header first; subtotal/total are backfilled once the lines are known.
    INSERT INTO Orders (userId, centerId, subtotal, total, paymentMethod, fulfillment, status, createdAt)
    VALUES (@userId, @centerId, 0, 0, @payment, @fulfillment, @status, @createdAt);
    SET @orderId = SCOPE_IDENTITY();

    -- 1..3 line items, all from THIS stall's four dishes. The first (most-liked)
    -- dish is chosen most often, so Top Dishes has a clear best-seller.
    SET @lines = 1 + (ABS(CHECKSUM(NEWID())) % 3);
    SET @subtotal = 0;
    SET @k = 1;
    WHILE @k <= @lines
    BEGIN
        SET @r = RAND(CHECKSUM(NEWID()));
        SET @productId = (@stallId - 1) * 4 +
            CASE WHEN @r < 0.45 THEN 1
                 WHEN @r < 0.72 THEN 2
                 WHEN @r < 0.89 THEN 3
                 ELSE 4 END;
        SELECT @pname = name, @price = basePrice FROM Products WHERE productId = @productId;

        SET @r = RAND(CHECKSUM(NEWID()));
        SET @qty = CASE WHEN @r < 0.55 THEN 1 WHEN @r < 0.85 THEN 2 ELSE 3 END;

        INSERT INTO OrderItems (orderId, productName, quantity, itemTotal, productId, stallId)
        VALUES (@orderId, @pname, @qty, @price * @qty, @productId, @stallId);

        SET @subtotal = @subtotal + (@price * @qty);
        SET @k = @k + 1;
    END

    -- Fees: identical rules to orderModel.calculateFees().
    SET @minFee = 0;
    IF @fulfillment = 'delivery'
    BEGIN
        IF @subtotal < 12.00 SET @minFee = 12.00 - @subtotal;
        SET @total = @subtotal + 5.00 + @minFee;
    END
    ELSE
        SET @total = @subtotal;

    UPDATE Orders SET subtotal = @subtotal, total = @total WHERE orderId = @orderId;

    SET @i = @i + 1;
END
GO

DECLARE @orders INT     = (SELECT COUNT(*) FROM Orders);
DECLARE @items  INT     = (SELECT COUNT(*) FROM OrderItems);
DECLARE @rev DECIMAL(12,2) = (SELECT ISNULL(SUM(total),0) FROM Orders WHERE status <> 'cancelled');
PRINT 'PART 3 complete: ' + CONVERT(VARCHAR, @orders) + ' orders, '
    + CONVERT(VARCHAR, @items) + ' line items, $'
    + CONVERT(VARCHAR, @rev) + ' revenue seeded for Order History + Stall Performance.';
GO

-- ############################################################
-- 2) masterdata_timely.sql - promo codes, feedback (vendor replies), complaints
-- ############################################################
-- ============================================================
-- masterdata_timely.sql
-- Promo codes, feedback (with vendor replies) and complaints:
-- tables, indexes and sample data in one script.
--
-- Run in SSMS: open, press Execute (F5).
--
-- ------------------------------------------------------------
-- NEEDS ALREADY IN PLACE
-- ------------------------------------------------------------
-- HawkersDB with a fully populated FoodStalls table. All three
-- tables have a foreign key to FoodStalls(stallId), and the
-- sample data now covers all 16 stalls, so the full set from the
-- main build has to be there:
--    1 Maxwell Chicken Rice             9 Lian He Ben Ji Claypot Rice
--    2 Maxwell Fuzhou Oyster Cake      10 Woo Ji Cooked Food
--    3 Taste Fusion Hainanese Chicken  11 Chang Ji Gourmet
--    4 Zhen Zhen Porridge              12 Shin Okaya
--    5 Nam Sing Hokkien Mee            13 Tiong Bahru Fried Kway Teow
--    6 Xin Mei Xiang Lor Mee           14 Lor Mee 178
--    7 Wang Wang Crispy Curry Puff     15 Jian Bo Shui Kueh
--    8 Super Shiok Nasi Lemak          16 Western Stall
-- Section 1 stops the script with one readable message if
-- FoodStalls is missing, rather than three foreign key errors.
--
-- Every review and complaint is written about the food that
-- stall actually sells. If you move a row to a different
-- stallId, rewrite the text to match or the demo reads oddly -
-- a porridge complaint filed against the curry puff stall.
--
-- ------------------------------------------------------------
-- RE-RUNNING
-- ------------------------------------------------------------
-- Drops and rebuilds these three tables, so any codes, reviews
-- or complaints entered through the app since the last run are
-- wiped. Every other table - stalls, users, products, orders,
-- inspections - is untouched.
--
-- ------------------------------------------------------------
-- TWO RULES BUILT INTO THE SCHEMA
-- ------------------------------------------------------------
--  * Every promo code belongs to exactly one stall. stallId is
--    NOT NULL, so a platform-wide code cannot be created at all,
--    by an admin or by anyone else. If the admin pages currently
--    post a code with no stallId, that insert will now fail -
--    they need to pick a stall.
--
--  * A vendor cannot edit or delete a review; that would defeat
--    the point of public reviews. Replying is the one thing they
--    can do, so the reply sits in its own column beside the
--    customer's comment instead of changing it.
--
-- All dates are relative to GETDATE(), so the sample data never
-- drifts into the past.
-- ============================================================

USE HawkersDB;
GO

-- ------------------------------------------------------------
-- 1) PREREQUISITE CHECK
--    NOEXEC compiles the rest of the script without running it,
--    so you get one clear message instead of a cascade of
--    errors. Switched off again at the very end.
-- ------------------------------------------------------------
IF OBJECT_ID('dbo.FoodStalls', 'U') IS NULL
BEGIN
    RAISERROR('FoodStalls not found in this database. Run the main HawkersDB build first - PromoCodes, Feedback and Complaints all reference it.', 16, 1);
    SET NOEXEC ON;
END
GO

-- ------------------------------------------------------------
-- 2) DROP
--    Nothing else references these three, so the order is free.
-- ------------------------------------------------------------
IF OBJECT_ID('dbo.PromoCodes', 'U') IS NOT NULL DROP TABLE dbo.PromoCodes;
IF OBJECT_ID('dbo.Feedback',   'U') IS NOT NULL DROP TABLE dbo.Feedback;
IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;
GO

-- ------------------------------------------------------------
-- 3) TABLES
-- ------------------------------------------------------------

-- Every code is owned by one stall, and a vendor may only read or write
-- rows where stallId matches their own stall.
CREATE TABLE PromoCodes (
    promoId       INT IDENTITY(1,1) PRIMARY KEY,      -- auto-numbered unique id
    stallId       INT           NOT NULL,             -- owning stall; there are no platform-wide codes
    code          NVARCHAR(50)  NOT NULL UNIQUE,      -- e.g. 'SAVE5'
    discountType  NVARCHAR(10)  NOT NULL,             -- 'percent' or 'fixed'
    discountValue DECIMAL(6,2)  NOT NULL,             -- 10 = 10% off, or 5.00 = $5 off
    expiryDate    DATE          NOT NULL,             -- code works up to & including this day
    usageLimit    INT           NOT NULL,             -- max number of redemptions allowed
    timesUsed     INT           NOT NULL DEFAULT 0,   -- redemptions so far
    isActive      BIT           NOT NULL DEFAULT 1,   -- 1 = live, 0 = switched off
    CONSTRAINT FK_PromoCodes_Stall FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    -- UNIQUE on code is global, not per stall: a customer types a code and it
    -- resolves to exactly one stall with no ambiguity. The cost is that two
    -- stalls cannot both use 'SAVE5'.
    CONSTRAINT CHK_PromoCodes_Type    CHECK (discountType IN ('percent', 'fixed')),
    CONSTRAINT CHK_PromoCodes_Value   CHECK (discountValue > 0),
    CONSTRAINT CHK_PromoCodes_Percent CHECK (discountType <> 'percent' OR discountValue <= 100),
    CONSTRAINT CHK_PromoCodes_Usage   CHECK (usageLimit >= 1 AND timesUsed >= 0)
);
GO

-- A customer's public review, plus the stall's reply to it.
CREATE TABLE Feedback (
    feedbackId      INT IDENTITY(1,1) PRIMARY KEY,
    stallId         INT NOT NULL,
    userId          NVARCHAR(100) NOT NULL,
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         NVARCHAR(1000) NULL,
    createdAt       DATETIME NOT NULL DEFAULT GETDATE(),
    -- The stall's public response, e.g. "Sorry about the wait - we've
    -- added a second server at lunch." NULL until the vendor replies.
    vendorReply     NVARCHAR(1000) NULL,
    -- When the reply was written, so the UI can show "replied on 3 Aug".
    vendorRepliedAt DATETIME NULL,
    CONSTRAINT FK_Feedback_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

-- Private: goes to the admin queue, not onto the stall's public page.
CREATE TABLE Complaints (
    complaintId  INT IDENTITY(1,1) PRIMARY KEY,
    stallId      INT NOT NULL,
    userId       NVARCHAR(100) NOT NULL,
    category     NVARCHAR(50) NULL,                      -- e.g. Hygiene, Service
    description  NVARCHAR(1000) NOT NULL,
    status       NVARCHAR(20) NOT NULL DEFAULT 'Open',   -- Open / Resolved
    createdAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Complaints_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    CONSTRAINT CHK_Complaints_Status CHECK (status IN ('Open', 'Resolved'))
);
GO

-- Every vendor and admin page filters by stall ("my codes", "my reviews",
-- complaints against stall 4), and a foreign key does not create an index
-- on its own.
CREATE INDEX IX_PromoCodes_Stall ON PromoCodes(stallId);
CREATE INDEX IX_Feedback_Stall   ON Feedback(stallId, createdAt DESC);
CREATE INDEX IX_Complaints_Stall ON Complaints(stallId, status);
GO

-- ------------------------------------------------------------
-- 4) SAMPLE DATA - promo codes
--    Every stall gets a live code, so no vendor logs in to an
--    empty list; stall 1 has two. The last three rows are
--    deliberately unusable - one expired, one at its limit, one
--    switched off - so the failing branches of the validate
--    endpoint have something to return in Postman. Delete that
--    block if you only want working codes. Codes are named after
--    the stall's food and must stay globally unique.
-- ------------------------------------------------------------
INSERT INTO PromoCodes (stallId, code, discountType, discountValue, expiryDate, usageLimit, timesUsed, isActive) VALUES
-- Live codes, one per stall (two for stall 1).
( 1, 'CHICKEN1',   'fixed',    1.00, CAST(DATEADD(MONTH,  4, GETDATE()) AS DATE), 200,  12, 1),
( 1, 'TIANTIAN15', 'percent', 15.00, CAST(DATEADD(MONTH,  2, GETDATE()) AS DATE),  80,   5, 1),
( 2, 'OYSTER2',    'fixed',    2.00, CAST(DATEADD(MONTH,  5, GETDATE()) AS DATE), 150,   0, 1),
( 3, 'CHOP10',     'percent', 10.00, CAST(DATEADD(MONTH,  3, GETDATE()) AS DATE), 100,  18, 1),
( 4, 'PORRIDGE1',  'fixed',    1.00, CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 250,  41, 1),
( 5, 'HOKKIEN10',  'percent', 10.00, CAST(DATEADD(MONTH,  3, GETDATE()) AS DATE), 120,   3, 1),
( 6, 'LORMEE5',    'percent',  5.00, CAST(DATEADD(MONTH,  2, GETDATE()) AS DATE), 180,  76, 1),
( 7, 'CURRYPUFF1', 'fixed',    1.00, CAST(DATEADD(MONTH,  4, GETDATE()) AS DATE), 300, 112, 1),
( 8, 'NASI12',     'percent', 12.00, CAST(DATEADD(MONTH,  5, GETDATE()) AS DATE), 160,  29, 1),
( 9, 'CLAYPOT2',   'fixed',    2.00, CAST(DATEADD(MONTH,  3, GETDATE()) AS DATE),  90,   7, 1),
(10, 'WOOJI8',     'percent',  8.00, CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 200,  54, 1),
(11, 'CHANGJI1',   'fixed',    1.00, CAST(DATEADD(MONTH,  2, GETDATE()) AS DATE), 140,  33, 1),
(12, 'OKAYA15',    'percent', 15.00, CAST(DATEADD(MONTH,  4, GETDATE()) AS DATE), 110,   9, 1),
(13, 'KWAYTEOW2',  'fixed',    2.00, CAST(DATEADD(MONTH,  5, GETDATE()) AS DATE), 220,  88, 1),
(14, 'LORMEE178',  'percent', 10.00, CAST(DATEADD(MONTH,  3, GETDATE()) AS DATE), 130,  21, 1),
(15, 'SHUIKUEH1',  'fixed',    1.00, CAST(DATEADD(MONTH,  6, GETDATE()) AS DATE), 260,  95, 1),
(16, 'WESTERN20',  'percent', 20.00, CAST(DATEADD(MONTH,  2, GETDATE()) AS DATE), 100,  16, 1),
-- Not usable, one per failure branch. Each of these three stalls also has
-- a live code above, so no vendor is left holding only a dead one.
( 3, 'CHOPCNY',    'percent', 20.00, CAST(DATEADD(MONTH, -1, GETDATE()) AS DATE), 150,  63, 1),  -- expired last month
( 9, 'CLAYPOT50',  'fixed',    3.00, CAST(DATEADD(MONTH,  5, GETDATE()) AS DATE),  50,  50, 1),  -- usage limit reached
(16, 'WESTERN30',  'percent', 30.00, CAST(DATEADD(MONTH,  4, GETDATE()) AS DATE), 100,  22, 0);  -- switched off by the vendor
GO

-- ------------------------------------------------------------
-- 5) SAMPLE DATA - feedback
--    Two reviews per stall, 32 in all, dated between yesterday
--    and six weeks ago so every stall page has a rating and a
--    "recent reviews" list with a real order to it.
-- ------------------------------------------------------------
DECLARE @t DATETIME = GETDATE();

INSERT INTO Feedback (stallId, userId, rating, comment, createdAt) VALUES
-- Maxwell Food Centre
( 1, 'user123', 5, 'Tender chicken and fragrant rice. Best in Maxwell!',        DATEADD(day,-12,@t)),
( 1, 'user456', 4, 'Very good but the queue was long.',                         DATEADD(day, -9,@t)),
( 2, 'user789', 5, 'Oyster cake fried to order, crisp and piping hot.',         DATEADD(day,-21,@t)),
( 2, 'user234', 3, 'Tasty, but greasy by the last few bites.',                  DATEADD(day, -6,@t)),
( 3, 'user123', 4, 'Chicken chop was juicy and the sauce is generous.',         DATEADD(day,-30,@t)),
( 3, 'user567', 1, 'Chop was dry, fries were cold, nobody at the counter.',     DATEADD(day, -4,@t)),
( 4, 'user456', 5, 'Smooth porridge and the century egg is not too salty.',     DATEADD(day,-18,@t)),
( 4, 'user123', 2, 'Porridge was lukewarm when served.',                        DATEADD(day, -5,@t)),
-- Old Airport Road Food Centre
( 5, 'user890', 5, 'Great wok hei and the prawn stock really comes through.',   DATEADD(day,-25,@t)),
( 5, 'user789', 4, 'Generous prawns, though I waited twenty minutes.',          DATEADD(day, -8,@t)),
( 6, 'user234', 5, 'Thick gravy with plenty of vinegar and garlic. Classic.',   DATEADD(day,-33,@t)),
( 6, 'user456', 3, 'Gravy was thinner than on my last visit.',                  DATEADD(day, -7,@t)),
( 7, 'user123', 5, 'Flaky pastry and the potato filling is still hot inside.',  DATEADD(day,-27,@t)),
( 7, 'user567', 4, 'Good value, though the sardine ones sold out early.',       DATEADD(day,-11,@t)),
( 8, 'user890', 4, 'Coconut rice is fragrant and the sambal has a real kick.',  DATEADD(day,-22,@t)),
( 8, 'user789', 2, 'Chicken wing was reheated and tough.',                      DATEADD(day, -3,@t)),
-- Chinatown Complex Market
( 9, 'user456', 5, 'Worth the half hour wait for that crispy rice crust.',      DATEADD(day,-40,@t)),
( 9, 'user234', 3, 'Good claypot rice, but nobody warned us about the wait.',   DATEADD(day,-13,@t)),
(10, 'user123', 4, 'Simple zi char done well, sweet and sour pork was crisp.',  DATEADD(day,-16,@t)),
(10, 'user567', 3, 'Portions have got smaller for the same price.',             DATEADD(day, -2,@t)),
(11, 'user789', 4, 'Friendly uncle and a very filling portion.',                DATEADD(day,-35,@t)),
(11, 'user890', 2, 'Soup was far too salty to finish.',                         DATEADD(day,-10,@t)),
(12, 'user234', 5, 'Rice bowl is a steal at this price, generous topping.',     DATEADD(day,-29,@t)),
(12, 'user456', 4, 'Tasty, but only two seats free at lunch.',                  DATEADD(day,-14,@t)),
-- Tiong Bahru Market
(13, 'user123', 5, 'Smoky char kway teow with plenty of cockles.',              DATEADD(day,-19,@t)),
(13, 'user890', 3, 'A little too sweet for my taste this time.',                DATEADD(day,-26,@t)),
(14, 'user567', 4, 'Gravy is thick and the fried fish stays crunchy.',          DATEADD(day,-23,@t)),
(14, 'user789', 2, 'Twenty five minutes for one bowl of lor mee.',              DATEADD(day, -1,@t)),
(15, 'user456', 5, 'Soft shui kueh with plenty of chai poh. Never fails.',      DATEADD(day,-38,@t)),
(15, 'user234', 4, 'Still the best, but the queue moves slowly.',               DATEADD(day,-15,@t)),
(16, 'user890', 3, 'Fish and chips were fine, batter a bit soggy.',             DATEADD(day,-17,@t)),
(16, 'user123', 4, 'Chicken chop and coleslaw at hawker prices. Good deal.',    DATEADD(day,-20,@t));
GO

-- Five stalls have already answered a review, so the reply UI has content
-- on a fresh database: two thanking a good review, three apologising for a
-- bad one. Each WHERE hits exactly one row - no stall has the same customer
-- twice - and the reply is dated one day after the review it answers.
UPDATE Feedback SET
    vendorReply     = 'Thank you! We are glad you enjoyed it - see you again soon.',
    vendorRepliedAt = DATEADD(day, 1, createdAt)
WHERE stallId = 1 AND userId = 'user123';

UPDATE Feedback SET
    vendorReply     = 'Sorry about that - the porridge should go out hot. We have moved to smaller batches so it is not sitting in the pot.',
    vendorRepliedAt = DATEADD(day, 1, createdAt)
WHERE stallId = 4 AND userId = 'user123';

UPDATE Feedback SET
    vendorReply     = 'Our apologies. Wings are now fried to order after 2pm instead of being kept warm.',
    vendorRepliedAt = DATEADD(day, 1, createdAt)
WHERE stallId = 8 AND userId = 'user789';

UPDATE Feedback SET
    vendorReply     = 'Thanks for the kind words! Cockles come in fresh every morning.',
    vendorRepliedAt = DATEADD(day, 1, createdAt)
WHERE stallId = 13 AND userId = 'user123';

UPDATE Feedback SET
    vendorReply     = 'Sorry for the wait - we have added a second server at lunch.',
    vendorRepliedAt = DATEADD(day, 1, createdAt)
WHERE stallId = 14 AND userId = 'user789';
GO

-- ------------------------------------------------------------
-- 6) SAMPLE DATA - complaints
--    One per stall, 16 in all, across five categories. Six are
--    already Resolved so both sides of the admin queue have
--    something in them.
-- ------------------------------------------------------------
DECLARE @t DATETIME = GETDATE();

INSERT INTO Complaints (stallId, userId, category, description, status, createdAt) VALUES
( 1, 'user456', 'Service',      'Queue was not managed and people cut in front.',          'Resolved', DATEADD(day,-28,@t)),
( 2, 'user123', 'Service',      'Waited very long and received the wrong order.',          'Resolved', DATEADD(day, -8,@t)),
( 3, 'user567', 'Food Quality', 'Chicken chop was undercooked in the middle.',             'Open',     DATEADD(day, -4,@t)),
( 4, 'user456', 'Hygiene',      'Table was not cleaned and the utensils looked dirty.',    'Open',     DATEADD(day, -6,@t)),
( 5, 'user789', 'Hygiene',      'Flies around the drink station all afternoon.',           'Resolved', DATEADD(day,-31,@t)),
( 6, 'user234', 'Pricing',      'Charged fifty cents more than the price on the sign.',    'Open',     DATEADD(day,-12,@t)),
( 7, 'user123', 'Food Quality', 'Curry puff was cold and the pastry had gone soft.',       'Open',     DATEADD(day, -9,@t)),
( 8, 'user890', 'Food Quality', 'Chicken wing tasted like it had been sitting for hours.', 'Open',     DATEADD(day, -3,@t)),
( 9, 'user456', 'Service',      'Told the wait was fifteen minutes, took nearly an hour.', 'Resolved', DATEADD(day,-37,@t)),
(10, 'user567', 'Pricing',      'Portion shrank but the price on the board did not.',      'Open',     DATEADD(day, -2,@t)),
(11, 'user890', 'Hygiene',      'Utensils were wet and had food residue on them.',         'Open',     DATEADD(day,-10,@t)),
(12, 'user234', 'Other',        'No seats free and nobody clearing the trays.',            'Resolved', DATEADD(day,-26,@t)),
(13, 'user123', 'Hygiene',      'Floor around the cooking area was slippery with oil.',    'Open',     DATEADD(day,-21,@t)),
(14, 'user789', 'Service',      'Staff were rude when I asked how long the wait was.',     'Open',     DATEADD(day, -1,@t)),
(15, 'user456', 'Other',        'Stall was closed during posted opening hours, no sign.',  'Resolved', DATEADD(day,-44,@t)),
(16, 'user890', 'Food Quality', 'Fish was soggy and had clearly been reheated.',           'Open',     DATEADD(day,-18,@t));
GO

-- ------------------------------------------------------------
-- 7) VERIFICATION
--    Expected: 20 promo codes (17 usable today), 32 feedback
--    (5 of them answered), 16 complaints (6 Resolved, 10 Open).
-- ------------------------------------------------------------
SELECT 'PromoCodes' AS tableName, COUNT(*) AS totalRows FROM PromoCodes
UNION ALL SELECT 'Feedback',          COUNT(*) FROM Feedback
UNION ALL SELECT 'Feedback replied',  COUNT(*) FROM Feedback WHERE vendorReply IS NOT NULL
UNION ALL SELECT 'Complaints',        COUNT(*) FROM Complaints
UNION ALL SELECT 'PromoCodes usable', COUNT(*) FROM PromoCodes
    WHERE isActive = 1
      AND expiryDate >= CAST(GETDATE() AS DATE)
      AND timesUsed < usageLimit
UNION ALL SELECT 'Complaints open',   COUNT(*) FROM Complaints WHERE status = 'Open';
GO

-- Coverage check: every stall should have a code, a review and a
-- complaint. This should return NO rows.
SELECT 'no feedback' AS gap, s.stallId, s.name
FROM FoodStalls s
LEFT JOIN Feedback f ON f.stallId = s.stallId
WHERE f.feedbackId IS NULL
UNION ALL
SELECT 'no complaints', s.stallId, s.name
FROM FoodStalls s
LEFT JOIN Complaints c ON c.stallId = s.stallId
WHERE c.complaintId IS NULL
UNION ALL
SELECT 'no promo codes', s.stallId, s.name
FROM FoodStalls s
LEFT JOIN PromoCodes p ON p.stallId = s.stallId
WHERE p.promoId IS NULL;
GO

-- Per-stall summary - what the stall listing page should show.
SELECT s.stallId, s.name AS stallName,
       COUNT(f.feedbackId) AS reviews,
       CAST(AVG(CAST(f.rating AS DECIMAL(4,2))) AS DECIMAL(4,2)) AS avgRating,
       SUM(CASE WHEN f.vendorReply IS NOT NULL THEN 1 ELSE 0 END) AS replied,
       -- subquery, not a second join: joining PromoCodes here would
       -- multiply the review rows and wreck the count and the average
       (SELECT COUNT(*) FROM PromoCodes p WHERE p.stallId = s.stallId) AS promoCodes
FROM FoodStalls s
LEFT JOIN Feedback f ON f.stallId = s.stallId
GROUP BY s.stallId, s.name
ORDER BY s.stallId;
GO

-- Each code with the result the validate endpoint should return for it.
SELECT p.promoId, p.stallId, s.name AS stallName, p.code,
       p.discountType, p.discountValue, p.expiryDate,
       p.usageLimit, p.timesUsed, p.isActive,
       CASE WHEN p.isActive = 0                         THEN 'inactive'
            WHEN p.expiryDate < CAST(GETDATE() AS DATE) THEN 'expired'
            WHEN p.timesUsed >= p.usageLimit            THEN 'limit reached'
            ELSE 'valid'
       END AS expectedResult
FROM PromoCodes p
JOIN FoodStalls s ON s.stallId = p.stallId
ORDER BY p.stallId, p.promoId;
GO

-- The five answered reviews, newest first.
SELECT feedbackId, stallId, rating, createdAt, vendorRepliedAt,
       LEFT(vendorReply, 60) AS replyPreview
FROM Feedback
WHERE vendorReply IS NOT NULL
ORDER BY vendorRepliedAt DESC;
GO

-- The admin complaint queue, open ones first.
SELECT complaintId, stallId, category, status, createdAt,
       LEFT(description, 50) AS descriptionPreview
FROM Complaints
ORDER BY CASE WHEN status = 'Open' THEN 0 ELSE 1 END, createdAt DESC;
GO

PRINT 'Ready: 20 promo codes, 32 reviews and 16 complaints across all 16 stalls.';
GO

-- Undo the section 1 guard so the session is left in a normal state.
SET NOEXEC OFF;
GO

-- ############################################################
-- 3) orders_promo_columns.sql - promoCode + discount on Orders
-- ############################################################
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


-- ############################################################
-- 4) Inspectionpage.sql - inspections + hygiene grades
-- ############################################################
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
--   4) Inspectionpage.sql              (this file)
--
-- The master script MUST have been run first: officerId below is a foreign key
-- to Users, and the sample data looks the officers up by their email address.
-- The NEA officer accounts live in the master script alongside the admin and
-- vendor accounts, so there is no separate officer script any more.
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
    RAISERROR('No officer accounts found. Re-run "qj and kishore masterdata.sql" - it seeds the NEA officer accounts that Inspections.officerId points at.', 16, 1);
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
-- The officer accounts are seeded by the MASTER script (Aswin added them to
-- "qj and kishore masterdata.sql"), so they are looked up by email here rather
-- than hard-coded by id. If a third officer is ever added, @raj picks them up
-- automatically; until then it falls back to Officer Nurul so this script still
-- runs against exactly the two accounts that exist today.
DECLARE @tan   INT = (SELECT userId FROM Users WHERE email = N'tan@nea.gov.sg');
DECLARE @nurul INT = (SELECT userId FROM Users WHERE email = N'nurul@nea.gov.sg');
DECLARE @raj   INT = COALESCE(
    (SELECT userId FROM Users WHERE email = N'raj@nea.gov.sg'),
    @nurul);

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
-- status is left out on purpose: the column defaults to 'Scheduled'.
INSERT INTO Inspections (stallId, officerId, scheduledDate) VALUES
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
SELECT status, COUNT(*) AS total FROM Inspections   GROUP BY status;
SELECT grade,  COUNT(*) AS total FROM HygieneGrades GROUP BY grade;
GO

-- Turn execution back on (paired with the SET NOEXEC ON guards in step 0).
SET NOEXEC OFF;
GO

-- ############################################################
-- 5) VIEW ALL TABLES  (row-count summary, then full contents)
-- ############################################################
USE HawkersDB;
GO

SELECT 'HawkerCenters'  AS TableName, COUNT(*) AS [Rows] FROM HawkerCenters
UNION ALL SELECT 'FoodStalls',     COUNT(*) FROM FoodStalls
UNION ALL SELECT 'Users',          COUNT(*) FROM Users
UNION ALL SELECT 'Products',       COUNT(*) FROM Products
UNION ALL SELECT 'CartItems',      COUNT(*) FROM CartItems
UNION ALL SELECT 'Orders',         COUNT(*) FROM Orders
UNION ALL SELECT 'OrderItems',     COUNT(*) FROM OrderItems
UNION ALL SELECT 'StallAgreements',COUNT(*) FROM StallAgreements
UNION ALL SELECT 'AddonGroups',    COUNT(*) FROM AddonGroups
UNION ALL SELECT 'AddonOptions',   COUNT(*) FROM AddonOptions
UNION ALL SELECT 'CartItemAddons', COUNT(*) FROM CartItemAddons
UNION ALL SELECT 'PromoCodes',     COUNT(*) FROM PromoCodes
UNION ALL SELECT 'Feedback',       COUNT(*) FROM Feedback
UNION ALL SELECT 'Complaints',     COUNT(*) FROM Complaints
UNION ALL SELECT 'Inspections',    COUNT(*) FROM Inspections
UNION ALL SELECT 'HygieneGrades',  COUNT(*) FROM HygieneGrades;
GO

SELECT * FROM HawkerCenters;
SELECT * FROM FoodStalls;
SELECT * FROM Users;
SELECT * FROM Products;
SELECT * FROM CartItems;
SELECT * FROM Orders;
SELECT * FROM OrderItems;
SELECT * FROM StallAgreements;
SELECT * FROM AddonGroups;
SELECT * FROM AddonOptions;
SELECT * FROM CartItemAddons;
SELECT * FROM PromoCodes;
SELECT * FROM Feedback;
SELECT * FROM Complaints;
SELECT * FROM Inspections;
SELECT * FROM HygieneGrades;
GO
