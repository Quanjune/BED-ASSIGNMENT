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
--   1) HawkersDB full rebuild (current).sql   (this file - builds everything)
--   2) ProductOptions.sql
--   3) promoCodes.sql
--   4) feedback_complaints.sql
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
    createdAt     DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_Users_Role CHECK (role IN ('customer','vendor','admin')),
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
    CONSTRAINT FK_OrderItems_Order
        FOREIGN KEY (orderId) REFERENCES Orders(orderId)
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
(19, N'Kishore', N'grkishore07@gmail.com', '$2b$10$XizY0BkLRYOBGPucmgmK9uGVxomN.3KTOHtYKBhfu7LRuDMpWpOEe', 'customer', NULL);
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
