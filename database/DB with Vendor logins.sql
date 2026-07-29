-- ============================================================
-- hawkersdb_full_rebuild.sql          (Kishore - Vendor Management)
-- ONE master script that rebuilds HawkersDB from scratch,
-- with sample data (assignment deliverable requirement).
--
--
-- RUN ORDER:
--   1) DB with Vendor logins.sql   (master - builds everything else) (this file)
--   2) ProductOptions.sql
--   3) promoCodes.sql
--   4) feedback_complaints.sql   
--
-- Run the WHOLE file in SSMS. Safe to re-run any time-- ============================================================

IF DB_ID('HawkersDB') IS NULL
    CREATE DATABASE HawkersDB;
GO

USE HawkersDB;
GO

-- ------------------------------------------------------------
-- 1) DROP everything, child -> parent (FKs decide the order).
--    Also drops leftover tables from earlier attempts.
-- ------------------------------------------------------------
IF OBJECT_ID('dbo.StallAgreements',   'U') IS NOT NULL DROP TABLE dbo.StallAgreements;
IF OBJECT_ID('dbo.RentalPayments',    'U') IS NOT NULL DROP TABLE dbo.RentalPayments;   -- legacy
IF OBJECT_ID('dbo.RentalAgreements',  'U') IS NOT NULL DROP TABLE dbo.RentalAgreements; -- legacy
IF OBJECT_ID('dbo.MenuItems',         'U') IS NOT NULL DROP TABLE dbo.MenuItems;        -- legacy
IF OBJECT_ID('dbo.CartItems',         'U') IS NOT NULL DROP TABLE dbo.CartItems;
IF OBJECT_ID('dbo.OrderItems',        'U') IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.Orders',            'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Products',          'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.Users',             'U') IS NOT NULL DROP TABLE dbo.Users;    -- before FoodStalls (FK)
IF OBJECT_ID('dbo.FoodStalls',        'U') IS NOT NULL DROP TABLE dbo.FoodStalls;
IF OBJECT_ID('dbo.HawkerCenters',     'U') IS NOT NULL DROP TABLE dbo.HawkerCenters;
GO

-- ------------------------------------------------------------
-- 2) CREATE TABLES
-- ------------------------------------------------------------

