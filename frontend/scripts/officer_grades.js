// officer_grades.js  (Kaden - NEA officer portal, Grade Register page)
// Four things on one page:
//   1. the current grade each stall is displaying   GET /hygiene-grades/current
//   2. grades about to run out                      GET /hygiene-grades/expiring
//   3. one stall's full history                     GET /hygiene-grades/stall/:id
//   4. the full register, with correct + delete     GET/PUT/DELETE /hygiene-grades
//
// Note that 1 and 2 are worked out by SQL on the server. The old version of
// this page downloaded every grade ever issued and picked the newest per
// stall in the browser, which got slower with every inspection recorded.

if (!Officer.requireOfficer()) {
  throw new Error("Not an officer.");
}

const pageError = document.getElementById("page-error");

const currentCards = document.getElementById("current-grades-cards");
const currentEmpty = document.getElementById("current-grades-empty");

const expiringBody = document.getElementById("expiring-body");
const expiringEmpty = document.getElementById("expiring-empty");
const expiringDays = document.getElementById("expiring-days");

const historySelect = document.getElementById("history-stall");
const historyOutput = document.getElementById("history-output");
const historyEmpty = document.getElementById("history-empty");
const historySummary = document.getElementById("history-summary");
const historyGradesBody = document.getElementById("history-grades-body");
const historyInspectionsBody = document.getElementById("history-inspections-body");

const gradeForm = document.getElementById("grade-form");
const gradeStallSelect = document.getElementById("grade-stallId");
const gradeFeedback = document.getElementById("grade-feedback");

const gradesBody = document.getElementById("grades-body");
const gradesEmpty = document.getElementById("grades-empty");
const filterStallInput = document.getElementById("filter-stallId");

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdSpan = document.getElementById("edit-id");
const editError = document.getElementById("edit-error");

let currentEditId = null;

// ============================================================
// 1) Current grade per stall
// ============================================================

async function loadCurrentGrades() {
  try {
    const grades = await Officer.api("/hygiene-grades/current");

    currentCards.innerHTML = grades
      .map((g) => `
        <div class="current-grade-card ${g.isCurrent ? "" : "grade-lapsed"}">
          ${Officer.gradeBadge(g.grade)}
          <div class="details">
            <h4>${Officer.escapeHtml(g.stallName)} <span class="muted">#${g.stallId}</span></h4>
            <p>${Officer.escapeHtml(g.centerName)}</p>
            <p>Valid ${Officer.formatDate(g.validFrom)} &ndash; ${Officer.formatDate(g.validTo)}</p>
            ${g.isCurrent
              ? `<p class="muted">${g.daysUntilExpiry} days left</p>`
              : `<p class="lapsed-note">Lapsed &mdash; needs a new inspection</p>`}
          </div>
        </div>
      `)
      .join("");

    currentEmpty.hidden = grades.length > 0;
  } catch (err) {
    Officer.toast(pageError, `Could not load current grades: ${err.message}`, false);
  }
}

// ============================================================
// 2) Expiring soon
// ============================================================

async function loadExpiring() {
  const days = expiringDays.value || 30;
  try {
    const grades = await Officer.api(`/hygiene-grades/expiring?days=${days}`);

    expiringBody.innerHTML = grades
      .map((g) => `
        <tr class="${g.daysUntilExpiry < 0 ? "priority-high" : ""}">
          <td>${Officer.escapeHtml(g.stallName)} <span class="muted">#${g.stallId}</span></td>
          <td>${Officer.escapeHtml(g.centerName)}</td>
          <td>${Officer.gradeBadge(g.grade)}</td>
          <td>${Officer.formatDate(g.validTo)}</td>
          <td>${g.daysUntilExpiry < 0
                ? `<strong>Expired ${Math.abs(g.daysUntilExpiry)} days ago</strong>`
                : g.daysUntilExpiry}</td>
          <td class="row-actions">
            <a class="btn btn-small" href="./officer_schedule.html">Schedule</a>
          </td>
        </tr>
      `)
      .join("");

    expiringEmpty.hidden = grades.length > 0;
  } catch (err) {
    Officer.toast(pageError, `Could not load expiring grades: ${err.message}`, false);
  }
}

document.getElementById("expiring-apply").addEventListener("click", loadExpiring);

// ============================================================
// 3) One stall's full history
// ============================================================

historySelect.addEventListener("change", async () => {
  const stallId = historySelect.value;
  if (!stallId) {
    historyOutput.hidden = true;
    historyEmpty.hidden = false;
    return;
  }

  try {
    const data = await Officer.api(`/hygiene-grades/stall/${stallId}`);

    const completed = data.inspections.filter((i) => i.status === "Completed");
    const average = completed.length
      ? Math.round(completed.reduce((sum, i) => sum + i.score, 0) / completed.length)
      : null;

    historySummary.innerHTML = `
      <h4>${Officer.escapeHtml(data.stallName)} <span class="muted">#${data.stallId}</span></h4>
      <p>
        Current grade: ${Officer.gradeBadge(data.currentGrade ? data.currentGrade.grade : null)}
        &middot; ${data.grades.length} grade(s) on record
        &middot; ${completed.length} completed inspection(s)
        ${average !== null ? `&middot; average score ${average}` : ""}
      </p>
    `;

    historyGradesBody.innerHTML = data.grades
      .map((g) => `
        <tr>
          <td>${Officer.gradeBadge(g.grade)}</td>
          <td>${Officer.formatDate(g.validFrom)}</td>
          <td>${Officer.formatDate(g.validTo)}</td>
          <td>${g.inspectionScore === null ? "&mdash;" : g.inspectionScore}</td>
          <td>${g.isCurrent ? '<span class="badge badge-completed">Current</span>' : '<span class="badge badge-cancelled">Expired</span>'}</td>
        </tr>
      `)
      .join("") || `<tr><td colspan="5">No grades yet.</td></tr>`;

    historyInspectionsBody.innerHTML = data.inspections
      .map((i) => `
        <tr>
          <td>${i.inspectionId}</td>
          <td>${Officer.escapeHtml(i.officerName)}</td>
          <td>${Officer.formatDate(i.scheduledDate)}</td>
          <td>${Officer.statusBadge(i.status)}</td>
          <td>${i.score === null ? "&mdash;" : i.score}</td>
          <td class="remarks-cell">${Officer.escapeHtml(i.remarks) || "&mdash;"}</td>
        </tr>
      `)
      .join("") || `<tr><td colspan="6">No inspections yet.</td></tr>`;

    historyOutput.hidden = false;
    historyEmpty.hidden = true;
  } catch (err) {
    Officer.toast(pageError, `Could not load that stall's history: ${err.message}`, false);
  }
});

