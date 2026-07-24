-- Inspections: an NEA officer schedules a visit to a stall, then
-- later records the outcome once it has been carried out.
CREATE TABLE Inspections (
    inspectionId    INT IDENTITY(1,1) PRIMARY KEY,
    stallId         INT NOT NULL,
    officerName     NVARCHAR(100) NOT NULL,
    scheduledDate   DATE NOT NULL,
    status          NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    completedDate   DATE NULL,        
    score           INT NULL,   
    remarks         NVARCHAR(500) NULL, 
    createdAt       DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Inspections_Stall
        FOREIGN KEY (stallId) REFERENCES FoodStalls(stallId),
    CONSTRAINT CK_Inspections_Status
        CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
    CONSTRAINT CK_Inspections_Score
        CHECK (score IS NULL OR score BETWEEN 0 AND 100)
);
GO
 
-- HygieneGrades: grade issued as a result of a completed inspection.
-- A stall keeps multiple historical rows over time (grades are
-- valid for a fixed period). inspectionId is nullable so a grade
-- record survives even if the originating inspection is later deleted.
CREATE TABLE HygieneGrades (
    gradeId       INT IDENTITY(1,1) PRIMARY KEY,
    stallId       INT NOT NULL,
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
        CHECK (grade IN ('A', 'B', 'C', 'D'))
);
GO

-- SAMPLE DATA --------------------------------------------
INSERT INTO Inspections (stallId, officerName, scheduledDate, status, completedDate, score, remarks) VALUES
(1, 'Officer Tan Wei Ming', '2026-05-12', 'Completed', '2026-05-12', 88, 'Good hygiene practices, minor grease buildup near stove.'),
(2, 'Officer Nurul Huda',   '2026-05-14', 'Completed', '2026-05-14', 95, 'Excellent cleanliness, no issues found.'),
(3, 'Officer Tan Wei Ming', '2026-06-02', 'Completed', '2026-06-02', 72, 'Food storage temperature slightly above guideline. Follow-up required.'),
(1, 'Officer Nurul Huda',   '2026-08-10', 'Scheduled', NULL, NULL, NULL);
GO
 
INSERT INTO HygieneGrades (stallId, inspectionId, grade, validFrom, validTo) VALUES
(1, 1, 'A', '2026-05-12', '2027-05-11'),
(2, 2, 'A', '2026-05-14', '2027-05-13'),
(3, 3, 'B', '2026-06-02', '2027-06-01');
GO
 
PRINT 'HawkersDB setup complete.';
GO