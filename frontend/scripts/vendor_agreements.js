/* ===================================================================
   Vendor Agreements & Licences  (Kishore - Vendor Management)
   Talks to /api/vendors/agreements THROUGH the login token.

   Same idea as vendor.js: no Stall ID anywhere. You sign in, the
   backend knows which stall you own, and every document below is
   yours only. One record = one document (rental agreement, SFA food
   licence, fire safety cert, etc).

   Endpoints (all require Authorization: Bearer <token>):
     GET    /api/vendors/agreements       -> my stall's documents
     POST   /api/vendors/agreements       -> add
     PUT    /api/vendors/agreements/:id   -> edit
     DELETE /api/vendors/agreements/:id   -> delete

   The backend already computes displayStatus + daysToExpiry in SQL
   (Active / Expiring Soon / Expired / Terminated), so the badge just
   trusts what it gets back. There's a tiny fallback compute in case
   an older backend build doesn't send those fields.
   =================================================================== */

const API = "/api/vendors/agreements";

const statusEl  = document.getElementById("status");
const editId    = document.getElementById("edit-id");
const inName    = document.getElementById("in-name");
const inType    = document.getElementById("in-type");
const inStart   = document.getElementById("in-start");
const inEnd     = document.getElementById("in-end");
const inRent    = document.getElementById("in-rent");
const rentReq   = document.getElementById("rent-req");
const inStatus  = document.getElementById("in-status");
const formTitle = document.getElementById("form-title");
const btnSave   = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");
const listEl    = document.getElementById("agreement-list");

// ---- helpers ------------------------------------------------------
function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "vm-status " + (type || "");
    statusEl.hidden = false;
}
function clearStatus() { statusEl.hidden = true; }

function normalise(a) {
    return {
        id:     a.agreementId ?? a.id,
        name:   a.name,
        type:   a.agreementType ?? a.type,
        start:  a.startDate ?? a.start,
        end:    a.expiryDate ?? a.end,
        rent:   a.monthlyRent ?? null,
        status: a.status ?? "Active",
        displayStatus: a.displayStatus,
        days:   a.daysToExpiry,
    };
}

function money(v) {
    const n = Number(v);
    return isNaN(n) ? "\u2014" : "S$" + n.toFixed(2);
}

// "2026-09-30T00:00:00.000Z" -> "30 Sep 2026" (and yyyy-mm-dd for inputs)
function fmtDate(v) {
    if (!v) return "\u2014";
    const d = new Date(v);
    if (isNaN(d)) return "\u2014";
    return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}
function toInputDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return "";
    return d.toISOString().slice(0, 10);
}

// Fallback only — normally the backend sends displayStatus/daysToExpiry.
function computeDisplay(it) {
    if (it.displayStatus) return it;
    if (it.status === "Terminated") { it.displayStatus = "Terminated"; return it; }
    const end = new Date(it.end);
    const days = Math.ceil((end - new Date()) / 86400000);
    it.days = days;
    it.displayStatus = days < 0 ? "Expired" : days <= 30 ? "Expiring Soon" : "Active";
    return it;
}

function badgeClass(displayStatus) {
    switch (displayStatus) {
        case "Active":        return "vm-badge ok";
        case "Expiring Soon": return "vm-badge warn";
        case "Expired":       return "vm-badge danger";
        case "Terminated":    return "vm-badge muted";
        default:              return "vm-badge";
    }
}

function handleAuthFail(res, data) {
    if (res.status === 401 || res.status === 403) {
        VendorAuth.showLogin(data.message || data.error || "Your session expired. Sign in again.");
        return true;
    }
    return false;
}

// Monthly rent only makes sense for Rental documents — the Joi validator
// on the backend enforces the same rule, this just mirrors it in the UI.
function syncRentField() {
    const isRental = inType.value === "Rental";
    inRent.disabled = !isRental;
    rentReq.hidden = !isRental;
    if (!isRental) inRent.value = "";
}

// ---- load & render ------------------------------------------------
async function loadAgreements() {
    clearStatus();
    listEl.innerHTML = '<p class="vm-empty">Loading\u2026</p>';
    try {
        const res = await VendorAuth.authFetch(API);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (handleAuthFail(res, data)) return;
            showStatus(data.error || `Couldn't load your documents (${res.status}).`, "err");
            listEl.innerHTML = '<p class="vm-empty">Nothing to show.</p>';
            return;
        }
        render(Array.isArray(data) ? data : []);
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
        listEl.innerHTML = '<p class="vm-empty">Nothing to show.</p>';
    }
}