-- (QJ's table - unchanged)
CREATE TABLE HawkerCenters (
    centerId     INT IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(100) NOT NULL,
    description  NVARCHAR(500) NULL,
    location     NVARCHAR(200) NULL,
    imagePath    NVARCHAR(300) NULL
);
GO

-- (QJ's table - unchanged)
CREATE TABLE FoodStalls (
    stallId      INT IDENTITY(1,1) PRIMARY KEY,
    centerId     INT NOT NULL,
    name         NVARCHAR(100) NOT NULL,
    imagePath    NVARCHAR(300) NULL,
    CONSTRAINT FK_FoodStalls_Center
        FOREIGN KEY (centerId) REFERENCES HawkerCenters(centerId)
);
GO

-- (Aswin's table + ONE new column: stallId)
-- A vendor account owns exactly one stall. Customers/admin: stallId NULL.
CREATE TABLE Users (
    userId        INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100)  NOT NULL,
    email         NVARCHAR(255)  NOT NULL UNIQUE,
    passwordHash  NVARCHAR(255)  NOT NULL,          -- bcrypt hash only
    role          NVARCHAR(20)   NOT NULL DEFAULT 'customer',
    stallId       INT            NULL,              -- NEW: which stall this vendor owns
    createdAt     DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_Users_Role CHECK (role IN ('customer','vendor','admin')),
    CONSTRAINT FK_Users_Stall FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

-- (QJ's table - unchanged; imagePath already exists for menu photos)
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

-- (QJ's tables - unchanged)
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

-- (Kishore - NEW) Every legal document a stall holds: rental agreement,
-- business/store licence, food safety licence, fire safety cert...
-- One row per document, per stall. Replaces the old RentalAgreements.
-- 'Expired' / 'Expiring Soon' are NOT stored - the backend computes them
-- from expiryDate at query time so they can never go stale.
CREATE TABLE StallAgreements (
    agreementId   INT IDENTITY(1,1) PRIMARY KEY,
    stallId       INT NOT NULL,
    name          NVARCHAR(150) NOT NULL,       -- e.g. 'SFA Food Shop Licence'
    agreementType NVARCHAR(30)  NOT NULL,       -- Rental / Store Licence / Food Safety / Fire Safety / Other
    startDate     DATE NOT NULL,
    expiryDate    DATE NOT NULL,
    monthlyRent   DECIMAL(10,2) NULL,           -- only meaningful for Rental rows
    status        NVARCHAR(20)  NOT NULL DEFAULT 'Active',   -- Active / Terminated (user-set)
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
-- 3) SAMPLE DATA
-- ------------------------------------------------------------

-- 4 hawker centres
INSERT INTO HawkerCenters (name, description, location, imagePath) VALUES
('Maxwell Food Centre',          'Iconic hawker centre in Chinatown.',        'Kadayanallur St',    '/assets/images/maxwell.jpg'),
('Old Airport Road Food Centre', 'Famous for a huge variety of local food.',  'Old Airport Rd',     '/assets/images/oldairport.jpg'),
('Tiong Bahru Market',           'Heritage market with a classic hawker floor.', 'Seng Poh Rd',     '/assets/images/tiongbahru.jpg'),
('Chomp Chomp Food Centre',      'Serangoon Gardens supper favourite.',       'Kensington Park Rd', '/assets/images/chompchomp.jpg');
GO

-- 4 stalls per centre = 16 stalls (stallId 1..16)
INSERT INTO FoodStalls (centerId, name, imagePath) VALUES
(1, 'Tian Tian Chicken Rice',            NULL),  -- 1
(1, 'Maxwell Fuzhou Oyster Cake',        NULL),  -- 2
(1, 'Zhen Zhen Porridge',                NULL),  -- 3
(1, 'Maxwell Rojak & Popiah',            NULL),  -- 4
(2, 'Nam Sing Hokkien Mee',              NULL),  -- 5
(2, 'Roast Paradise Char Siew',          NULL),  -- 6
(2, 'Lao Fu Zi Fried Kway Teow',         NULL),  -- 7
(2, 'Xin Mei Xiang Lor Mee',             NULL),  -- 8
(3, 'Jian Bo Shui Kueh',                 NULL),  -- 9
(3, 'Tiong Bahru Boneless Chicken Rice', NULL),  -- 10
(3, 'Hong Heng Prawn Mee',               NULL),  -- 11
(3, 'Teochew Fish Ball Noodle',          NULL),  -- 12
(4, 'Ah Hock Fried Oyster',              NULL),  -- 13
(4, 'Chomp Chomp Satay Corner',          NULL),  -- 14
(4, 'BBQ Chicken Wing Express',          NULL),  -- 15
(4, 'Ice Kachang Corner',                NULL);  -- 16
GO

-- Accounts: admin + 1 customer + 16 vendor accounts (one per stall).
-- ALL test passwords are:  Password123
-- (each row stores a bcrypt hash, never the real password)
INSERT INTO Users (name, email, passwordHash, role, stallId) VALUES
('Admin', 'admin@hawkers.sg', '$2b$10$uH9IybQcFDv189qx2GTTgeIw9cKICO.TiXe9PqYl56s70GzTAxWdi', 'admin',    NULL),
('Siti',  'siti@test.com',    '$2b$10$Ba/QQTqV0Gsl6aw9OBxQcewdSe6l3wX.8fOeMb/VT1/vnSG3wc6ri', 'customer', NULL),
-- Aswin's original vendor test account, now owning stall 1:
('Tian Tian Chicken Rice',            'chickenrice@test.com', '$2b$10$up5QhYDn7wtwCLoRX7ZyX.a7XI.fO0BRS4J1OJ3ODZvaNwTE2JClO', 'vendor', 1),
('Maxwell Fuzhou Oyster Cake',        'vendor2@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 2),
('Zhen Zhen Porridge',                'vendor3@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 3),
('Maxwell Rojak & Popiah',            'vendor4@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 4),
('Nam Sing Hokkien Mee',              'vendor5@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 5),
('Roast Paradise Char Siew',          'vendor6@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 6),
('Lao Fu Zi Fried Kway Teow',         'vendor7@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 7),
('Xin Mei Xiang Lor Mee',             'vendor8@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 8),
('Jian Bo Shui Kueh',                 'vendor9@hawkers.sg',  '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 9),
('Tiong Bahru Boneless Chicken Rice', 'vendor10@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 10),
('Hong Heng Prawn Mee',               'vendor11@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 11),
('Teochew Fish Ball Noodle',          'vendor12@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 12),
('Ah Hock Fried Oyster',              'vendor13@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 13),
('Chomp Chomp Satay Corner',          'vendor14@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 14),
('BBQ Chicken Wing Express',          'vendor15@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 15),
('Ice Kachang Corner',                'vendor16@hawkers.sg', '$2b$10$SNQhoaeqSourb5P6E1z9c.SRXdqq8ewvmgvEzVIJwm5Jkbehh0vo.', 'vendor', 16);
GO

-- 2 menu items per stall (32 products). imagePath left NULL - the vendor
-- page shows a placeholder icon until the owner adds an image URL.
INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(1,  'Hainanese Chicken Rice',  'Tender poached chicken with fragrant rice.',  NULL, 5.00, 12),
(1,  'Roasted Chicken Rice',    'Roasted chicken with fragrant rice.',         NULL, 5.50, 8),
(2,  'Oyster Cake',             'Deep-fried oyster and prawn cake.',           NULL, 3.00, 20),
(2,  'Prawn Fritter',           'Crispy whole-prawn fritter.',                 NULL, 2.50, 6),
(3,  'Fish Porridge',           'Smooth porridge with fresh fish slices.',     NULL, 4.50, 9),
(3,  'Century Egg Porridge',    'Comfort porridge with century egg.',          NULL, 4.00, 5),
(4,  'Rojak',                   'Classic fruit rojak with thick prawn paste.', NULL, 4.00, 7),
(4,  'Popiah',                  'Fresh handmade popiah rolls.',                NULL, 2.80, 11),
(5,  'Hokkien Mee',             'Wok-fried noodles in rich prawn stock.',      NULL, 6.00, 15),
(5,  'Hokkien Mee (Large)',     'Bigger portion, extra prawns.',               NULL, 8.00, 10),
(6,  'Char Siew Rice',          'KL-style caramelised char siew.',             NULL, 5.50, 18),
(6,  'Sio Bak Rice',            'Crispy roast pork belly with rice.',          NULL, 6.00, 14),
(7,  'Fried Kway Teow',         'Smoky wok-hei kway teow with cockles.',       NULL, 5.00, 16),
(7,  'Fried Kway Teow (No Chilli)', 'Same smoky plate, kid friendly.',         NULL, 5.00, 3),
(8,  'Lor Mee',                 'Thick braised gravy noodles with fritters.',  NULL, 4.50, 13),
(8,  'Lor Mee (Extra Vinegar)', 'For the vinegar lovers.',                     NULL, 4.50, 4),
(9,  'Shui Kueh (5 pcs)',       'Steamed rice cakes with chye poh.',           NULL, 3.00, 22),
(9,  'Shui Kueh (10 pcs)',      'Double portion to share.',                    NULL, 5.50, 9),
(10, 'Boneless Chicken Rice',   'Silky boneless chicken, garlic chilli.',      NULL, 5.00, 12),
(10, 'Chicken Rice Set',        'Chicken rice with soup and vegetables.',      NULL, 7.50, 6),
(11, 'Prawn Mee (Soup)',        'Robust prawn broth, fresh prawns.',           NULL, 5.50, 17),
(11, 'Prawn Mee (Dry)',         'Tossed in chilli, soup on the side.',         NULL, 5.50, 8),
(12, 'Fish Ball Noodle',        'Bouncy handmade fish balls, mee pok.',        NULL, 4.50, 10),
(12, 'Fish Dumpling Soup',      'Handmade fish dumplings in clear soup.',      NULL, 5.00, 5),
(13, 'Fried Oyster (Medium)',   'Eggy or luak with plump oysters.',            NULL, 8.00, 19),
(13, 'Fried Oyster (Large)',    'Bigger plate for sharing.',                   NULL, 12.00, 7),
(14, 'Satay (10 sticks)',       'Charcoal-grilled chicken satay.',             NULL, 8.00, 21),
(14, 'Satay Set (20 sticks)',   'Mixed chicken and mutton with ketupat.',      NULL, 16.00, 9),
(15, 'BBQ Chicken Wings (3)',   'Sticky charcoal-grilled wings.',              NULL, 5.40, 25),
(15, 'BBQ Chicken Wings (6)',   'Half dozen wings with chilli lime.',          NULL, 10.50, 12),
(16, 'Ice Kachang',             'Shaved ice with red bean and jelly.',         NULL, 3.00, 14),
(16, 'Chendol',                 'Gula melaka, coconut milk, pandan jelly.',    NULL, 3.50, 11);
GO

-- Agreements & licences per stall.
-- Dates use DATEADD relative to today so the Expired / Expiring Soon
-- badges always demo correctly no matter when you rebuild.
DECLARE @t DATE = CAST(GETDATE() AS DATE);

-- Stall 1: full document set. Food Safety expires in 14 days -> 'Expiring Soon'.
INSERT INTO StallAgreements (stallId, name, agreementType, startDate, expiryDate, monthlyRent, status) VALUES
(1, 'Stall Unit 01-10 Tenancy',         'Rental',        DATEADD(day,-335,@t), DATEADD(day, 395,@t), 1850.00, 'Active'),
(1, 'SFA Food Shop Licence',            'Food Safety',   DATEADD(day,-351,@t), DATEADD(day,  14,@t), NULL,    'Active'),
(1, 'Business Registration (ACRA)',     'Store Licence', DATEADD(day,-700,@t), DATEADD(day, 760,@t), NULL,    'Active'),
(1, 'Fire Safety Certificate (SCDF)',   'Fire Safety',   DATEADD(day,-180,@t), DATEADD(day, 185,@t), NULL,    'Active'),

-- Stall 2: Food Safety licence expired 20 days ago -> 'Expired'.
(2, 'Stall Unit 01-11 Tenancy',         'Rental',        DATEADD(day, -60,@t), DATEADD(day, 670,@t), 1600.00, 'Active'),
(2, 'SFA Food Shop Licence',            'Food Safety',   DATEADD(day,-385,@t), DATEADD(day, -20,@t), NULL,    'Active'),
(2, 'Business Registration (ACRA)',     'Store Licence', DATEADD(day,-500,@t), DATEADD(day, 230,@t), NULL,    'Active'),
(2, 'Fire Safety Certificate (SCDF)',   'Fire Safety',   DATEADD(day, -90,@t), DATEADD(day, 275,@t), NULL,    'Active'),

-- Stall 3: includes a Terminated old tenancy to demo that badge.
(3, 'Stall Unit 01-12 Tenancy',         'Rental',        DATEADD(day,-400,@t), DATEADD(day, 330,@t), 1400.00, 'Active'),
(3, 'SFA Food Shop Licence',            'Food Safety',   DATEADD(day,-100,@t), DATEADD(day, 265,@t), NULL,    'Active'),
(3, 'Old Tenancy (2024-2025)',          'Rental',        DATEADD(day,-800,@t), DATEADD(day, -70,@t), 1250.00, 'Terminated'),

-- Stall 4
(4, 'Stall Unit 01-15 Tenancy',         'Rental',        DATEADD(day, -30,@t), DATEADD(day, 700,@t), 2100.00, 'Active'),
(4, 'Fire Safety Certificate (SCDF)',   'Fire Safety',   DATEADD(day, -10,@t), DATEADD(day, 355,@t), NULL,    'Active'),

-- Stalls 5-16: at least the tenancy each, so no vendor login is empty.
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

-- Sample cart + order for a test customer (QJ's originals, still valid ids).
INSERT INTO CartItems (userId, productId, quantity, unitPrice) VALUES
('user123', 1, 2, 5.00),
('user123', 3, 1, 3.00);
GO

INSERT INTO Orders (userId, centerId, subtotal, total, paymentMethod, fulfillment, status)
VALUES ('user123', 1, 13.00, 13.00, 'paynow', 'takeaway', 'paid');
GO

INSERT INTO OrderItems (orderId, productName, quantity, itemTotal) VALUES
(1, 'Hainanese Chicken Rice', 2, 10.00),
(1, 'Oyster Cake', 1, 3.00);
GO

PRINT 'HawkersDB full rebuild complete: 4 centres, 16 stalls, 16 vendor accounts, 32 menu items, agreements seeded.';
GO