// ============================================================
// 4) The full register + manual entry
// ============================================================

async function loadGrades() {
  const stallId = filterStallInput.value.trim();
  const query = stallId ? `?stallId=${encodeURIComponent(stallId)}` : "";

  try {
    const grades = await Officer.api(`/hygiene-grades${query}`);

    gradesBody.innerHTML = grades
      .map((g) => `
        <tr>
          <td>${g.gradeId}</td>
          <td>${Officer.escapeHtml(g.stallName)} <span class="muted">#${g.stallId}</span></td>
          <td>${Officer.gradeBadge(g.grade)}</td>
          <td>${Officer.formatDate(g.validFrom)}</td>
          <td>${Officer.formatDate(g.validTo)}</td>
          <td>${g.inspectionId ? `#${g.inspectionId}` : "<em>manual</em>"}</td>
          <td class="row-actions">
            <button class="btn btn-small" data-action="edit" data-id="${g.gradeId}">Correct</button>
            <button class="btn btn-small btn-text" data-action="delete" data-id="${g.gradeId}">Delete</button>
          </td>
        </tr>
      `)
      .join("");

    gradesEmpty.hidden = grades.length > 0;
  } catch (err) {
    gradesBody.innerHTML = "";
    gradesEmpty.hidden = false;
    gradesEmpty.textContent = `Could not load grades: ${err.message}`;
  }
}

document.getElementById("apply-filter").addEventListener("click", loadGrades);

// Populate both stall dropdowns from the stalls-due endpoint.
async function loadStallOptions() {
  try {
    const stalls = await Officer.api("/inspections/stalls-due");
    const options = stalls
      .map((s) => `<option value="${s.stallId}">${Officer.escapeHtml(s.stallName)} — ${Officer.escapeHtml(s.centerName)}</option>`)
      .join("");

    historySelect.innerHTML = `<option value="">Choose a stall…</option>` + options;
    gradeStallSelect.innerHTML = `<option value="">Choose a stall…</option>` + options;
  } catch (err) {
    console.error("Could not load stalls:", err.message);
  }
}

// ---- manual entry ----
gradeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  gradeFeedback.hidden = true;

  const inspectionId = document.getElementById("grade-inspectionId").value;

  const payload = {
    stallId: Number(gradeStallSelect.value),
    grade: document.getElementById("grade-letter").value,
    validFrom: document.getElementById("grade-validFrom").value,
    validTo: document.getElementById("grade-validTo").value,
  };
  // Only send inspectionId when one was typed - Joi allows it to be absent
  // but not to be an empty string.
  if (inspectionId) payload.inspectionId = Number(inspectionId);

  try {
    const created = await Officer.api("/hygiene-grades", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    Officer.toast(gradeFeedback, `Grade ${created.grade} issued for ${created.stallName}.`, true);
    gradeForm.reset();
    refreshAll();
  } catch (err) {
    Officer.toast(gradeFeedback, err.message, false);
  }
});

// ---- correct / delete ----
gradesBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  if (btn.dataset.action === "edit") openEditModal(btn.dataset.id);
  if (btn.dataset.action === "delete") deleteGrade(btn.dataset.id);
});

async function openEditModal(id) {
  try {
    const grade = await Officer.api(`/hygiene-grades/${id}`);
    currentEditId = id;
    editIdSpan.textContent = id;
    document.getElementById("edit-stallId").value = grade.stallId;
    document.getElementById("edit-grade").value = grade.grade;
    document.getElementById("edit-validFrom").value = Officer.toInputDate(grade.validFrom);
    document.getElementById("edit-validTo").value = Officer.toInputDate(grade.validTo);
    editError.hidden = true;
    editModal.hidden = false;
  } catch (err) {
    Officer.toast(pageError, `Could not open that grade: ${err.message}`, false);
  }
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  editModal.hidden = true;
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editError.hidden = true;

  const payload = {
    stallId: Number(document.getElementById("edit-stallId").value),
    grade: document.getElementById("edit-grade").value,
    validFrom: document.getElementById("edit-validFrom").value,
    validTo: document.getElementById("edit-validTo").value,
  };

  try {
    await Officer.api(`/hygiene-grades/${currentEditId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    editModal.hidden = true;
    refreshAll();
  } catch (err) {
    Officer.toast(editError, err.message, false);
  }
});

async function deleteGrade(id) {
  if (!confirm(`Delete hygiene grade #${id}?\n\nThis removes it from the stall's history.`)) return;
  try {
    await Officer.api(`/hygiene-grades/${id}`, { method: "DELETE" });
    refreshAll();
  } catch (err) {
    Officer.toast(pageError, `Could not delete: ${err.message}`, false);
  }
}

// ---------- start ----------
function refreshAll() {
  loadCurrentGrades();
  loadExpiring();
  loadGrades();
}

loadStallOptions();
refreshAll();
