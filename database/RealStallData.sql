-- ============================================================
-- HawkersDB_setup.sql
-- Database creation script WITH sample data (assignment deliverable)
-- Run this whole file in SSMS to rebuild the database from scratch.
-- ============================================================

-- 1) CREATE DATABASE ----------------------------------------
IF DB_ID('HawkersDB') IS NULL
    CREATE DATABASE HawkersDB;
GO

USE HawkersDB;
GO

-- 2) DROP existing tables (so the script can be re-run cleanly)
-- Drop in child -> parent order because of foreign keys.
IF OBJECT_ID('dbo.CartItems', 'U') IS NOT NULL DROP TABLE dbo.CartItems;
IF OBJECT_ID('dbo.OrderItems', 'U') IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.FoodStalls', 'U') IS NOT NULL DROP TABLE dbo.FoodStalls;
IF OBJECT_ID('dbo.HawkerCenters', 'U') IS NOT NULL DROP TABLE dbo.HawkerCenters;
GO

-- 3) CREATE TABLES ------------------------------------------
-- Firestore nesting hawker-centers/{}/food-stalls/{}/products/{}
-- becomes relational tables linked by foreign keys.

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

-- Cart: one row per product a user has added.
CREATE TABLE CartItems (
    cartItemId   INT IDENTITY(1,1) PRIMARY KEY,
    userId       NVARCHAR(100) NOT NULL,   -- who owns this cart line
    productId    INT NOT NULL,
    quantity     INT NOT NULL DEFAULT 1,
    unitPrice    DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_CartItems_Product
        FOREIGN KEY (productId) REFERENCES Products(productId)
);
GO

-- Orders: one row per placed order (header).
CREATE TABLE Orders (
    orderId      INT IDENTITY(1,1) PRIMARY KEY,
    userId       NVARCHAR(100) NOT NULL,
    centerId     INT NULL,
    subtotal     DECIMAL(10,2) NOT NULL DEFAULT 0,
    total        DECIMAL(10,2) NOT NULL DEFAULT 0,
    paymentMethod NVARCHAR(30) NULL,
    fulfillment  NVARCHAR(30) NULL,          -- 'delivery' or 'takeaway'
    status       NVARCHAR(30) NOT NULL DEFAULT 'paid',
    createdAt    DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- OrderItems: line items belonging to an order.
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
-- ============================================================
-- SAMPLE DATA — 4 hawker centres, 16 stalls, 64 products
-- imagePath values point at the REAL images reused from the
-- team's previous FED project (kept in their original folders
-- and with their original filenames).
-- ============================================================

-- ---------- HAWKER CENTRES (4) ----------
INSERT INTO HawkerCenters (name, description, location, imagePath) VALUES
('Maxwell Food Centre', 'Iconic Chinatown hawker centre famed for chicken rice and traditional local fare.', '1 Kadayanallur Street', '/media/images/hawker_center/maxwell_food_centre.svg'),
('Old Airport Road Food Centre', 'Beloved heritage food centre with a huge variety of classic local dishes.', '51 Old Airport Road', '/media/images/hawker_center/51_old_airport_road_food_centre.jpg'),
('Chinatown Complex Market', 'Singapore''s largest hawker centre with hundreds of stalls.', '335 Smith Street', '/media/images/hawker_center/chinatown_complex_market.jpg'),
('Tiong Bahru Market', 'Beloved neighbourhood market and food centre in Tiong Bahru.', '30 Seng Poh Road', '/media/images/hawker_center/tiong_bahru_market.jpg');
GO

-- ---------- FOOD STALLS (16 : 4 per centre) ----------
-- centerId 1 = Maxwell Food Centre
INSERT INTO FoodStalls (centerId, name, imagePath) VALUES
(1, 'Maxwell Chicken Rice', '/media/images/food_stall/maxwell _food_center/chicken rice stall.jpg'),
(1, 'Maxwell Fuzhou Oyster Cake', '/media/images/food_stall/maxwell _food_center/maxwell_fuzhou_oyster_cake.jpg'),
(1, 'Taste Fusion Hainanese Chicken Chop', '/media/images/food_stall/maxwell _food_center/taste_fusion_hiananese_chicken_chop.jpg'),
(1, 'Zhen Zhen Porridge', '/media/images/food_stall/maxwell _food_center/zhen_zhen_porridge.jpg');
GO

