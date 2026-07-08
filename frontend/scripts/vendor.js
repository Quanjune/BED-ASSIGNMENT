/* ===================================================================
   Vendor Menu — talks to your backend at /api/vendors/menu
   (relative URL, so it works when the page is served by the backend
   at http://localhost:3000/vendor.html — same origin, no CORS).

   Endpoints:
     GET    /api/vendors/menu                 -> all items
     GET    /api/vendors/menu/stall/:stallId  -> items for one stall
     POST   /api/vendors/menu                 -> create (stallId, name, basePrice)
     PUT    /api/vendors/menu/:id             -> update
     DELETE /api/vendors/menu/:id             -> delete
   =================================================================== */

const API = "/api/vendors/menu";

const filterStall = document.getElementById("filter-stall");
const btnLoad     = document.getElementById("btn-load");
const btnLoadAll  = document.getElementById("btn-load-all");
const statusEl    = document.getElementById("status");

const editId    = document.getElementById("edit-id");
const inName     = document.getElementById("in-name");
const inStall    = document.getElementById("in-stall");
const inPrice    = document.getElementById("in-price");
const formTitle  = document.getElementById("form-title");
const btnSave    = document.getElementById("btn-save");
const btnCancel  = document.getElementById("btn-cancel");

const listEl = document.getElementById("menu-list");

// ---- helpers ------------------------------------------------------
function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "vm-status " + (type || "");
    statusEl.hidden = false;
}
function clearStatus() { statusEl.hidden = true; }

// SQL/model field casing can vary (id vs ProductID etc.) — read whatever exists.
function normalise(item) {
    return {
        id:    item.id ?? item.productId ?? item.ProductID ?? item.productID ?? item.ProductId,
        name:  item.name ?? item.Name ?? item.productName ?? item.ProductName,
        price: item.basePrice ?? item.BasePrice ?? item.price ?? item.Price,
        stall: item.stallId ?? item.StallID ?? item.stallID ?? item.StallId ?? item.foodStallId,
    };
}
function money(v) {
    const n = Number(v);
    return isNaN(n) ? "\u2014" : "S$" + n.toFixed(2);
}

// ---- load & render ------------------------------------------------
async function loadMenu(stallId) {
    clearStatus();
    listEl.innerHTML = '<p class="vm-empty">Loading\u2026</p>';
    const url = stallId ? `${API}/stall/${stallId}` : API;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showStatus(err.error || `Couldn't load menu (${res.status}).`, "err");
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
        listEl.innerHTML = '<p class="vm-empty">No dishes here yet. Add one on the left.</p>';
        return;
    }
    listEl.innerHTML = "";
    items.map(normalise).forEach((it) => {
        const row = document.createElement("div");
        row.className = "vm-item";
        row.innerHTML = `
            <div class="vm-info">
                <div class="vm-name"></div>
                <div class="vm-meta">Stall ${it.stall ?? "?"} \u00b7 ID ${it.id ?? "?"}</div>
            </div>
            <div class="vm-price">${money(it.price)}</div>
            <div class="vm-actions">
                <button class="vm-btn vm-btn-mini">Edit</button>
                <button class="vm-btn vm-btn-danger">Delete</button>
            </div>`;
        row.querySelector(".vm-name").textContent = it.name ?? "(unnamed)";
        row.querySelector(".vm-btn-mini").addEventListener("click", () => startEdit(it));
        row.querySelector(".vm-btn-danger").addEventListener("click", () => remove(it));
        listEl.appendChild(row);
    });
}

// ---- add / edit ---------------------------------------------------
function startEdit(it) {
    editId.value  = it.id ?? "";
    inName.value  = it.name ?? "";
    inStall.value = it.stall ?? "";
    inPrice.value = it.price ?? "";
    formTitle.textContent = "Edit dish";
    btnSave.textContent = "Update dish";
    btnCancel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
    editId.value = "";
    inName.value = inStall.value = inPrice.value = "";
    formTitle.textContent = "Add a dish";
    btnSave.textContent = "Save dish";
    btnCancel.hidden = true;
}

async function save() {
    clearStatus();
    const name  = inName.value.trim();
    const stall = inStall.value.trim();
    const price = inPrice.value.trim();

    if (!name || !stall || price === "") {
        showStatus("Name, Stall ID and Base price are all required.", "err");
        return;
    }

    const payload = {
        name,
        stallId: Number(stall),
        basePrice: Number(price),
        // Want description/category too? Add it here AND in the form —
        // just make sure your Joi validator allows the extra field.
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
        showStatus(editing ? "Dish updated." : "Dish added.", "ok");
        resetForm();
        const f = filterStall.value.trim();
        loadMenu(f || undefined);
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

async function remove(it) {
    if (!confirm(`Delete "${it.name}"? This can't be undone.`)) return;
    clearStatus();
    try {
        const res = await fetch(`${API}/${it.id}`, { method: "DELETE" });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showStatus(err.error || `Delete failed (${res.status}).`, "err");
            return;
        }
        showStatus("Dish deleted.", "ok");
        const f = filterStall.value.trim();
        loadMenu(f || undefined);
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

// ---- wire up ------------------------------------------------------
btnLoad.addEventListener("click", () => {
    const f = filterStall.value.trim();
    if (!f) { showStatus("Type a Stall ID first, or hit \u201cShow all items\u201d.", "err"); return; }
    loadMenu(f);
});
btnLoadAll.addEventListener("click", () => { filterStall.value = ""; loadMenu(); });
btnSave.addEventListener("click", save);
btnCancel.addEventListener("click", resetForm);

loadMenu();  // load everything on first open