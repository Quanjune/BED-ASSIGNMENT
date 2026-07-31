// officer.js  (Kaden - NEA officer portal, My Worklist page)
// Reads GET /api/inspections/mine and renders the four panels. The server
// decides which inspections belong to this officer from the JWT, so there is
// no officer id anywhere in this file.

// Stop immediately if the visitor is not a signed-in officer.
if (!Officer.requireOfficer()) {
  // requireOfficer has already redirected; throwing stops the rest of the
  // file from running against a page that is about to be replaced.
  throw new Error("Not an officer.");
}

// ---------- element lookups ----------
const pageError = document.getElementById("page-error");

const bodies = {
  overdue: document.getElementById("overdue-body"),
  today: document.getElementById("today-body"),
  upcoming: document.getElementById("upcoming-body"),
  completed: document.getElementById("completed-body"),
};
const empties = {
  overdue: document.getElementById("overdue-empty"),
  today: document.getElementById("today-empty"),
  upcoming: document.getElementById("upcoming-empty"),
  completed: document.getElementById("completed-empty"),
};

const completeModal = document.getElementById("complete-modal");
const completeForm = document.getElementById("complete-form");
const completeStall = document.getElementById("complete-stall");
const completeError = document.getElementById("complete-error");
const completeResult = document.getElementById("complete-result");

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdSpan = document.getElementById("edit-id");
const editStallSelect = document.getElementById("edit-stallId");
const editError = document.getElementById("edit-error");

let currentCompleteId = null;
let currentEditId = null;
let stallOptionsHtml = ""; // built once, reused by the reschedule modal

// ---------- rendering ----------

// One row of an open (not yet carried out) inspection.
function openRow(insp) {
  return `
    <tr>
      <td>${insp.inspectionId}</td>
      <td>${Officer.escapeHtml(insp.stallName)} <span class="muted">#${insp.stallId}</span></td>
      <td>${Officer.escapeHtml(insp.centerName)}</td>
      <td>${Officer.formatDate(insp.scheduledDate)}</td>
      <td class="row-actions">
        <button class="btn btn-small btn-primary" data-action="complete"
                data-id="${insp.inspectionId}"
                data-stall="${Officer.escapeHtml(insp.stallName)}">Record result</button>
        <button class="btn btn-small" data-action="edit" data-id="${insp.inspectionId}">Reschedule</button>
        <button class="btn btn-small btn-text" data-action="delete" data-id="${insp.inspectionId}">Delete</button>
      </td>
    </tr>
  `;
}

function completedRow(insp) {
  return `
    <tr>
      <td>${insp.inspectionId}</td>
      <td>${Officer.escapeHtml(insp.stallName)} <span class="muted">#${insp.stallId}</span></td>
      <td>${Officer.formatDate(insp.completedDate)}</td>
      <td><strong>${insp.score}</strong></td>
      <td class="remarks-cell">${Officer.escapeHtml(insp.remarks) || "&mdash;"}</td>
    </tr>
  `;
}

function renderList(key, rows, rowBuilder) {
  bodies[key].innerHTML = rows.map(rowBuilder).join("");
  empties[key].hidden = rows.length > 0;
}

// ---------- data loading ----------

async function loadWorklist() {
  pageError.hidden = true;
  try {
    const data = await Officer.api("/inspections/mine");

    document.getElementById("stat-overdue").textContent = data.stats.overdue;
    document.getElementById("stat-today").textContent = data.stats.dueToday;
    document.getElementById("stat-upcoming").textContent = data.stats.upcoming;
    document.getElementById("stat-completed").textContent = data.stats.completedLast30Days;

    renderList("overdue", data.overdue, openRow);
    renderList("today", data.dueToday, openRow);
    renderList("upcoming", data.upcoming, openRow);
    renderList("completed", data.recentlyCompleted, completedRow);
  } catch (err) {
    Officer.toast(pageError, `Could not load your worklist: ${err.message}`, false);
  }
}

// The reschedule modal needs a stall dropdown. stalls-due already returns
// every stall with its centre name, so we reuse it instead of adding another
// endpoint.
async function loadStallOptions() {
  try {
    const stalls = await Officer.api("/inspections/stalls-due");
    stallOptionsHtml = stalls
      .map((s) => `<option value="${s.stallId}">${Officer.escapeHtml(s.stallName)} — ${Officer.escapeHtml(s.centerName)}</option>`)
      .join("");
    editStallSelect.innerHTML = stallOptionsHtml;
  } catch (err) {
    console.error("Could not load stalls:", err.message);
  }
}