-- centerId 2 = Old Airport Road Food Centre
INSERT INTO FoodStalls (centerId, name, imagePath) VALUES
(2, 'Nam Sing Hokkien Mee', '/media/images/food_stall/old_airport_road_food_center/nam_sing_hokkien_mee.jpg'),
(2, 'Xin Mei Xiang Lor Mee', '/media/images/food_stall/old_airport_road_food_center/xin_mei_xiang_lor_mee.jpg'),
(2, 'Wang Wang Crispy Curry Puff', '/media/images/food_stall/old_airport_road_food_center/wang_wang_crispy_curry_puff.jpg'),
(2, 'Super Shiok Nasi Lemak', '/media/images/food_stall/old_airport_road_food_center/Super Shiok Nasi Lemak.jpg');
GO

-- centerId 3 = Chinatown Complex Market
INSERT INTO FoodStalls (centerId, name, imagePath) VALUES
(3, 'Lian He Ben Ji Claypot Rice', '/media/images/food_stall/chinatown_complex_market/lian_he_ben_ji_claypot.jpg'),
(3, 'Woo Ji Cooked Food', '/media/images/food_stall/chinatown_complex_market/woo_ji_cooked_food.jpg'),
(3, 'Chang Ji Gourmet', '/media/images/food_stall/chinatown_complex_market/chang_ji_gourmet.jpg'),
(3, 'Shin Okaya', '/media/images/food_stall/chinatown_complex_market/Shin Okaya.png');
GO

-- centerId 4 = Tiong Bahru Market
INSERT INTO FoodStalls (centerId, name, imagePath) VALUES
(4, 'Tiong Bahru Fried Kway Teow', '/media/images/food_stall/tiong_bahru_market/tiong_bahru_fried_kway_teow.JPG'),
(4, 'Lor Mee 178', '/media/images/food_stall/tiong_bahru_market/lor_mee_178.jpg'),
(4, 'Jian Bo Shui Kueh', '/media/images/food_stall/tiong_bahru_market/jian_bo_shui_kueh.jpg'),
(4, 'Western Stall', '/media/images/food_stall/tiong_bahru_market/Western Stall.jpg');
GO

-- ---------- PRODUCTS (64 : 4 per stall) ----------

-- stallId 1 : Maxwell Chicken Rice
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(1, 'Steamed Chicken Rice', 'Tender poached chicken with fragrant rice.', '/media/images/order/Maxwell Food Centre Stalls/Maxwell Chicken Rice/Steam Chicken Rice.jpg', 5.00, 42),
(1, 'Roasted Chicken Rice', 'Savoury roasted chicken over fragrant rice.', '/media/images/order/Maxwell Food Centre Stalls/Maxwell Chicken Rice/Roasted Chicken.webp', 5.50, 30),
(1, 'Roast Pork Rice', 'Crispy roasted pork belly with rice.', '/media/images/order/Maxwell Food Centre Stalls/Maxwell Chicken Rice/roast pork rice.jpg', 6.00, 21),
(1, 'Lemon Cutlet Rice', 'Crispy chicken cutlet with tangy lemon sauce.', '/media/images/order/Maxwell Food Centre Stalls/Maxwell Chicken Rice/Lemon Cutlet.jpg', 6.50, 15);
GO

-- stallId 2 : Maxwell Fuzhou Oyster Cake
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(2, 'Classic Oyster Cake', 'Deep-fried fritter with oysters and minced pork.', '/media/images/order/Maxwell Food Centre Stalls/Fuzhou Oyster/Classic Oyster.png', 3.00, 55),
(2, 'Egg Oyster Cake', 'Oyster cake with a fried egg on top.', '/media/images/order/Maxwell Food Centre Stalls/Fuzhou Oyster/Egg Oyster.png', 3.50, 21),
(2, 'Seafood Oyster Cake', 'Loaded with oysters, prawns and squid.', '/media/images/order/Maxwell Food Centre Stalls/Fuzhou Oyster/Seafood Oyster.png', 4.50, 18),
(2, 'Oyster Cake Set', 'Two oyster cakes with chilli sauce and drink.', '/media/images/order/Maxwell Food Centre Stalls/Fuzhou Oyster/Oyster Set.png', 5.50, 12);
GO

