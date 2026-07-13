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
IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;
IF OBJECT_ID('dbo.Feedback', 'U') IS NOT NULL DROP TABLE dbo.Feedback;
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

CREATE TABLE Feedback (
    feedbackId   INT IDENTITY(1,1) PRIMARY KEY,
    stallId      INT NOT NULL,
    userId       NVARCHAR(100) NOT NULL,
    rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      NVARCHAR(1000) NULL,
    createdAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedback_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

CREATE TABLE Complaints (
    complaintId  INT IDENTITY(1,1) PRIMARY KEY,
    stallId      INT NOT NULL,
    userId       NVARCHAR(100) NOT NULL,
    category     NVARCHAR(50) NULL,          -- e.g. Hygiene, Service
    description  NVARCHAR(1000) NOT NULL,
    status       NVARCHAR(20) NOT NULL DEFAULT 'Open',   -- Open / Resolved
    createdAt    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Complaints_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId)
);
GO

-- 4) SAMPLE DATA --------------------------------------------
INSERT INTO HawkerCenters (name, description, location, imagePath) VALUES
('Maxwell Food Centre', 'Iconic hawker centre in Chinatown.', 'Kadayanallur St', '/assets/images/maxwell.jpg'),
('Old Airport Road', 'Famous for a huge variety of local food.', 'Old Airport Rd', '/assets/images/oldairport.jpg');
GO

INSERT INTO FoodStalls (centerId, name, imagePath) VALUES
(1, 'Tian Tian Chicken Rice', '/assets/images/tiantian.jpg'),
(1, 'Maxwell Fuzhou Oyster Cake', '/assets/images/oystercake.jpg'),
(2, 'Nam Sing Hokkien Mee', '/assets/images/hokkienmee.jpg');
GO

INSERT INTO Products (stallId, name, description, imagePath, basePrice, likes) VALUES
(1, 'Hainanese Chicken Rice', 'Tender poached chicken with fragrant rice.', '/assets/images/chickenrice.jpg', 5.00, 12),
(1, 'Roasted Chicken Rice', 'Roasted chicken with fragrant rice.', '/assets/images/roastchicken.jpg', 5.50, 8),
(2, 'Oyster Cake', 'Deep-fried oyster and prawn cake.', '/assets/images/oyster.jpg', 3.00, 20),
(3, 'Hokkien Mee', 'Wok-fried noodles in rich prawn stock.', '/assets/images/hokkien.jpg', 6.00, 15);
GO

-- sample cart lines for a test user 'user123'
INSERT INTO CartItems (userId, productId, quantity, unitPrice) VALUES
('user123', 1, 2, 5.00),
('user123', 3, 1, 3.00);
GO

-- sample past order for 'user123'
INSERT INTO Orders (userId, centerId, subtotal, total, paymentMethod, fulfillment, status)
VALUES ('user123', 1, 13.00, 13.00, 'paynow', 'takeaway', 'paid');
GO

INSERT INTO OrderItems (orderId, productName, quantity, itemTotal) VALUES
(1, 'Hainanese Chicken Rice', 2, 10.00),
(1, 'Oyster Cake', 1, 3.00);
GO

INSERT INTO Feedback (stallId, userId, rating, comment) VALUES
(1, 'user123', 5, 'Tender chicken and fragrant rice. Best in Maxwell!'),
(1, 'user456', 4, 'Very good but the queue was long.'),
(3, 'user123', 2, 'Hokkien mee was lukewarm when served.');
GO

INSERT INTO Complaints (stallId, userId, category, description, status) VALUES
(3, 'user456', 'Hygiene', 'Table was not cleaned and utensils looked dirty.', 'Open'),
(2, 'user123', 'Service', 'Waited very long and received the wrong order.', 'Resolved');
GO

PRINT 'HawkersDB setup complete.';
GO