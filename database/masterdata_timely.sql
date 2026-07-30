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