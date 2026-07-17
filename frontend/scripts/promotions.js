// Talks to the back-end REST API:
//   GET/POST      /api/promos
//   GET/PUT/DELETE /api/promos/:id
//   GET           /api/promos/validate/:code   (read-only check the cart uses)

const form = document.getElementById("promo-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const formMessage = document.getElementById("form-message");
const listDiv = document.getElementById("promo-list");

const validateInput = document.getElementById("validate-code");
const validateBtn = document.getElementById("validate-btn");
const validateResult = document.getElementById("validate-result");

let editingId = null; // null = creating new; a number = editing that promoId

// Escape user-entered text so it cannot inject HTML into the page
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Turn a stored discount into readable text: 5 -> "$5 off", 10 -> "10% off"
function discountText(type, value) {
    return type === "percent" ? `${value}% off` : `$${value} off`;
}

// Work out a display status without asking the server. Mirrors the validate
// rules: off first, then expired (valid through the expiry day), else active.
function promoStatus(promo) {
    if (!promo.isActive) return "inactive";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(promo.expiryDate) < today) return "expired";
    return "active";
}

// ---------- READ: load and display all promo codes ----------
async function loadPromos() {
    try {
        const response = await fetch("/api/promos");
        if (!response.ok) throw new Error("Server returned " + response.status);
        const promos = await response.json();

        if (promos.length === 0) {
            listDiv.innerHTML = "<p class='empty'>No codes yet. Create your first one above.</p>";
            return;
        }

        listDiv.innerHTML = "";
        promos.forEach((promo) => {
            const status = promoStatus(promo);
            const expiry = new Date(promo.expiryDate).toLocaleDateString();

            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="promo-head">
                    <strong>${escapeHtml(promo.code)}</strong>
                    <span class="badge ${status}">${status}</span>
                </div>
                <p class="promo-discount">${discountText(promo.discountType, promo.discountValue)}</p>
                <p class="promo-meta">Expires ${expiry}</p>
                <p class="promo-meta">Used ${promo.timesUsed} of ${promo.usageLimit}</p>
                <div class="card-actions">
                    <button data-id="${promo.promoId}" class="edit-btn secondary">Edit</button>
                    <button data-id="${promo.promoId}" class="delete-btn">Delete</button>
                </div>
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        listDiv.innerHTML = "<p class='error-box'>Could not load codes. Is the server running?</p>";
    }
}

// ---------- CREATE or UPDATE: submit the form ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // stop the browser's default page reload

    // The back-end validates + cleans too; this is just the request body.
    const body = {
        code: document.getElementById("code").value.trim(),
        discountType: document.getElementById("discountType").value,
        discountValue: parseFloat(document.getElementById("discountValue").value),
        expiryDate: document.getElementById("expiryDate").value,
        usageLimit: parseInt(document.getElementById("usageLimit").value),
        isActive: document.getElementById("isActive").checked,
    };

    try {
        let response;
        if (editingId === null) {
            // CREATE -> POST /api/promos
            response = await fetch("/api/promos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        } else {
            // UPDATE -> PUT /api/promos/:id (back-end does a full update)
            response = await fetch(`/api/promos/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        }

        const result = await response.json();
        if (!response.ok) {
            // shows back-end messages, e.g. "A promo with this code already exists"
            // or a validation message + field from the middleware
            showMessage(result.error || result.message || "Something went wrong", true);
            return;
        }

        showMessage(editingId === null ? "Code created." : "Code updated.", false);
        resetForm();
        loadPromos(); // refresh the list so the change shows immediately
    } catch (error) {
        console.error(error);
        showMessage("Could not reach the server.", true);
    }
});

// ---------- EDIT / DELETE buttons (event delegation on the list) ----------
listDiv.addEventListener("click", async (event) => {
    const id = event.target.dataset.id;
    if (!id) return; // click was not on an Edit/Delete button

    // DELETE -> DELETE /api/promos/:id
    if (event.target.classList.contains("delete-btn")) {
        if (!confirm("Delete this code? To keep it but switch it off, edit it and untick Active.")) return;
        try {
            const response = await fetch(`/api/promos/${id}`, { method: "DELETE" });
            const result = await response.json();
            if (!response.ok) {
                showMessage(result.error || "Delete failed", true);
                return;
            }
            showMessage("Code deleted.", false);
            loadPromos();
        } catch (error) {
            console.error(error);
            showMessage("Could not reach the server.", true);
        }
    }

    // EDIT -> fetch the single row and load its values into the form
    if (event.target.classList.contains("edit-btn")) {
        try {
            const response = await fetch(`/api/promos/${id}`);
            if (!response.ok) throw new Error("Not found");
            const promo = await response.json();

            document.getElementById("code").value = promo.code;
            document.getElementById("discountType").value = promo.discountType;
            document.getElementById("discountValue").value = promo.discountValue;
            // date input wants YYYY-MM-DD; the API sends an ISO datetime, so slice it
            document.getElementById("expiryDate").value = String(promo.expiryDate).slice(0, 10);
            document.getElementById("usageLimit").value = promo.usageLimit;
            document.getElementById("isActive").checked = promo.isActive;

            editingId = promo.promoId;
            formTitle.textContent = "Edit Code #" + promo.promoId;
            submitBtn.textContent = "Save Changes";
            cancelEditBtn.classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error(error);
            showMessage("Could not load that code for editing.", true);
        }
    }
});

// ---------- VALIDATE: the read-only check the cart will call ----------
validateBtn.addEventListener("click", async () => {
    const code = validateInput.value.trim();
    if (!code) {
        showValidateResult({ valid: false, message: "Type a code to check." });
        return;
    }
    try {
        // encodeURIComponent keeps odd characters safe inside the URL
        const response = await fetch(`/api/promos/validate/${encodeURIComponent(code)}`);
        const result = await response.json();
        showValidateResult(result);
    } catch (error) {
        console.error(error);
        showValidateResult({ valid: false, message: "Could not reach the server." });
    }
});

// Show the result AND the raw JSON, so a demo can point at the exact
// { valid, discountType, discountValue, message } contract the cart receives.
function showValidateResult(result) {
    validateResult.classList.remove("hidden", "valid", "invalid");
    validateResult.classList.add(result.valid ? "valid" : "invalid");
    validateResult.innerHTML = `
        <p class="result-message">${result.valid ? "✓ " : "✗ "}${escapeHtml(result.message)}</p>
        <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
    `;
}

// ---------- Helpers ----------
function resetForm() {
    form.reset();
    editingId = null;
    formTitle.textContent = "Create Code";
    submitBtn.textContent = "Create Code";
    cancelEditBtn.classList.add("hidden");
    document.getElementById("isActive").checked = true; // form.reset() would untick it
}

cancelEditBtn.addEventListener("click", resetForm);

function showMessage(text, isError) {
    formMessage.textContent = text;
    formMessage.className = isError ? "error" : "success";
}

// Initial load when the page opens
loadPromos();