function render(items) {
    if (!items.length) {
        listEl.innerHTML = '<p class="vm-empty">No agreements or licences recorded yet. Add your first one on the left.</p>';
        return;
    }
    listEl.innerHTML = "";
    items.map(normalise).map(computeDisplay).forEach((it) => {
        const row = document.createElement("div");
        row.className = "vm-item";
        row.innerHTML = `
            <div class="vm-info">
                <div class="vm-name"></div>
                <div class="vm-meta"></div>
                <div class="vm-expiry"></div>
            </div>
            <span class="${badgeClass(it.displayStatus)}"></span>
            <div class="vm-actions">
                <button class="vm-btn vm-btn-mini">Edit</button>
                <button class="vm-btn vm-btn-danger">Delete</button>
            </div>`;

        // set text via properties so odd characters are safe
        row.querySelector(".vm-name").textContent = it.name ?? "(unnamed)";

        const metaBits = [it.type];
        if (it.type === "Rental" && it.rent != null) metaBits.push(money(it.rent) + "/mo");
        row.querySelector(".vm-meta").textContent = metaBits.join(" \u00B7 ");

        let expiryText = `${fmtDate(it.start)} \u2192 ${fmtDate(it.end)}`;
        if (it.displayStatus === "Expiring Soon" && it.days != null) {
            expiryText += ` \u00B7 ${it.days} day${it.days === 1 ? "" : "s"} left`;
        }
        row.querySelector(".vm-expiry").textContent = expiryText;

        row.querySelector(".vm-badge").textContent = it.displayStatus;
        row.querySelector(".vm-btn-mini").addEventListener("click", () => startEdit(it));
        row.querySelector(".vm-btn-danger").addEventListener("click", () => remove(it));
        listEl.appendChild(row);
    });
}

// ---- add / edit ---------------------------------------------------
function startEdit(it) {
    editId.value   = it.id ?? "";
    inName.value   = it.name ?? "";
    inType.value   = it.type ?? "Rental";
    inStart.value  = toInputDate(it.start);
    inEnd.value    = toInputDate(it.end);
    inStatus.value = it.status ?? "Active";
    syncRentField();
    inRent.value   = it.type === "Rental" && it.rent != null ? it.rent : "";
    formTitle.textContent = "Edit document";
    btnSave.textContent = "Update document";
    btnCancel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
    editId.value = "";
    inName.value = inStart.value = inEnd.value = inRent.value = "";
    inType.value = "Rental";
    inStatus.value = "Active";
    syncRentField();
    formTitle.textContent = "Add a document";
    btnSave.textContent = "Save document";
    btnCancel.hidden = true;
}

async function save() {
    clearStatus();
    const name  = inName.value.trim();
    const start = inStart.value;
    const end   = inEnd.value;

    if (!name || !start || !end) {
        showStatus("Document name, Start date and Expiry date are all required.", "err");
        return;
    }
    if (inType.value === "Rental" && inRent.value.trim() === "") {
        showStatus("Monthly rent is required for Rental documents.", "err");
        return;
    }

    // NOTE: no stallId in the payload - the backend takes it from the token.
    const payload = {
        name,
        agreementType: inType.value,
        startDate: start,
        expiryDate: end,
        monthlyRent: inType.value === "Rental" ? Number(inRent.value) : null,
        status: inStatus.value,
    };

    const id = editId.value;
    const editing = id !== "";

    try {
        const res = await VendorAuth.authFetch(editing ? `${API}/${id}` : API, {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (handleAuthFail(res, data)) return;
            const detail = data.details ? " " + data.details.join(" ") : "";
            showStatus((data.error || `Save failed (${res.status}).`) + detail, "err");
            return;
        }
        showStatus(editing ? "Document updated." : "Document added.", "ok");
        resetForm();
        loadAgreements();
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

async function remove(it) {
    if (!confirm(`Delete "${it.name}"? This can't be undone.`)) return;
    clearStatus();
    try {
        const res = await VendorAuth.authFetch(`${API}/${it.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (handleAuthFail(res, data)) return;
            showStatus(data.error || `Delete failed (${res.status}).`, "err");
            return;
        }
        showStatus("Document deleted.", "ok");
        loadAgreements();
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

// ---- wire up ------------------------------------------------------
btnSave.addEventListener("click", save);
btnCancel.addEventListener("click", resetForm);
inType.addEventListener("change", syncRentField);

// The gate (vendor_auth.js) shows the login card first; once the login and
// stall lookup succeed it calls onReady, and only then do we load the list.
VendorAuth.initVendorGate({ onReady: () => { resetForm(); loadAgreements(); } });
