// inspectionController.js  (Kaden - NEA inspections)
// Handles the request/response side of /api/inspections and holds the
// business rules. Format checking already happened in the Joi schemas
// (validators/inspectionValidator.js), so anything that arrives here is the
// right SHAPE - what is left to check is whether it makes SENSE.
const inspectionModel = require("../models/inspectionModel");

// ============================================================
// Business rules, kept together at the top so they are easy to find
// and easy to explain during the demo.
// ============================================================

// Points earned on the visit turn into a letter grade.
const GRADE_BANDS = [
  { min: 85, grade: "A" },
  { min: 70, grade: "B" },
  { min: 55, grade: "C" },
  { min: 0,  grade: "D" },
];

// How long each grade stays valid. A well-run stall is left alone for a
// year; a poor one has to be looked at again sooner. This is what drives
// the "expiring soon" list the officer schedules from.
const GRADE_VALIDITY_MONTHS = { A: 12, B: 12, C: 6, D: 3 };

// Below this the stall has failed and a re-inspection is booked automatically.
const FAIL_THRESHOLD = 55;
const FOLLOW_UP_DAYS = 30;

function scoreToGrade(score) {
  return GRADE_BANDS.find((band) => score >= band.min).grade;
}

// ---- small date helpers (dates are handled as "YYYY-MM-DD" strings) ----

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(isoDate, months) {
  const date = new Date(isoDate);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

// ============================================================
// READ  (public - customers may look at inspection history)
// ============================================================

// GET /api/inspections?stallId=&status=&officerId=
async function getAllInspections(req, res) {
  try {
    const { stallId, status, officerId } = req.query;

    // Query strings are not covered by the Joi body schemas, so they are
    // checked here.
    if (stallId && isNaN(stallId)) {
      return res.status(400).json({ message: "stallId must be a number." });
    }
    if (officerId && isNaN(officerId)) {
      return res.status(400).json({ message: "officerId must be a number." });
    }
    const allowed = ["Scheduled", "Completed", "Cancelled"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowed.join(", ")}` });
    }

    const inspections = await inspectionModel.getAllInspections({ stallId, status, officerId });
    res.status(200).json(inspections);
  } catch (err) {
    console.error("getAllInspections error:", err);
    res.status(500).json({ message: "Could not load inspections. Please try again." });
  }
}

// GET /api/inspections/:id
async function getInspectionById(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }

    const inspection = await inspectionModel.getInspectionById(id);
    if (!inspection) {
      return res.status(404).json({ message: `Inspection ${id} was not found.` });
    }

    res.status(200).json(inspection);
  } catch (err) {
    console.error("getInspectionById error:", err);
    res.status(500).json({ message: "Could not load that inspection. Please try again." });
  }
}

// ============================================================
// OFFICER WORKLIST  (officer only)
// ============================================================

// GET /api/inspections/mine
// The officer comes from the token (req.officerId), so this endpoint can
// only ever return the caller's own work - there is no id in the URL to
// tamper with.
async function getMyWorklist(req, res) {
  try {
    const [open, completed] = await Promise.all([
      inspectionModel.getOpenByOfficer(req.officerId),
      inspectionModel.getCompletedByOfficer(req.officerId),
    ]);

    const today = todayIso();
    const dayOf = (value) => new Date(value).toISOString().slice(0, 10);

    const overdue  = open.filter((i) => dayOf(i.scheduledDate) <  today);
    const dueToday = open.filter((i) => dayOf(i.scheduledDate) === today);
    const upcoming = open.filter((i) => dayOf(i.scheduledDate) >  today);

    // Completed in the last 30 days, for the "recent activity" panel.
    const cutoff = addDays(today, -30);
    const recent = completed.filter((i) => dayOf(i.completedDate) >= cutoff);

    res.status(200).json({
      officer: { officerId: req.officerId, name: req.user.name || null },
      stats: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        completedLast30Days: recent.length,
      },
      overdue,
      dueToday,
      upcoming,
      recentlyCompleted: recent.slice(0, 10),
    });
  } catch (err) {
    console.error("getMyWorklist error:", err);
    res.status(500).json({ message: "Could not load your worklist. Please try again." });
  }
}

// GET /api/inspections/overdue
// Agency-wide by default; add ?mine=true for just this officer's.
async function getOverdueInspections(req, res) {
  try {
    const onlyMine = req.query.mine === "true";
    const overdue = await inspectionModel.getOverdue(onlyMine ? req.officerId : null);
    res.status(200).json(overdue);
  } catch (err) {
    console.error("getOverdueInspections error:", err);
    res.status(500).json({ message: "Could not load overdue inspections. Please try again." });
  }
}

// GET /api/inspections/stalls-due
// Every stall with its last visit, current grade and any open booking. This
// is what makes scheduling a decision based on data rather than guesswork.
async function getStallsDue(req, res) {
  try {
    const stalls = await inspectionModel.getStallsDue();

    // Work out WHY each stall needs attention, so the front end can just
    // display the reason instead of re-deriving the rules.
    const withReasons = stalls.map((stall) => {
      let priority = "ok";
      let reason = "Up to date";

      if (!stall.lastInspected) {
        priority = "high";
        reason = "Never inspected";
      } else if (stall.daysUntilGradeExpires === null) {
        priority = "high";
        reason = "No grade on record";
      } else if (stall.daysUntilGradeExpires < 0) {
        priority = "high";
        reason = `Grade expired ${Math.abs(stall.daysUntilGradeExpires)} days ago`;
      } else if (stall.daysUntilGradeExpires <= 30) {
        priority = "medium";
        reason = `Grade expires in ${stall.daysUntilGradeExpires} days`;
      } else if (stall.lastScore !== null && stall.lastScore < 70) {
        priority = "medium";
        reason = `Last score was only ${stall.lastScore}`;
      }

      // An already-booked stall never needs chasing.
      if (stall.openInspectionId) {
        priority = "booked";
        reason = "Visit already booked";
      }

      return { ...stall, priority, reason };
    });

    res.status(200).json(withReasons);
  } catch (err) {
    console.error("getStallsDue error:", err);
    res.status(500).json({ message: "Could not load the stall list. Please try again." });
  }
}

// ============================================================
// CREATE  (officer only)
// ============================================================

// POST /api/inspections
async function createInspection(req, res) {
  try {
    const { stallId, scheduledDate } = req.body;

    if (!(await inspectionModel.stallExists(stallId))) {
      return res.status(400).json({ message: `Stall ${stallId} does not exist.` });
    }

    // An inspection cannot be booked for a date that has already passed.
    if (scheduledDate < todayIso()) {
      return res.status(400).json({ message: "You cannot schedule an inspection in the past." });
    }

    // 409 Conflict is the right status here: the request is valid, it just
    // clashes with something that already exists.
    if (await inspectionModel.hasOpenSlot(stallId, scheduledDate)) {
      return res.status(409).json({
        message: "That stall already has an inspection booked for this date. Pick another date.",
      });
    }

    const created = await inspectionModel.createInspection({
      stallId,
      scheduledDate,
      officerId: req.officerId, // from the token, never from the body
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("createInspection error:", err);
    res.status(500).json({ message: "Could not schedule the inspection. Please try again." });
  }
}

// ============================================================
// UPDATE  (officer only)
// ============================================================

// PUT /api/inspections/:id  - move the date, move the stall, or cancel
async function updateInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }

    const existing = await inspectionModel.getInspectionById(id);
    if (!existing) {
      return res.status(404).json({ message: `Inspection ${id} was not found.` });
    }

    // A completed visit is a record of something that actually happened, so
    // it is not editable. Corrections go through the hygiene grade instead.
    if (existing.status === "Completed") {
      return res.status(409).json({
        message: "This inspection has already been carried out, so its schedule cannot be changed. " +
                 "If the result was wrong, correct the hygiene grade instead.",
      });
    }

    const { stallId, scheduledDate, status } = req.body;

    if (!(await inspectionModel.stallExists(stallId))) {
      return res.status(400).json({ message: `Stall ${stallId} does not exist.` });
    }
    if (status === "Scheduled" && await inspectionModel.hasOpenSlot(stallId, scheduledDate, id)) {
      return res.status(409).json({
        message: "That stall already has an inspection booked for this date. Pick another date.",
      });
    }

    const updated = await inspectionModel.updateInspection(id, { stallId, scheduledDate, status });
    res.status(200).json(updated);
  } catch (err) {
    console.error("updateInspection error:", err);
    res.status(500).json({ message: "Could not update the inspection. Please try again." });
  }
}

// PUT /api/inspections/:id/complete
// Record the score and remarks. This is the heart of the feature: it also
// issues the hygiene grade and, if the stall failed, books the re-inspection.
async function completeInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }

    const existing = await inspectionModel.getInspectionById(id);
    if (!existing) {
      return res.status(404).json({ message: `Inspection ${id} was not found.` });
    }
    if (existing.status === "Completed") {
      return res.status(409).json({
        message: `Inspection ${id} has already been completed. Edit the hygiene grade if a correction is needed.`,
      });
    }
    if (existing.status === "Cancelled") {
      return res.status(409).json({
        message: `Inspection ${id} was cancelled, so a result cannot be recorded against it.`,
      });
    }

    const { score, remarks } = req.body;
    const completedDate = req.body.completedDate || todayIso();

    if (completedDate > todayIso()) {
      return res.status(400).json({ message: "The completed date cannot be in the future." });
    }

    // Work out the grade and how long it runs for.
    const grade = scoreToGrade(score);
    const validFrom = completedDate;
    const validTo = addMonths(completedDate, GRADE_VALIDITY_MONTHS[grade]);

    // A failing score books a re-inspection. findFreeFollowUpDate steps
    // forward a day at a time if that slot is already taken, so the booking
    // can never collide with an existing one.
    let followUpDate = null;
    if (score < FAIL_THRESHOLD) {
      followUpDate = await inspectionModel.findFreeFollowUpDate(
        existing.stallId,
        addDays(completedDate, FOLLOW_UP_DAYS)
      );
    }

    const result = await inspectionModel.completeInspection(id, {
      stallId: existing.stallId,
      officerId: req.officerId,
      completedDate,
      score,
      remarks,
      grade,
      validFrom,
      validTo,
      followUpDate,
    });

    // A short human-readable summary so the page can show one clear sentence
    // instead of the front end re-implementing these rules.
    let summary = `Grade ${grade} issued, valid until ${validTo}.`;
    if (result.followUp) {
      summary += ` Score was below ${FAIL_THRESHOLD}, so a re-inspection has been booked for ${followUpDate}.`;
    }

    res.status(200).json({ ...result, summary });
  } catch (err) {
    console.error("completeInspection error:", err);
    res.status(500).json({ message: "Could not record the result. Nothing was saved - please try again." });
  }
}

// ============================================================
// DELETE  (officer only)
// ============================================================

// DELETE /api/inspections/:id
async function deleteInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }

    const deleted = await inspectionModel.deleteInspection(id);
    if (!deleted) {
      return res.status(404).json({ message: `Inspection ${id} was not found.` });
    }

    res.status(200).json({
      message: `Inspection ${id} deleted. Any hygiene grade it issued has been kept for the stall's history.`,
      deleted,
    });
  } catch (err) {
    console.error("deleteInspection error:", err);
    res.status(500).json({ message: "Could not delete the inspection. Please try again." });
  }
}

module.exports = {
  // exported for the unit tests as well as the routes
  scoreToGrade,
  getAllInspections,
  getInspectionById,
  getMyWorklist,
  getOverdueInspections,
  getStallsDue,
  createInspection,
  updateInspection,
  completeInspection,
  deleteInspection,
};
