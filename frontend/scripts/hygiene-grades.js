// hygiene-grades.js  (Kaden - PUBLIC hygiene grade lookup)
// Read-only page for customers. It only calls the public GET endpoints, so
// there is no token handling here at all - anything that changes data lives
// in the officer portal (officer_grades.html) behind requireOfficer.
//
// Uses /api/hygiene-grades/current, which returns one row per stall worked
// out by SQL. The browser no longer downloads the whole history just to find
// the newest grade for each stall.

const API_BASE = "/api";

const cards = document.getElementById("current-grades-cards");
const cardsEmpty = document.getElementById("current-grades-empty");
const searchInput = document.getElementById("search-stall");

const historySelect = document.getElementById("history-stall");
const historyOutput = document.getElementById("history-output");
const historyEmpty = document.getElementById("history-empty");
const historySummary = document.getElementById("history-summary");
const historyBody = document.getElementById("history-body");

let currentGrades = [];

// ---------- small helpers ----------

async function getJson(path) {
  const res = await fetch(API_BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status}).`);
  return data;
}

function formatDate(value) {
  if (!value) return "&mdash;";
  return new Date(value).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

function gradeBadge(grade) {
  if (!grade) return `<span class="grade-badge grade-none">&ndash;</span>`;
  return `<span class="grade-badge grade-${grade.toLowerCase()}">${grade}</span>`;
}

// Stall names come from the database, so escape them before building HTML.
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- current grades ----------

function renderCards(list) {
  cards.innerHTML = list
    .map((g) => `
      <div class="current-grade-card ${g.isCurrent ? "" : "grade-lapsed"}">
        ${gradeBadge(g.grade)}
        <div class="details">
          <h4>${escapeHtml(g.stallName)}</h4>
          <p>${escapeHtml(g.centerName)}</p>
          <p>Valid ${formatDate(g.validFrom)} &ndash; ${formatDate(g.validTo)}</p>
          ${g.isCurrent ? "" : `<p class="lapsed-note">Awaiting re-inspection</p>`}
        </div>
      </div>
    `)
    .join("");

  cardsEmpty.hidden = list.length > 0;
}

// Filter as the customer types. Case-insensitive on both stall and centre.
searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) return renderCards(currentGrades);

  renderCards(
    currentGrades.filter(
      (g) =>
        g.stallName.toLowerCase().includes(term) ||
        g.centerName.toLowerCase().includes(term)
    )
  );
});

async function loadCurrent() {
  try {
    currentGrades = await getJson("/hygiene-grades/current");
    renderCards(currentGrades);

    historySelect.innerHTML =
      `<option value="">Choose a stall…</option>` +
      currentGrades
        .map((g) => `<option value="${g.stallId}">${escapeHtml(g.stallName)} — ${escapeHtml(g.centerName)}</option>`)
        .join("");
  } catch (err) {
    cardsEmpty.hidden = false;
    cardsEmpty.textContent = `Could not load hygiene grades: ${err.message}`;
  }
}

// ---------- history for one stall ----------

historySelect.addEventListener("change", async () => {
  const stallId = historySelect.value;
  if (!stallId) {
    historyOutput.hidden = true;
    historyEmpty.hidden = false;
    return;
  }

  try {
    const data = await getJson(`/hygiene-grades/stall/${stallId}`);

    historySummary.innerHTML = `
      <h4>${escapeHtml(data.stallName)}</h4>
      <p>
        Currently showing ${gradeBadge(data.currentGrade ? data.currentGrade.grade : null)}
        &middot; ${data.grades.length} grade(s) on record since this stall joined.
      </p>
    `;

    historyBody.innerHTML =
      data.grades
        .map((g) => `
          <tr>
            <td>${gradeBadge(g.grade)}</td>
            <td>${formatDate(g.validFrom)}</td>
            <td>${formatDate(g.validTo)}</td>
            <td>${g.inspectionScore === null ? "&mdash;" : `${g.inspectionScore} points`}</td>
            <td>${g.isCurrent
                  ? '<span class="badge badge-completed">Current</span>'
                  : '<span class="badge badge-cancelled">Expired</span>'}</td>
          </tr>
        `)
        .join("") || `<tr><td colspan="5">No grades recorded yet.</td></tr>`;

    historyOutput.hidden = false;
    historyEmpty.hidden = true;
  } catch (err) {
    historyEmpty.hidden = false;
    historyEmpty.textContent = `Could not load that stall's history: ${err.message}`;
  }
});

loadCurrent();
