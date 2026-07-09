/* ===================================================================
   Vendor Rental Agreements — talks to your backend at
   /api/vendors/agreements  (relative URL, so it works when the page
   is served by the backend at http://localhost:3000/vendor_agreements.html
   — same origin, no CORS).

   Endpoints (same shape as your menu module):
     GET  /api/vendors/agreements                 -> all agreements
     GET  /api/vendors/agreements/stall/:stallId  -> agreements for one stall
     POST /api/vendors/agreements                 -> register (stallId, startDate,
                                                     endDate, monthlyRent, deposit, status)
     PUT  /api/vendors/agreements/:id             -> update

   NOTE: these backend routes still need to be built (vendorAgreements
   model/controller/routes). Until then the page loads but shows the
   "couldn't reach the server" message — that's expected.
   =================================================================== */

const API = "/api/vendors/agreements";

const filterStall = document.getElementById("filter-stall");
const btnLoad     = document.getElementById("btn-load");
const btnLoadAll  = document.getElementById("btn-load-all");
const statusEl    = document.getElementById("status");

const editId     = document.getElementById("edit-id");
const inStall    = document.getElementById("in-stall");
const inStart    = document.getElementById("in-start");
const inEnd      = document.getElementById("in-end");
const inRent     = document.getElementById("in-rent");
const inDeposit  = document.getElementById("in-deposit");
const inStatus   = document.getElementById("in-status");
const formTitle  = document.getElementById("form-title");
const btnSave    = document.getElementById("btn-save");
const btnCancel  = document.getElementById("btn-cancel");

const listEl = document.getElementById("agreement-list");

// ---- helpers ------------------------------------------------------
function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "vm-status " + (type || "");
    statusEl.hidden = false;
}
function clearStatus() { statusEl.hidden = true; }

// SQL/model field casing can vary — read whatever exists.
function normalise(a) {
    return {
        id:      a.agreementId ?? a.AgreementID ?? a.agreementID ?? a.AgreementId ?? a.id,
        stall:   a.stallId ?? a.StallID ?? a.stallID ?? a.StallId,
        start:   a.startDate ?? a.StartDate ?? a.start,
        end:     a.endDate ?? a.EndDate ?? a.end,
        rent:    a.monthlyRent ?? a.MonthlyRent ?? a.rent,
        deposit: a.deposit ?? a.Deposit,
        status:  a.status ?? a.Status ?? "active",
    };
}
function money(v) {
    const n = Number(v);
    return isNaN(n) ? "\u2014" : "S$" + n.toFixed(2);
}
function fmtDate(v) {
    if (!v) return "\u2014";
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toISOString().slice(0, 10);
}
// days until the end date (negative = already expired)
function daysToExpiry(end) {
    if (!end) return null;
    const d = new Date(end);
    if (isNaN(d)) return null;
    const today = new Date();
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}
function expiryLabel(end) {
    const days = daysToExpiry(end);
    if (days === null) return { text: "", warn: false };
    if (days < 0)   return { text: `Expired ${Math.abs(days)} day(s) ago`, warn: true };
    if (days === 0) return { text: "Expires today", warn: true };
    if (days <= 30) return { text: `Expires in ${days} day(s)`, warn: true };
    return { text: `Expires in ${days} day(s)`, warn: false };
}

// ---- load & render ------------------------------------------------
async function loadAgreements(stallId) {
    clearStatus();
    listEl.innerHTML = '<p class="vm-empty">Loading\u2026</p>';
    const url = stallId ? `${API}/stall/${stallId}` : API;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showStatus(err.error || `Couldn't load agreements (${res.status}).`, "err");
            listEl.innerHTML = '<p class="vm-empty">Nothing to show.</p>';
            return;
        }
        const data = await res.json();
        render(Array.isArray(data) ? data : (data.items || []));
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
        listEl.innerHTML = '<p class="vm-empty">Nothing to show.</p>';
    }
}

function render(items) {
    if (!items.length) {
        listEl.innerHTML = '<p class="vm-empty">No agreements here yet. Register one on the left.</p>';
        return;
    }
    listEl.innerHTML = "";
    items.map(normalise).forEach((it) => {
        const exp = expiryLabel(it.end);
        const row = document.createElement("div");
        row.className = "vm-item";
        row.innerHTML = `
            <div class="vm-info">
                <div class="vm-name">Stall ${it.stall ?? "?"} \u00b7 ${money(it.rent)}/mo</div>
                <div class="vm-meta">${fmtDate(it.start)} \u2192 ${fmtDate(it.end)} \u00b7 ID ${it.id ?? "?"}</div>
                <div class="vm-expiry ${exp.warn ? "warn" : ""}">${exp.text}</div>
            </div>
            <div class="vm-price"><span class="vm-badge ${it.status}">${it.status}</span></div>
            <div class="vm-actions">
                <button class="vm-btn vm-btn-mini">Edit</button>
            </div>`;
        row.querySelector(".vm-btn-mini").addEventListener("click", () => startEdit(it));
        listEl.appendChild(row);
    });
}

// ---- register / edit ----------------------------------------------
function startEdit(it) {
    editId.value    = it.id ?? "";
    inStall.value   = it.stall ?? "";
    inStart.value   = fmtDate(it.start) === "\u2014" ? "" : fmtDate(it.start);
    inEnd.value     = fmtDate(it.end) === "\u2014" ? "" : fmtDate(it.end);
    inRent.value    = it.rent ?? "";
    inDeposit.value = it.deposit ?? "";
    inStatus.value  = it.status ?? "active";
    formTitle.textContent = "Edit agreement";
    btnSave.textContent = "Update agreement";
    btnCancel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
    editId.value = "";
    inStall.value = inStart.value = inEnd.value = inRent.value = inDeposit.value = "";
    inStatus.value = "active";
    formTitle.textContent = "Register an agreement";
    btnSave.textContent = "Register agreement";
    btnCancel.hidden = true;
}

async function save() {
    clearStatus();
    const stall = inStall.value.trim();
    const start = inStart.value;
    const end   = inEnd.value;
    const rent  = inRent.value.trim();

    if (!stall || !start || !end || rent === "") {
        showStatus("Stall ID, start date, end date and monthly rent are all required.", "err");
        return;
    }
    if (end < start) {
        showStatus("End date can't be before the start date.", "err");
        return;
    }

    const payload = {
        stallId: Number(stall),
        startDate: start,
        endDate: end,
        monthlyRent: Number(rent),
        deposit: inDeposit.value.trim() === "" ? 0 : Number(inDeposit.value),
        status: inStatus.value,
    };

    const id = editId.value;
    const editing = id !== "";

    try {
        const res = await fetch(editing ? `${API}/${id}` : API, {
            method: editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showStatus(data.error || `Save failed (${res.status}).`, "err");
            return;
        }
        showStatus(editing ? "Agreement updated." : "Agreement registered.", "ok");
        resetForm();
        const f = filterStall.value.trim();
        loadAgreements(f || undefined);
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

// ---- wire up ------------------------------------------------------
btnLoad.addEventListener("click", () => {
    const f = filterStall.value.trim();
    if (!f) { showStatus("Type a Stall ID first, or hit \u201cShow all agreements\u201d.", "err"); return; }
    loadAgreements(f);
});
btnLoadAll.addEventListener("click", () => { filterStall.value = ""; loadAgreements(); });
btnSave.addEventListener("click", save);
btnCancel.addEventListener("click", resetForm);

loadAgreements();  // load everything on first open