-- stallId 3 : Taste Fusion Hainanese Chicken Chop
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(3, 'Grilled Chicken Chop', 'Grilled chicken chop with house gravy.', '/media/images/order/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Grill Chicken.png', 7.00, 34),
(3, 'Black Pepper Chicken Chop', 'Chicken chop in bold black pepper sauce.', '/media/images/order/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Black Pepper Chicken Chop.png', 7.50, 26),
(3, 'Mushroom Chicken Chop', 'Chicken chop smothered in mushroom sauce.', '/media/images/order/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Mushroom Chicken.png', 7.50, 19),
(3, 'Chicken Chop Combo', 'Chicken chop with fries and coleslaw.', '/media/images/order/Maxwell Food Centre Stalls/Hainanese Chicken Chop/Chicken Combo.png', 9.00, 14);
GO

-- stallId 4 : Zhen Zhen Porridge
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(4, 'Century Egg Pork Porridge', 'Smooth congee with century egg and pork.', '/media/images/order/Maxwell Food Centre Stalls/Porridge/Century egg pork.png', 4.00, 33),
(4, 'Chicken Porridge', 'Comforting congee with shredded chicken.', '/media/images/order/Maxwell Food Centre Stalls/Porridge/Chicken Porridge.png', 4.00, 19),
(4, 'Fish Slice Porridge', 'Silky congee with fresh sliced fish.', '/media/images/order/Maxwell Food Centre Stalls/Porridge/Fish Slice Porridge.png', 4.50, 16),
(4, 'Deluxe Porridge', 'Congee with pork, century egg and fish.', '/media/images/order/Maxwell Food Centre Stalls/Porridge/Deleuxe Porridge.png', 5.50, 11);
GO

-- stallId 5 : Nam Sing Hokkien Mee
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(5, 'Classic Hokkien Mee', 'Wok-fried noodles in rich prawn stock.', '/media/images/order/Old Airport Road Stalls/Hokkien Mee/classic.png', 6.00, 48),
(5, 'Prawn Hokkien Mee', 'Hokkien mee with extra fresh prawns.', '/media/images/order/Old Airport Road Stalls/Hokkien Mee/Prawn.png', 7.50, 25),
(5, 'Seafood Hokkien Mee', 'Prawn noodles loaded with seafood.', '/media/images/order/Old Airport Road Stalls/Hokkien Mee/Seafood.png', 9.00, 17),
(5, 'Mini Hokkien Mee', 'Smaller portion of prawn noodles.', '/media/images/order/Old Airport Road Stalls/Hokkien Mee/Mini.png', 4.50, 13);
GO

-- stallId 6 : Xin Mei Xiang Lor Mee
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(6, 'Pork Lor Mee', 'Thick noodles in braised gravy with pork.', '/media/images/order/Old Airport Road Stalls/Lor mee/Pork.png', 4.50, 38),
(6, 'Ngoh Hiang Lor Mee', 'Lor mee topped with fried ngoh hiang.', '/media/images/order/Old Airport Road Stalls/Lor mee/ngoh hiang.png', 5.50, 20),
(6, 'Seafood Lor Mee', 'Lor mee with prawns and fish slices.', '/media/images/order/Old Airport Road Stalls/Lor mee/seafood.png', 6.50, 15),
(6, 'Small Lor Mee', 'Smaller bowl of classic lor mee.', '/media/images/order/Old Airport Road Stalls/Lor mee/small.png', 3.50, 10);
GO

-- stallId 7 : Wang Wang Crispy Curry Puff
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(7, 'Chicken Curry Puff', 'Crispy puff filled with curried chicken.', '/media/images/order/Old Airport Road Stalls/Curry Puff/Chicken.png', 1.80, 29),
(7, 'Sardine Curry Puff', 'Flaky puff with spiced sardine filling.', '/media/images/order/Old Airport Road Stalls/Curry Puff/Sardine.png', 1.80, 18),
(7, 'Otah Curry Puff', 'Curry puff filled with spicy otah.', '/media/images/order/Old Airport Road Stalls/Curry Puff/otah.png', 2.00, 15),
(7, 'Mini Curry Puffs', 'A bag of bite-sized curry puffs.', '/media/images/order/Old Airport Road Stalls/Curry Puff/mini.png', 3.50, 12);
GO

