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