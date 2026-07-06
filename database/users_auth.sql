-- ============================================================
-- users_auth.sql
-- Users table for login/signup (customers, vendors, admin)
-- Aswin's individual feature. Run in SSMS against HawkersDB.
-- ============================================================
USE HawkersDB;
GO

-- Drop first so the script can be re-run cleanly during development
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO

CREATE TABLE Users (
    userId        INT IDENTITY(1,1) PRIMARY KEY,   -- auto-numbered unique id
    name          NVARCHAR(100)  NOT NULL,
    email         NVARCHAR(255)  NOT NULL UNIQUE,   -- no two accounts share an email
    passwordHash  NVARCHAR(255)  NOT NULL,          -- bcrypt hash, never the real password
    role          NVARCHAR(20)   NOT NULL DEFAULT 'customer',
    createdAt     DATETIME       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_Users_Role CHECK (role IN ('customer','vendor','admin'))
);
GO

-- Sample accounts (passwords are already bcrypt-hashed).
-- Login details for testing:
--   admin@hawkers.sg      / Admin123      (admin)
--   siti@test.com         / Password123   (customer)
--   chickenrice@test.com  / Password123   (vendor)
INSERT INTO Users (name, email, passwordHash, role) VALUES
('Admin',              'admin@hawkers.sg',     '$2b$10$uH9IybQcFDv189qx2GTTgeIw9cKICO.TiXe9PqYl56s70GzTAxWdi', 'admin'),
('Siti',               'siti@test.com',        '$2b$10$Ba/QQTqV0Gsl6aw9OBxQcewdSe6l3wX.8fOeMb/VT1/vnSG3wc6ri', 'customer'),
('Chicken Rice Stall', 'chickenrice@test.com', '$2b$10$up5QhYDn7wtwCLoRX7ZyX.a7XI.fO0BRS4J1OJ3ODZvaNwTE2JClO', 'vendor');
GO

PRINT 'Users table created with sample accounts.';
GO