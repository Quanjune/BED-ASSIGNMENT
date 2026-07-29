/* ===================================================================
   vendor_feedback.js  (Timely - Feedback, vendor side)
   Reviews of THIS stall, and the one thing a vendor can do about
   them: write a public reply.

   WHAT A VENDOR CAN AND CANNOT DO
     can    - read every review of their own stall
            - add, edit or remove THEIR OWN reply
     cannot - change the rating, edit the comment, or delete the
              review. Those are the customer's words; a stall that
              could rewrite them would make public reviews
              worthless. The backend enforces this by giving the
              reply its own endpoint (PUT /:id/reply) that only
              touches the reply columns - the handler that edits a
              review is author-or-admin only and a vendor can never
              reach it.

   The stallId comes from the vendor gate, which got it from the
   backend using the JWT - never from the URL.

   Endpoints:
     GET /api/feedback/stall/:stallId   (public read)
     PUT /api/feedback/:id/reply        (this stall's vendor, or admin)
                                        body: { vendorReply }
   =================================================================== */

(function () {
  const authFetch = window.VendorAuth.authFetch;

  const listEl = document.getElementById("review-list");
  const statusEl = document.getElementById("status");
  const filtersEl = document.getElementById("filters");
  const statRating = document.getElementById("stat-rating");
  const statTotal = document.getElementById("stat-total");
  const statUnanswered = document.getElementById("stat-unanswered");

  let myStallId = null;
  let allReviews = [];
  let currentFilter = "unanswered";   // unanswered | answered | all

  // Escape anything from the database before putting it in HTML.
  function esc(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = isError ? "vm-status err" : "vm-status ok";
    statusEl.hidden = false;
    if (!isError) setTimeout(() => { statusEl.hidden = true; }, 2500);
  }

  function fmtDate(value) {
    return value ? new Date(value).toLocaleDateString() : "";
  }

  function stars(n) {
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function hasReply(review) {
    return Boolean(review.vendorReply && review.vendorReply.trim());
  }

  // ---------- READ ----------
  async function loadReviews() {
    try {
      const res = await fetch(`/api/feedback/stall/${myStallId}`);
      if (!res.ok) throw new Error("bad response");
      allReviews = await res.json();

      statTotal.textContent = allReviews.length;
      statUnanswered.textContent = allReviews.filter((r) => !hasReply(r)).length;
      statRating.textContent = allReviews.length
        ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1)
        : "—";

      render();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "<p class='vm-empty'>Could not load reviews. Is the server running?</p>";
    }
  }

  function render() {
    const rows = allReviews.filter((r) => {
      if (currentFilter === "unanswered") return !hasReply(r);
      if (currentFilter === "answered") return hasReply(r);
      return true;
    });

    if (rows.length === 0) {
      const msg = currentFilter === "unanswered"
        ? "Every review has a reply. Nothing waiting."
        : currentFilter === "answered"
          ? "You haven't replied to anything yet."
          : "No reviews of your stall yet.";
      listEl.innerHTML = `<p class='vm-empty'>${msg}</p>`;
      return;
    }

    listEl.innerHTML = "";
    rows.forEach((r) => {
      const replied = hasReply(r);
      const row = document.createElement("div");
      row.className = "vm-item vm-complaint";
      row.innerHTML = `
        <div class="vm-promo-head">
          <span class="vm-stars">${stars(r.rating)}</span>
          <span class="vm-promo-meta">${esc(r.userName)} &middot; ${fmtDate(r.createdAt)}</span>
        </div>

        <p class="vm-review-comment">${r.comment ? esc(r.comment) : "<em>No comment left</em>"}</p>

        ${replied ? `
          <div class="vm-resolution">
            <p class="vm-resolution-label">Your reply &middot; ${fmtDate(r.vendorRepliedAt)}</p>
            <p class="vm-resolution-text">${esc(r.vendorReply)}</p>
          </div>
          <div class="vm-promo-actions vm-complaint-actions">
            <button class="vm-btn vm-btn-mini" data-edit="${r.feedbackId}">Edit reply</button>
            <button class="vm-btn vm-btn-mini vm-btn-ghost" data-remove="${r.feedbackId}">Remove reply</button>
          </div>
        ` : `
          <div class="vm-respond">
            <label class="vm-field">
              <span>Reply to this customer</span>
              <textarea id="reply-${r.feedbackId}" rows="3"
                        placeholder="e.g. Thanks for the feedback - we've added a second server at lunch."></textarea>
              <small class="vm-hint">Shown publicly under their review, so keep it courteous.</small>
            </label>
            <div class="vm-form-actions">
              <button class="vm-btn vm-btn-primary vm-btn-mini" data-save="${r.feedbackId}">Post reply</button>
            </div>
          </div>
        `}
      `;
      listEl.appendChild(row);
    });
  }

  // ---------- Filter chips ----------
  filtersEl.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter]");
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    filtersEl.querySelectorAll(".vm-chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    render();
  });

  // ---------- WRITE (event delegation, survives re-renders) ----------
  listEl.addEventListener("click", async (event) => {
    const saveId = event.target.dataset.save;
    const editId = event.target.dataset.edit;
    const removeId = event.target.dataset.remove;

    // Post or update a reply
    if (saveId) {
      const box = document.getElementById("reply-" + saveId);
      const reply = box ? box.value.trim() : "";
      if (!reply) {
        showStatus("Write something before posting a reply.", true);
        if (box) box.focus();
        return;
      }
      await send(saveId, reply, "Reply posted. Customers can see it now.");
      return;
    }

    // Clear a reply. Sending an empty string is how the API removes one.
    if (removeId) {
      if (!confirm("Remove your reply? The customer's review stays as it is.")) return;
      await send(removeId, "", "Reply removed.");
      return;
    }

    // Swap the saved reply back into an editable box, pre-filled
    if (editId) {
      const review = allReviews.find((r) => String(r.feedbackId) === String(editId));
      if (!review) return;
      const container = event.target.closest(".vm-item");
      const panel = container.querySelector(".vm-resolution");
      const actions = container.querySelector(".vm-complaint-actions");
      if (!panel) return;

      panel.outerHTML = `
        <div class="vm-respond">
          <label class="vm-field">
            <span>Update your reply</span>
            <textarea id="reply-${editId}" rows="3">${esc(review.vendorReply || "")}</textarea>
          </label>
          <div class="vm-form-actions">
            <button class="vm-btn vm-btn-primary vm-btn-mini" data-save="${editId}">Save reply</button>
            <button class="vm-btn vm-btn-ghost vm-btn-mini" data-cancel="1">Cancel</button>
          </div>
        </div>`;
      if (actions) actions.remove();
      return;
    }

    // Cancel an in-progress edit - redraw from data we already hold
    if (event.target.dataset.cancel) render();
  });

  // Shared PUT for post / edit / remove
  async function send(id, vendorReply, okMessage) {
    try {
      const res = await authFetch(`/api/feedback/${id}/reply`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorReply }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 403 here means the review belongs to another stall
        showStatus(result.error || "Could not save that reply.", true);
        return;
      }
      showStatus(okMessage, false);
      loadReviews();
    } catch (err) {
      console.error(err);
      showStatus("Could not reach the server.", true);
    }
  }

  // ---------- start ----------
  window.VendorAuth.initVendorGate({
    onReady: function (stall) {
      myStallId = stall.stallId;
      loadReviews();
    },
  });
})();