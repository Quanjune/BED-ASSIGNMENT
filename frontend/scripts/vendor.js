/* ===================================================================
   Vendor Menu  (Kishore - Vendor Management)
   Talks to /api/vendors/menu THROUGH the login token.

   The big change from the old version: there is no "Stall ID" anywhere.
   You sign in (vendor_auth.js), the backend works out which stall your
   account owns, and every request below only touches THAT stall.

   Endpoints (all require Authorization: Bearer <token>):
     GET    /api/vendors/menu       -> my stall's items
     POST   /api/vendors/menu       -> add   (name, description, imagePath, basePrice)
     PUT    /api/vendors/menu/:id   -> edit
     DELETE /api/vendors/menu/:id   -> delete
   =================================================================== */

const API = "/api/vendors/menu";
const PLACEHOLDER_IMG = "../media/icons/main-dish.svg"; // shown when a dish has no image

const statusEl  = document.getElementById("status");
const editId    = document.getElementById("edit-id");
const inName    = document.getElementById("in-name");
const inDesc    = document.getElementById("in-desc");
const inImage   = document.getElementById("in-image");
const inPrice   = document.getElementById("in-price");
const formTitle = document.getElementById("form-title");
const btnSave   = document.getElementById("btn-save");
const btnCancel = document.getElementById("btn-cancel");
const listEl    = document.getElementById("menu-list");

// ---- helpers ------------------------------------------------------
function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "vm-status " + (type || "");
    statusEl.hidden = false;
}
function clearStatus() { statusEl.hidden = true; }

function normalise(item) {
    return {
        id:    item.productId ?? item.id,
        name:  item.name,
        desc:  item.description ?? "",
        image: item.imagePath ?? "",
        price: item.basePrice ?? item.price,
    };
}
function money(v) {
    const n = Number(v);
    return isNaN(n) ? "\u2014" : "S$" + n.toFixed(2);
}

// If a request comes back 401/403 the token is missing/expired ->
// send the user back to the sign-in card.
function handleAuthFail(res, data) {
    if (res.status === 401 || res.status === 403) {
        VendorAuth.showLogin(data.message || data.error || "Your session expired. Sign in again.");
        return true;
    }
    return false;
}

// ---- load & render ------------------------------------------------
async function loadMenu() {
    clearStatus();
    listEl.innerHTML = '<p class="vm-empty">Loading\u2026</p>';
    try {
        const res = await VendorAuth.authFetch(API);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (handleAuthFail(res, data)) return;
            showStatus(data.error || `Couldn't load your menu (${res.status}).`, "err");
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
        listEl.innerHTML = '<p class="vm-empty">No dishes on your menu yet. Add your first one on the left.</p>';
        return;
    }
    listEl.innerHTML = "";
    items.map(normalise).forEach((it) => {
        const row = document.createElement("div");
        row.className = "vm-item";
        row.innerHTML = `
            <img class="vm-thumb" alt="">
            <div class="vm-info">
                <div class="vm-name"></div>
                <div class="vm-meta"></div>
            </div>
            <div class="vm-price">${money(it.price)}</div>
            <div class="vm-actions">
                <button class="vm-btn vm-btn-mini">Edit</button>
                <button class="vm-btn vm-btn-danger">Delete</button>
            </div>`;

        // set text/src via properties (not string HTML) so odd characters are safe
        const img = row.querySelector(".vm-thumb");
        img.src = it.image || PLACEHOLDER_IMG;
        if (!it.image) img.classList.add("vm-thumb-ph");
        img.onerror = () => { img.src = PLACEHOLDER_IMG; img.classList.add("vm-thumb-ph"); };

        row.querySelector(".vm-name").textContent = it.name ?? "(unnamed)";
        row.querySelector(".vm-meta").textContent = it.desc || "No description yet";
        row.querySelector(".vm-btn-mini").addEventListener("click", () => startEdit(it));
        row.querySelector(".vm-btn-danger").addEventListener("click", () => remove(it));
        listEl.appendChild(row);
    });
}

// ---- add / edit ---------------------------------------------------
function startEdit(it) {
    editId.value  = it.id ?? "";
    inName.value  = it.name ?? "";
    inDesc.value  = it.desc ?? "";
    inImage.value = it.image ?? "";
    inPrice.value = it.price ?? "";
    formTitle.textContent = "Edit dish";
    btnSave.textContent = "Update dish";
    btnCancel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
    editId.value = "";
    inName.value = inDesc.value = inImage.value = inPrice.value = "";
    formTitle.textContent = "Add a dish";
    btnSave.textContent = "Save dish";
    btnCancel.hidden = true;
}

async function save() {
    clearStatus();
    const name  = inName.value.trim();
    const price = inPrice.value.trim();

    if (!name || price === "") {
        showStatus("Dish name and Base price are both required.", "err");
        return;
    }

    // NOTE: no stallId in the payload - the backend takes it from the token.
    const payload = {
        name,
        description: inDesc.value.trim(),
        imagePath: inImage.value.trim(),
        basePrice: Number(price),
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
        showStatus(editing ? "Dish updated." : "Dish added.", "ok");
        resetForm();
        loadMenu();
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
        showStatus("Dish deleted.", "ok");
        loadMenu();
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

// ---- wire up ------------------------------------------------------
btnSave.addEventListener("click", save);
btnCancel.addEventListener("click", resetForm);

// The gate (vendor_auth.js) shows the login card first; once the login and
// stall lookup succeed it calls onReady, and only then do we load the menu.
VendorAuth.initVendorGate({ onReady: () => { resetForm(); loadMenu(); } });
