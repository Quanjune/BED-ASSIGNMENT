const API_BASE = "/api";

const inspectionsBody = document.getElementById("inspections-body");
const inspectionsEmpty = document.getElementById("inspections-empty");

const scheduleForm = document.getElementById("schedule-form");
const scheduleFeedback = document.getElementById("schedule-feedback");

const filterStallInput = document.getElementById("filter-stallId");
const filterStatusSelect = document.getElementById("filter-status");
const applyFiltersBtn = document.getElementById("apply-filters");

const completeModal = document.getElementById("complete-modal");
const completeForm = document.getElementById("complete-form");
const completeIdSpan = document.getElementById("complete-id");
const completeResult = document.getElementById("complete-result");
const completeCancelBtn = document.getElementById("complete-cancel");

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdSpan = document.getElementById("edit-id");
const editCancelBtn = document.getElementById("edit-cancel");

let currentCompleteId = null;
let currentEditId = null;

// ---------- Helpers ----------

function showFeedback(el, message, type) {
    el.textContent = message;
    el.className = `feedback feedback-${type}`;
    el.hidden = false;
}

function statusBadge(status) {
    const cls = `badge-${status.toLowerCase()}`;
    return `<span class="badge ${cls}">${status}</span>`;
}

function formatDate(value) {
    if (!value) return "&mdash;";
    return new Date(value).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

async function apiRequest(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
}

// ---------- Rendering ----------

function renderInspections(inspections) {
    inspectionsBody.innerHTML = "";

    if (!inspections.length) {
        inspectionsEmpty.hidden = false;
        return;
    }
    inspectionsEmpty.hidden = true;

    for (const insp of inspections) {
        const tr = document.createElement("tr");

        const canComplete = insp.status === "Scheduled";
        const actions = `
            ${canComplete ? `<button class="btn btn-small" data-action="complete" data-id="${insp.inspectionId}">Complete</button>` : ""}
            <button class="btn btn-small" data-action="edit" data-id="${insp.inspectionId}">Edit</button>
            <button class="btn btn-small btn-text" data-action="delete" data-id="${insp.inspectionId}">Delete</button>
        `;

        tr.innerHTML = `
            <td>${insp.inspectionId}</td>
            <td>${insp.stallName} (#${insp.stallId})</td>
            <td>${insp.officerName}</td>
            <td>${formatDate(insp.scheduledDate)}</td>
            <td>${statusBadge(insp.status)}</td>
            <td>${formatDate(insp.completedDate)}</td>
            <td>${insp.score ?? "&mdash;"}</td>
            <td>${insp.remarks ?? "&mdash;"}</td>
            <td class="row-actions">${actions}</td>
        `;
        inspectionsBody.appendChild(tr);
    }
}

// ---------- Data loading ----------

async function loadInspections() {
    const stallId = filterStallInput.value.trim();
    const status = filterStatusSelect.value;

    const params = new URLSearchParams();
    if (stallId) params.set("stallId", stallId);
    if (status) params.set("status", status);

    try {
        const inspections = await apiRequest(`/inspections${params.toString() ? `?${params}` : ""}`);
        renderInspections(inspections);
    } catch (err) {
        inspectionsBody.innerHTML = "";
        inspectionsEmpty.hidden = false;
        inspectionsEmpty.textContent = `Could not load inspections: ${err.message}`;
    }
}

// ---------- Schedule form ----------

scheduleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    scheduleFeedback.hidden = true;

    const payload = {
        stallId: Number(document.getElementById("schedule-stallId").value),
        officerName: document.getElementById("schedule-officerName").value.trim(),
        scheduledDate: document.getElementById("schedule-date").value,
    };

    try {
        await apiRequest("/inspections", { method: "POST", body: JSON.stringify(payload) });
        showFeedback(scheduleFeedback, "Inspection scheduled.", "success");
        scheduleForm.reset();
        loadInspections();
    } catch (err) {
        showFeedback(scheduleFeedback, err.message, "error");
    }
});

// ---------- Filters ----------

applyFiltersBtn.addEventListener("click", loadInspections);

// ---------- Row actions (event delegation) ----------

inspectionsBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "complete") openCompleteModal(id);
    if (action === "edit") openEditModal(id);
    if (action === "delete") deleteInspection(id);
});

// ---------- Complete modal ----------

function openCompleteModal(id) {
    currentCompleteId = id;
    completeIdSpan.textContent = id;
    completeForm.reset();
    completeResult.hidden = true;
    completeModal.hidden = false;
}

completeCancelBtn.addEventListener("click", () => {
    completeModal.hidden = true;
});

completeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        score: Number(document.getElementById("complete-score").value),
        remarks: document.getElementById("complete-remarks").value.trim(),
        completedDate: document.getElementById("complete-date").value || undefined,
    };

    try {
        const result = await apiRequest(`/inspections/${currentCompleteId}/complete`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
        completeResult.hidden = false;
        completeResult.innerHTML = `
            <h4>Inspection completed</h4>
            <p>Hygiene grade <strong>${result.hygieneGrade.grade}</strong> issued,
            valid ${formatDate(result.hygieneGrade.validFrom)} &ndash; ${formatDate(result.hygieneGrade.validTo)}.</p>
        `;
        loadInspections();
    } catch (err) {
        completeResult.hidden = false;
        completeResult.innerHTML = `<p>${err.message}</p>`;
    }
});

// ---------- Edit modal ----------

async function openEditModal(id) {
    try {
        const insp = await apiRequest(`/inspections/${id}`);
        currentEditId = id;
        editIdSpan.textContent = id;
        document.getElementById("edit-stallId").value = insp.stallId;
        document.getElementById("edit-officerName").value = insp.officerName;
        document.getElementById("edit-scheduledDate").value = insp.scheduledDate.slice(0, 10);
        document.getElementById("edit-status").value = insp.status === "Completed" ? "Scheduled" : insp.status;
        editModal.hidden = false;
    } catch (err) {
        alert(`Could not load inspection: ${err.message}`);
    }
}

editCancelBtn.addEventListener("click", () => {
    editModal.hidden = true;
});

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        stallId: Number(document.getElementById("edit-stallId").value),
        officerName: document.getElementById("edit-officerName").value.trim(),
        scheduledDate: document.getElementById("edit-scheduledDate").value,
        status: document.getElementById("edit-status").value,
    };

    try {
        await apiRequest(`/inspections/${currentEditId}`, { method: "PUT", body: JSON.stringify(payload) });
        editModal.hidden = true;
        loadInspections();
    } catch (err) {
        alert(`Could not save changes: ${err.message}`);
    }
});

// ---------- Delete ----------

async function deleteInspection(id) {
    if (!confirm(`Delete inspection #${id}? This cannot be undone.`)) return;

    try {
        await apiRequest(`/inspections/${id}`, { method: "DELETE" });
        loadInspections();
    } catch (err) {
        alert(`Could not delete inspection: ${err.message}`);
    }
}

loadInspections();
