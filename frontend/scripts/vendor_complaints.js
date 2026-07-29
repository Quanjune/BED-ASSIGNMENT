/* ===================================================================
   vendor_complaints.js  (Timely - Complaints, vendor side)
   Complaints filed against THIS stall, and the one action a vendor
   has: marking them resolved.

   WHAT A VENDOR CAN AND CANNOT DO
     can    - read every complaint about their own stall
            - mark one Resolved once they've dealt with it
            - re-open one they closed too early
     cannot - edit or delete a complaint. It is the customer's
              account of what happened; letting the stall rewrite or
              erase it would make the whole feature worthless.
              The backend enforces this too (DELETE is author-or-admin
              only) - the UI simply doesn't offer it.

   The stallId is never typed in or guessed: the vendor gate gets it
   from the backend using the JWT, so one vendor can never read
   another stall's complaints by editing a URL.

   Endpoints:
     GET /api/complaints/stall/:stallId   (public read)
     PUT /api/complaints/:id              (stall's own vendor, or admin)
                                          body: { status }
   =================================================================== */

(function () {
  const authFetch = window.VendorAuth.authFetch;

  const listEl = document.getElementById("complaint-list");
  const statusEl = document.getElementById("status");
  const filtersEl = document.getElementById("filters");
  const statOpen = document.getElementById("stat-open");
  const statResolved = document.getElementById("stat-resolved");
  const statTotal = document.getElementById("stat-total");

  let myStallId = null;
  let allComplaints = [];
  let currentFilter = "open";   // open | resolved | all

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

  // ---------- READ ----------
  async function loadComplaints() {
    try {
      const res = await fetch(`/api/complaints/stall/${myStallId}`);
      if (!res.ok) throw new Error("bad response");
      allComplaints = await res.json();

      const open = allComplaints.filter((c) => c.status !== "Resolved").length;
      statOpen.textContent = open;
      statResolved.textContent = allComplaints.length - open;
      statTotal.textContent = allComplaints.length;

      render();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "<p class='vm-empty'>Could not load complaints. Is the server running?</p>";
    }
  }

  function render() {
    const rows = allComplaints.filter((c) => {
      if (currentFilter === "open") return c.status !== "Resolved";
      if (currentFilter === "resolved") return c.status === "Resolved";
      return true;
    });

    if (rows.length === 0) {
      const msg = currentFilter === "open"
        ? "No open complaints. Nothing needs your attention."
        : currentFilter === "resolved"
          ? "Nothing resolved yet."
          : "No complaints have been filed against your stall.";
      listEl.innerHTML = `<p class='vm-empty'>${msg}</p>`;
      return;
    }

    listEl.innerHTML = "";
    rows.forEach((c) => {
      const resolved = c.status === "Resolved";
      const row = document.createElement("div");
      row.className = "vm-item vm-complaint";
      row.innerHTML = `
        <div class="vm-promo-head">
          <strong>${esc(c.category || "General")}</strong>
          <span class="vm-badge ${resolved ? "live" : "expired"}">${esc(c.status)}</span>
        </div>

        <p class="vm-review-comment">${esc(c.description)}</p>
        <p class="vm-promo-meta">Filed by ${esc(c.userName)} on ${fmtDate(c.createdAt)}</p>

        <div class="vm-promo-actions vm-complaint-actions">
          ${resolved
            ? `<button class="vm-btn vm-btn-mini vm-btn-ghost" data-reopen="${c.complaintId}">Re-open</button>`
            : `<button class="vm-btn vm-btn-mini vm-btn-primary" data-resolve="${c.complaintId}">Mark resolved</button>`}
        </div>
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
    const resolveId = event.target.dataset.resolve;
    const reopenId = event.target.dataset.reopen;

    if (resolveId) {
      await send(resolveId, "Resolved", "Complaint marked as resolved.");
      return;
    }

    if (reopenId) {
      if (!confirm("Re-open this complaint?")) return;
      await send(reopenId, "Open", "Complaint re-opened.");
    }
  });

  // Shared PUT for resolve / re-open
  async function send(id, status, okMessage) {
    try {
      const res = await authFetch(`/api/complaints/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 403 here means the complaint belongs to another stall
        showStatus(result.error || "Could not update that complaint.", true);
        return;
      }
      showStatus(okMessage, false);
      loadComplaints();
    } catch (err) {
      console.error(err);
      showStatus("Could not reach the server.", true);
    }
  }

  // ---------- start ----------
  window.VendorAuth.initVendorGate({
    onReady: function (stall) {
      myStallId = stall.stallId;
      loadComplaints();
    },
  });
})();