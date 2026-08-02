// officer_schedule.js  (Kaden - NEA officer portal, Schedule page)
// Books inspections, and shows WHICH stalls need one so the choice is driven
// by data rather than memory. The priority and the reason text are worked out
// on the server (getStallsDue in inspectionController.js) so the rule lives
// in one place.

if (!Officer.requireOfficer()) {
  throw new Error("Not an officer.");
}

const stallSelect = document.getElementById("schedule-stallId");
const dateInput = document.getElementById("schedule-date");
const officerInput = document.getElementById("schedule-officer");
const scheduleForm = document.getElementById("schedule-form");
const scheduleFeedback = document.getElementById("schedule-feedback");

const priorityFilter = document.getElementById("filter-priority");
const stallsBody = document.getElementById("stalls-body");
const stallsEmpty = document.getElementById("stalls-empty");

let allStalls = [];

// ---------- set up the form ----------

// The officer's own name, straight from the session. It is display-only -
// the server reads the real identity from the token.
const user = Session.getUser();
officerInput.value = user && user.name ? user.name : "Signed-in officer";

// A visit cannot be booked in the past, so stop the date picker offering it.
dateInput.min = Officer.todayInput();
dateInput.value = Officer.todayInput();

// ---------- weather (third-party API, via our own back end) ----------

// Shown under the date picker whenever the officer changes the date.
// Deliberately advisory: it never blocks the booking. A wet forecast is a
// reason to think, not a reason for the system to refuse.
const weatherNote = document.getElementById("weather-note");

async function showWeatherFor(date) {
  if (!date) {
    weatherNote.hidden = true;
    return;
  }

  try {
    const w = await Officer.api(`/inspections/weather?date=${encodeURIComponent(date)}`);

    if (!w.available) {
      weatherNote.className = "weather-note";
      weatherNote.textContent = w.reason;
    } else {
      weatherNote.className = `weather-note ${w.wet ? "weather-wet" : "weather-fine"}`;
      weatherNote.textContent =
        `${w.day}: ${w.summary}. ${w.tempLow}\u2013${w.tempHigh}\u00B0C.` +
        (w.wet ? " Consider another day for an outdoor visit." : "");
    }
    weatherNote.hidden = false;
  } catch (err) {
    weatherNote.hidden = true;
    console.error("weather lookup failed:", err.message);
  }
}

dateInput.addEventListener("change", () => showWeatherFor(dateInput.value));

// ---------- rendering ----------

function stallRow(stall) {
  const canBook = !stall.openInspectionId;

  return `
    <tr class="priority-${stall.priority}">
      <td>${Officer.escapeHtml(stall.stallName)} <span class="muted">#${stall.stallId}</span></td>
      <td>${Officer.escapeHtml(stall.centerName)}</td>
      <td>${Officer.gradeBadge(stall.currentGrade)}</td>
      <td>${stall.lastInspected ? Officer.formatDate(stall.lastInspected) : "<em>Never</em>"}</td>
      <td>${stall.lastScore === null ? "&mdash;" : stall.lastScore}</td>
      <td>${Officer.priorityBadge(stall.priority, Officer.escapeHtml(stall.reason))}</td>
      <td class="row-actions">
        ${canBook
          ? `<button class="btn btn-small" data-stall="${stall.stallId}">Book this</button>`
          : `<a class="btn btn-small btn-text" href="./officer.html">View worklist</a>`}
      </td>
    </tr>
  `;
}

function applyFilter() {
  const mode = priorityFilter.value;

  const rows = allStalls.filter((s) => {
    if (mode === "all") return true;
    if (mode === "high") return s.priority === "high";
    if (mode === "booked") return s.priority === "booked";
    return s.priority === "high" || s.priority === "medium";
  });

  stallsBody.innerHTML = rows.map(stallRow).join("");
  stallsEmpty.hidden = rows.length > 0;
}

priorityFilter.addEventListener("change", applyFilter);

// ---------- data loading ----------

async function loadStalls() {
  try {
    allStalls = await Officer.api("/inspections/stalls-due");

    // Fill the dropdown from the same data - one request, two uses.
    stallSelect.innerHTML =
      `<option value="">Choose a stall…</option>` +
      allStalls
        .map((s) => `<option value="${s.stallId}">${Officer.escapeHtml(s.stallName)} — ${Officer.escapeHtml(s.centerName)}</option>`)
        .join("");

    applyFilter();
  } catch (err) {
    stallsEmpty.hidden = false;
    stallsEmpty.textContent = `Could not load stalls: ${err.message}`;
    stallSelect.innerHTML = `<option value="">Could not load stalls</option>`;
  }
}

// ---------- "Book this" prefills the form instead of opening a modal ----------

stallsBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-stall]");
  if (!btn) return;

  stallSelect.value = btn.dataset.stall;
  scheduleForm.scrollIntoView({ behavior: "smooth", block: "center" });
  dateInput.focus();
  showWeatherFor(dateInput.value);
});

// ---------- booking ----------

scheduleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  scheduleFeedback.hidden = true;

  const stallId = Number(stallSelect.value);
  if (!stallId) {
    Officer.toast(scheduleFeedback, "Please choose a stall first.", false);
    return;
  }

  try {
    const created = await Officer.api("/inspections", {
      method: "POST",
      // No officer field: the server takes it from the token.
      body: JSON.stringify({ stallId, scheduledDate: dateInput.value }),
    });

    Officer.toast(
      scheduleFeedback,
      `Inspection #${created.inspectionId} booked for ${created.stallName} on ${Officer.formatDate(created.scheduledDate)}.`,
      true
    );

    scheduleForm.reset();
    dateInput.value = Officer.todayInput();
    loadStalls(); // the stall is now "already booked", so refresh the table
  } catch (err) {
    Officer.toast(scheduleFeedback, err.message, false);
  }
});

loadStalls();
showWeatherFor(dateInput.value);