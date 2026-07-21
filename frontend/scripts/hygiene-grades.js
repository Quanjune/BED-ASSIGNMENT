const API_BASE = "/api";

const currentGradesCards = document.getElementById("current-grades-cards");
const currentGradesEmpty = document.getElementById("current-grades-empty");

const gradesBody = document.getElementById("grades-body");
const gradesEmpty = document.getElementById("grades-empty");

const gradeForm = document.getElementById("grade-form");
const gradeFeedback = document.getElementById("grade-feedback");

const filterStallInput = document.getElementById("filter-stallId");
const applyFilterBtn = document.getElementById("apply-filter");

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdSpan = document.getElementById("edit-id");
const editCancelBtn = document.getElementById("edit-cancel");

let currentEditId = null;
let lastLoadedGrades = [];

// ---------- Helpers ----------

function showFeedback(el, message, type) {
    el.textContent = message;
    el.className = `feedback feedback-${type}`;
    el.hidden = false;
}

function gradeBadge(grade) {
    return `<span class="grade-badge grade-${grade.toLowerCase()}">${grade}</span>`;
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

// ---------- Current grade summary (most recent grade per stall) ----------

function renderCurrentGrades(grades) {
    const latestByStall = new Map();
    for (const g of grades) {
        const existing = latestByStall.get(g.stallId);
        if (!existing || new Date(g.validFrom) > new Date(existing.validFrom)) {
            latestByStall.set(g.stallId, g);
        }
    }

    currentGradesCards.innerHTML = "";
    if (!latestByStall.size) {
        currentGradesEmpty.hidden = false;
        return;
    }
    currentGradesEmpty.hidden = true;

    for (const g of latestByStall.values()) {
        const card = document.createElement("div");
        card.className = "current-grade-card";
        card.innerHTML = `
            ${gradeBadge(g.grade)}
            <div class="details">
                <h4>${g.stallName} (#${g.stallId})</h4>
                <p>Valid ${formatDate(g.validFrom)} &ndash; ${formatDate(g.validTo)}</p>
            </div>
        `;
        currentGradesCards.appendChild(card);
    }
}

// ---------- Full history table ----------

function renderGradesTable(grades) {
    gradesBody.innerHTML = "";

    if (!grades.length) {
        gradesEmpty.hidden = false;
        return;
    }
    gradesEmpty.hidden = true;

    for (const g of grades) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${g.gradeId}</td>
            <td>${g.stallName} (#${g.stallId})</td>
            <td>${gradeBadge(g.grade)}</td>
            <td>${formatDate(g.validFrom)}</td>
            <td>${formatDate(g.validTo)}</td>
            <td>${g.inspectionId ?? "&mdash;"}</td>
            <td class="row-actions">
                <button class="btn btn-small" data-action="edit" data-id="${g.gradeId}">Edit</button>
                <button class="btn btn-small btn-text" data-action="delete" data-id="${g.gradeId}">Delete</button>
            </td>
        `;
        gradesBody.appendChild(tr);
    }
}

// ---------- Data loading ----------

async function loadGrades() {
    const stallId = filterStallInput.value.trim();
    const params = new URLSearchParams();
    if (stallId) params.set("stallId", stallId);

    try {
        const grades = await apiRequest(`/hygiene-grades${params.toString() ? `?${params}` : ""}`);
        lastLoadedGrades = grades;
        renderGradesTable(grades);

        // Current-grade summary should reflect all stalls, not the filtered view,
        // unless the user has filtered to one stall (then just show that one).
        if (stallId) {
            renderCurrentGrades(grades);
        } else {
            renderCurrentGrades(grades);
        }
    } catch (err) {
        gradesBody.innerHTML = "";
        gradesEmpty.hidden = false;
        gradesEmpty.textContent = `Could not load hygiene grades: ${err.message}`;
    }
}

// ---------- Manual entry form ----------

gradeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    gradeFeedback.hidden = true;

    const inspectionIdRaw = document.getElementById("grade-inspectionId").value.trim();
    const payload = {
        stallId: Number(document.getElementById("grade-stallId").value),
        inspectionId: inspectionIdRaw ? Number(inspectionIdRaw) : null,
        grade: document.getElementById("grade-grade").value,
        validFrom: document.getElementById("grade-validFrom").value,
        validTo: document.getElementById("grade-validTo").value,
    };

    try {
        await apiRequest("/hygiene-grades", { method: "POST", body: JSON.stringify(payload) });
        showFeedback(gradeFeedback, "Hygiene grade saved.", "success");
        gradeForm.reset();
        loadGrades();
    } catch (err) {
        showFeedback(gradeFeedback, err.message, "error");
    }
});

// ---------- Filters ----------

applyFilterBtn.addEventListener("click", loadGrades);

// ---------- Row actions ----------

gradesBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "edit") openEditModal(id);
    if (action === "delete") deleteGrade(id);
});

function openEditModal(id) {
    const grade = lastLoadedGrades.find((g) => String(g.gradeId) === String(id));
    if (!grade) return;

    currentEditId = id;
    editIdSpan.textContent = id;
    document.getElementById("edit-stallId").value = grade.stallId;
    document.getElementById("edit-inspectionId").value = grade.inspectionId ?? "";
    document.getElementById("edit-grade").value = grade.grade;
    document.getElementById("edit-validFrom").value = grade.validFrom.slice(0, 10);
    document.getElementById("edit-validTo").value = grade.validTo.slice(0, 10);
    editModal.hidden = false;
}

editCancelBtn.addEventListener("click", () => {
    editModal.hidden = true;
});

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const inspectionIdRaw = document.getElementById("edit-inspectionId").value.trim();
    const payload = {
        stallId: Number(document.getElementById("edit-stallId").value),
        inspectionId: inspectionIdRaw ? Number(inspectionIdRaw) : null,
        grade: document.getElementById("edit-grade").value,
        validFrom: document.getElementById("edit-validFrom").value,
        validTo: document.getElementById("edit-validTo").value,
    };

    try {
        await apiRequest(`/hygiene-grades/${currentEditId}`, { method: "PUT", body: JSON.stringify(payload) });
        editModal.hidden = true;
        loadGrades();
    } catch (err) {
        alert(`Could not save changes: ${err.message}`);
    }
});

// ---------- Delete ----------

async function deleteGrade(id) {
    if (!confirm(`Delete hygiene grade #${id}? This cannot be undone.`)) return;

    try {
        await apiRequest(`/hygiene-grades/${id}`, { method: "DELETE" });
        loadGrades();
    } catch (err) {
        alert(`Could not delete grade: ${err.message}`);
    }
}

// ---------- Init ----------

loadGrades();
