/* ===================================================================
   vendor_promotions.js  (Timely - Promotions)
   Promo code management for the signed-in stall owner.

   The page never sends a stallId. The BACKEND reads the vendor's stall
   from their token and (a) returns only that stall's codes, (b) stamps
   new codes with that stall, (c) refuses any edit/delete on a code that
   belongs to someone else. So a vendor can only ever touch their own.

   Endpoints used (all through VendorAuth.authFetch, which adds the JWT):
     GET    /api/promos              your stall's codes
     GET    /api/promos/:id          one code (for the edit form)
     POST   /api/promos              create
     PUT    /api/promos/:id          update
     DELETE /api/promos/:id          delete
     GET    /api/promos/validate/:code   read-only tester (public endpoint)
   =================================================================== */

(function () {
  const authFetch = window.VendorAuth.authFetch;

  // ---- elements ----
  const listEl = document.getElementById("promo-list");
  const statusEl = document.getElementById("status");
  const formTitle = document.getElementById("form-title");
  const editId = document.getElementById("edit-id");
  const inCode = document.getElementById("in-code");
  const inType = document.getElementById("in-type");
  const inValue = document.getElementById("in-value");
  const inExpiry = document.getElementById("in-expiry");
  const inLimit = document.getElementById("in-limit");
  const inActive = document.getElementById("in-active");
  const btnSave = document.getElementById("btn-save");
  const btnCancel = document.getElementById("btn-cancel");
  const validateInput = document.getElementById("validate-code");
  const btnValidate = document.getElementById("btn-validate");
  const validateResult = document.getElementById("validate-result");

  // Escape anything from the database before putting it into HTML.
  function esc(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = isError ? "vm-status err" : "vm-status ok";
    statusEl.hidden = false;
    // Clear the good-news messages after a moment; errors stay put.
    if (!isError) setTimeout(() => { statusEl.hidden = true; }, 2500);
  }

  // Money vs percentage, e.g. 5 -> "$5 off", 10 -> "10% off"
  function discountText(type, value) {
    const n = Number(value);
    return type === "percent" ? `${n}% off` : `$${n} off`;
  }

  // Work out the badge without asking the server. Mirrors the validate rules:
  // switched off first, then expired (valid through the expiry day), then
  // fully redeemed, else live.
  function promoState(promo) {
    if (!promo.isActive) return { label: "inactive", cls: "off" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(promo.expiryDate) < today) return { label: "expired", cls: "expired" };
    if (promo.timesUsed >= promo.usageLimit) return { label: "used up", cls: "expired" };
    return { label: "live", cls: "live" };
  }

  // ---------- READ ----------
  async function loadPromos() {
    try {
      const res = await authFetch("/api/promos");
      if (!res.ok) {
        listEl.innerHTML = "<p class='vm-empty'>Could not load your codes.</p>";
        return;
      }
      const promos = await res.json();

      if (promos.length === 0) {
        listEl.innerHTML = "<p class='vm-empty'>No codes yet. Create your first one on the left.</p>";
        return;
      }

      listEl.innerHTML = "";
      promos.forEach((promo) => {
        const state = promoState(promo);
        const expiry = new Date(promo.expiryDate).toLocaleDateString();
        const row = document.createElement("div");
        row.className = "vm-item vm-promo-item";
        row.innerHTML = `
          <div class="vm-promo-main">
            <div class="vm-promo-head">
              <strong>${esc(promo.code)}</strong>
              <span class="vm-badge ${state.cls}">${state.label}</span>
            </div>
            <p class="vm-promo-discount">${discountText(promo.discountType, promo.discountValue)}</p>
            <p class="vm-promo-meta">Expires ${expiry} &middot; used ${promo.timesUsed} of ${promo.usageLimit}</p>
          </div>
          <div class="vm-promo-actions">
            <button class="vm-btn vm-btn-mini" data-edit="${promo.promoId}">Edit</button>
            <button class="vm-btn vm-btn-mini vm-btn-danger" data-del="${promo.promoId}">Delete</button>
          </div>
        `;
        listEl.appendChild(row);
      });
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "<p class='vm-empty'>Could not reach the server.</p>";
    }
  }

  // ---------- CREATE / UPDATE ----------
  async function save() {
    // stallId is deliberately absent: the server stamps it from the token.
    const body = {
      code: inCode.value.trim(),
      discountType: inType.value,
      discountValue: parseFloat(inValue.value),
      expiryDate: inExpiry.value,
      usageLimit: parseInt(inLimit.value),
      isActive: inActive.checked,
    };

    // Cheap client-side checks so obvious mistakes don't need a round trip.
    if (!body.code) return showStatus("Code is required.", true);
    if (isNaN(body.discountValue) || body.discountValue <= 0) return showStatus("Value must be a positive number.", true);
    if (!body.expiryDate) return showStatus("Expiry date is required.", true);
    if (isNaN(body.usageLimit) || body.usageLimit < 1) return showStatus("Usage limit must be at least 1.", true);

    const id = editId.value;
    btnSave.disabled = true;
    try {
      const res = await authFetch(id ? `/api/promos/${id}` : "/api/promos", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Back-end messages: duplicate code, validation errors, ownership refusals
        showStatus(result.error || result.message || "Save failed.", true);
        return;
      }
      showStatus(id ? "Code updated." : "Code created.", false);
      resetForm();
      loadPromos();
    } catch (err) {
      console.error(err);
      showStatus("Could not reach the server.", true);
    } finally {
      btnSave.disabled = false;
    }
  }

  // ---------- EDIT / DELETE (event delegation on the list) ----------
  listEl.addEventListener("click", async (event) => {
    const editTarget = event.target.dataset.edit;
    const delTarget = event.target.dataset.del;

    if (editTarget) {
      try {
        const res = await authFetch(`/api/promos/${editTarget}`);
        if (!res.ok) {
          const r = await res.json().catch(() => ({}));
          showStatus(r.error || "Could not load that code.", true);
          return;
        }
        const promo = await res.json();

        inCode.value = promo.code;
        inType.value = promo.discountType;
        inValue.value = promo.discountValue;
        // <input type="date"> wants YYYY-MM-DD; the API sends an ISO datetime
        inExpiry.value = String(promo.expiryDate).slice(0, 10);
        inLimit.value = promo.usageLimit;
        inActive.checked = Boolean(promo.isActive);

        editId.value = promo.promoId;
        formTitle.textContent = "Edit code #" + promo.promoId;
        btnSave.textContent = "Save changes";
        btnCancel.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        console.error(err);
        showStatus("Could not reach the server.", true);
      }
    }

    if (delTarget) {
      if (!confirm("Delete this code? To keep it but switch it off, edit it and untick Active.")) return;
      try {
        const res = await authFetch(`/api/promos/${delTarget}`, { method: "DELETE" });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          showStatus(result.error || "Delete failed.", true);
          return;
        }
        showStatus("Code deleted.", false);
        // If we were editing the row we just removed, clear the form.
        if (editId.value === String(delTarget)) resetForm();
        loadPromos();
      } catch (err) {
        console.error(err);
        showStatus("Could not reach the server.", true);
      }
    }
  });

  // ---------- VALIDATE (read-only tester) ----------
  async function runValidate() {
    const code = validateInput.value.trim();
    if (!code) {
      renderValidate({ valid: false, message: "Type a code to check." });
      return;
    }
    try {
      // encodeURIComponent keeps odd characters safe inside the URL
      const res = await fetch(`/api/promos/validate/${encodeURIComponent(code)}`);
      renderValidate(await res.json());
    } catch (err) {
      console.error(err);
      renderValidate({ valid: false, message: "Could not reach the server." });
    }
  }

  // Show the verdict AND the raw JSON, so a demo can point at the exact
  // { valid, discountType, discountValue, message } contract the cart receives.
  function renderValidate(result) {
    validateResult.hidden = false;
    validateResult.className = "vm-validate-result " + (result.valid ? "valid" : "invalid");
    validateResult.innerHTML = `
      <p class="vm-validate-message">${result.valid ? "✓ " : "✗ "}${esc(result.message)}</p>
      <pre>${esc(JSON.stringify(result, null, 2))}</pre>
    `;
  }

  // ---------- helpers ----------
  function resetForm() {
    editId.value = "";
    inCode.value = "";
    inType.value = "fixed";
    inValue.value = "";
    inExpiry.value = "";
    inLimit.value = "";
    inActive.checked = true;
    formTitle.textContent = "Create a code";
    btnSave.textContent = "Save code";
    btnCancel.hidden = true;
  }

  btnSave.addEventListener("click", save);
  btnCancel.addEventListener("click", resetForm);
  btnValidate.addEventListener("click", runValidate);
  validateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runValidate(); });

  // ---------- start ----------
  // initVendorGate handles the token check and fills the "Your stall" header;
  // onReady fires once we know the session is good.
  window.VendorAuth.initVendorGate({
    onReady: function () {
      loadPromos();
    },
  });
})();