// ---------- row actions (one listener per table, using event delegation) ----------

function wireTable(tbody) {
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const { action, id, stall } = btn.dataset;
    if (action === "complete") openCompleteModal(id, stall);
    if (action === "edit") openEditModal(id);
    if (action === "delete") deleteInspection(id);
  });
}
[bodies.overdue, bodies.today, bodies.upcoming].forEach(wireTable);

// ---------- record result ----------

function openCompleteModal(id, stallName) {
  currentCompleteId = id;
  completeStall.textContent = stallName;
  completeForm.reset();
  completeForm.hidden = false;
  document.getElementById("complete-date").value = Officer.todayInput();
  completeError.hidden = true;
  completeResult.hidden = true;
  completeModal.hidden = false;
}

document.getElementById("complete-cancel").addEventListener("click", () => {
  completeModal.hidden = true;
});

completeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  completeError.hidden = true;

  // Build the body. An empty date field is left out entirely so the server
  // falls back to today rather than receiving an empty string.
  const payload = { score: Number(document.getElementById("complete-score").value) };
  const remarks = document.getElementById("complete-remarks").value.trim();
  const date = document.getElementById("complete-date").value;
  if (remarks) payload.remarks = remarks;
  if (date) payload.completedDate = date;

  try {
    const result = await Officer.api(`/inspections/${currentCompleteId}/complete`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    // Hide the form and show what the system decided, so the officer can see
    // the consequence of the score they entered.
    completeForm.hidden = true;
    completeResult.hidden = false;
    completeResult.innerHTML = `
      <h4>Result recorded</h4>
      <p>
        ${Officer.gradeBadge(result.hygieneGrade.grade)}
        issued for <strong>${Officer.escapeHtml(result.inspection.stallName)}</strong>,
        valid ${Officer.formatDate(result.hygieneGrade.validFrom)}
        &ndash; ${Officer.formatDate(result.hygieneGrade.validTo)}.
      </p>
      ${result.followUp
        ? `<p class="follow-up-note">Score was below 55, so a re-inspection has been booked for
             <strong>${Officer.formatDate(result.followUp.scheduledDate)}</strong>
             (inspection #${result.followUp.inspectionId}).</p>`
        : ""}
      <button type="button" class="btn btn-primary" id="complete-done">Done</button>
    `;
    document.getElementById("complete-done").addEventListener("click", () => {
      completeModal.hidden = true;
    });

    loadWorklist();
  } catch (err) {
    Officer.toast(completeError, err.message, false);
  }
});

// ---------- reschedule / cancel ----------

async function openEditModal(id) {
  try {
    const insp = await Officer.api(`/inspections/${id}`);
    currentEditId = id;
    editIdSpan.textContent = id;
    if (!editStallSelect.innerHTML) editStallSelect.innerHTML = stallOptionsHtml;
    editStallSelect.value = insp.stallId;
    document.getElementById("edit-date").value = Officer.toInputDate(insp.scheduledDate);
    document.getElementById("edit-status").value = insp.status;
    editError.hidden = true;
    editModal.hidden = false;
  } catch (err) {
    Officer.toast(pageError, `Could not open that inspection: ${err.message}`, false);
  }
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  editModal.hidden = true;
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editError.hidden = true;

  const payload = {
    stallId: Number(editStallSelect.value),
    scheduledDate: document.getElementById("edit-date").value,
    status: document.getElementById("edit-status").value,
  };

  try {
    await Officer.api(`/inspections/${currentEditId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    editModal.hidden = true;
    loadWorklist();
  } catch (err) {
    Officer.toast(editError, err.message, false);
  }
});

// ---------- delete ----------

async function deleteInspection(id) {
  if (!confirm(`Delete inspection #${id}?\n\nAny hygiene grade it issued stays on the stall's record.`)) {
    return;
  }
  try {
    await Officer.api(`/inspections/${id}`, { method: "DELETE" });
    loadWorklist();
  } catch (err) {
    Officer.toast(pageError, `Could not delete: ${err.message}`, false);
  }
}

// ---------- start ----------
loadWorklist();
loadStallOptions();