-- stallId 8 : Super Shiok Nasi Lemak
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(8, 'Classic Nasi Lemak', 'Coconut rice with egg, anchovies and sambal.', '/media/images/order/Old Airport Road Stalls/Nasi Lemak/Classic.png', 4.00, 44),
(8, 'Chicken Wing Nasi Lemak', 'Nasi lemak with a fried chicken wing.', '/media/images/order/Old Airport Road Stalls/Nasi Lemak/Chicken wing.png', 5.50, 31),
(8, 'Chicken Cutlet Nasi Lemak', 'Nasi lemak with crispy chicken cutlet.', '/media/images/order/Old Airport Road Stalls/Nasi Lemak/Chicken Cut.png', 6.00, 22),
(8, 'Fish Fillet Nasi Lemak', 'Nasi lemak with golden fish fillet.', '/media/images/order/Old Airport Road Stalls/Nasi Lemak/Fish Fillet.png', 6.00, 16);
GO

-- stallId 9 : Lian He Ben Ji Claypot Rice
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(9, 'Claypot Chicken Rice', 'Smoky claypot rice with chicken and sausage.', '/media/images/order/Chinatown Complex Market Stalls/Claypot/Chicken.png', 6.00, 40),
(9, 'Claypot Pork Rib Rice', 'Claypot rice with tender pork ribs.', '/media/images/order/Chinatown Complex Market Stalls/Claypot/pork rib.png', 7.00, 22),
(9, 'Claypot Fish Head', 'Rich claypot fish head in savoury sauce.', '/media/images/order/Chinatown Complex Market Stalls/Claypot/fishhead.png', 12.00, 17),
(9, 'Claypot Seafood Tofu', 'Silky tofu and seafood in a claypot.', '/media/images/order/Chinatown Complex Market Stalls/Claypot/Seafood Tofu.png', 8.50, 13);
GO

-- stallId 10 : Woo Ji Cooked Food
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(10, 'Chicken Cooked Food', 'House-style braised chicken with rice.', '/media/images/order/Chinatown Complex Market Stalls/Cooked Food/Chicken.png', 5.00, 27),
(10, 'Prawn Cooked Food', 'Stir-fried prawns with rice.', '/media/images/order/Chinatown Complex Market Stalls/Cooked Food/Prawn.png', 7.00, 19),
(10, 'Seafood Cooked Food', 'Mixed seafood platter with rice.', '/media/images/order/Chinatown Complex Market Stalls/Cooked Food/Seafood.png', 8.50, 14),
(10, 'Mini Cooked Food Set', 'Smaller portion cooked food set.', '/media/images/order/Chinatown Complex Market Stalls/Cooked Food/Mini.png', 4.00, 11);
GO

-- stallId 11 : Chang Ji Gourmet
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(11, 'Gourmet Set A', 'Signature gourmet set with main and side.', '/media/images/order/Chinatown Complex Market Stalls/Gourmet/Set A.png', 8.00, 24),
(11, 'Gourmet Set B', 'Gourmet set with premium main course.', '/media/images/order/Chinatown Complex Market Stalls/Gourmet/Set B.png', 9.50, 18),
(11, 'Gourmet Set C', 'Deluxe gourmet set for a hearty meal.', '/media/images/order/Chinatown Complex Market Stalls/Gourmet/Set C.png', 11.00, 13),
(11, 'Braised Herbal Special', 'House braised herbal specialty dish.', '/media/images/order/Chinatown Complex Market Stalls/Gourmet/Only BH.png', 7.50, 10);
GO

-- stallId 12 : Shin Okaya
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(12, 'Chicken Don', 'Japanese rice bowl with grilled chicken.', '/media/images/order/Chinatown Complex Market Stalls/Shin Okaya/Chicken Don.png', 8.00, 36),
(12, 'Salmon Don', 'Rice bowl topped with fresh salmon.', '/media/images/order/Chinatown Complex Market Stalls/Shin Okaya/Salmon don.png', 12.00, 28),
(12, 'Ebi Don', 'Rice bowl with crispy prawn tempura.', '/media/images/order/Chinatown Complex Market Stalls/Shin Okaya/Ebi Don.png', 10.00, 20),
(12, 'Katsu Curry', 'Breaded cutlet with Japanese curry rice.', '/media/images/order/Chinatown Complex Market Stalls/Shin Okaya/Katsu curry.png', 9.50, 17);
GO

-- stallId 13 : Tiong Bahru Fried Kway Teow
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(13, 'Classic Char Kway Teow', 'Smoky wok-fried flat noodles.', '/media/images/order/Tiong Bahru Market Stalls/Kway Teow/Classic.png', 5.00, 51),
(13, 'Cockle Char Kway Teow', 'Char kway teow loaded with cockles.', '/media/images/order/Tiong Bahru Market Stalls/Kway Teow/cockles.png', 6.00, 23),
(13, 'Prawn Char Kway Teow', 'Char kway teow with fresh prawns.', '/media/images/order/Tiong Bahru Market Stalls/Kway Teow/prawn.png', 6.50, 18),
(13, 'Seafood Char Kway Teow', 'Char kway teow with mixed seafood.', '/media/images/order/Tiong Bahru Market Stalls/Kway Teow/seafood.png', 7.50, 14);
GO

-- stallId 14 : Lor Mee 178
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(14, 'Classic Lor Mee', 'Thick noodles in starchy braised gravy.', '/media/images/order/Tiong Bahru Market Stalls/Lor Mee/classic.png', 4.00, 39),
(14, 'Chicken Lor Mee', 'Lor mee topped with braised chicken.', '/media/images/order/Tiong Bahru Market Stalls/Lor Mee/Chicken.png', 5.00, 21),
(14, 'Prawn Lor Mee', 'Lor mee with succulent prawns.', '/media/images/order/Tiong Bahru Market Stalls/Lor Mee/prawn.png', 6.00, 16),
(14, 'Mini Lor Mee', 'Smaller bowl of lor mee.', '/media/images/order/Tiong Bahru Market Stalls/Lor Mee/mini.png', 3.00, 12);
GO

-- stallId 15 : Jian Bo Shui Kueh
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(15, 'Shui Kueh (3 pc)', 'Steamed rice cakes with preserved radish.', '/media/images/order/Tiong Bahru Market Stalls/Shui Kueh/3 pc.png', 2.00, 30),
(15, 'Shui Kueh (5 pc)', 'Five steamed rice cakes with chai poh.', '/media/images/order/Tiong Bahru Market Stalls/Shui Kueh/5 pc.png', 3.00, 22),
(15, 'Chee Cheong Fun', 'Silky rice noodle rolls with sweet sauce.', '/media/images/order/Tiong Bahru Market Stalls/Shui Kueh/Chee Cheong Fun.png', 3.00, 18),
(15, 'Shui Kueh Set', 'Shui kueh with chee cheong fun combo.', '/media/images/order/Tiong Bahru Market Stalls/Shui Kueh/Set.png', 5.00, 13);
GO

-- stallId 16 : Western Stall
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(16, 'Chicken Chop', 'Grilled chicken chop with fries and salad.', '/media/images/order/Tiong Bahru Market Stalls/Western/Chicken Chop.png', 8.00, 35),
(16, 'Beef Burger', 'Juicy beef patty burger with fries.', '/media/images/order/Tiong Bahru Market Stalls/Western/Beef Burger.png', 9.00, 26),
(16, 'Fish & Chips', 'Battered fish fillet with golden fries.', '/media/images/order/Tiong Bahru Market Stalls/Western/F & C.png', 8.50, 20),
(16, 'Grilled Chicken Pasta', 'Pasta tossed with grilled chicken.', '/media/images/order/Tiong Bahru Market Stalls/Western/Grilled Chicken Pasta.png', 8.50, 15);
GO

PRINT 'Sample data (4 centres, 16 stalls, 64 products) inserted with real images.';
GO