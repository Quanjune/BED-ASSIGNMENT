/* ===================================================================
   officer_auth.js  (Kaden - NEA officer portal)

   Shared by officer.html, officer_schedule.html and officer_grades.html,
   the same way Kishore's vendor_auth.js is shared by the vendor pages.

   Login itself is handled centrally by Aswin's login.html + auth.js, which
   stores the session in localStorage ("token" + "user"). Timely's
   sessions.js already knows how to read that, so this file builds on top of
   it rather than reading localStorage again - one place to change if the
   session ever moves.

   LOAD ORDER on every officer page:
       sessions.js  ->  officer_auth.js  ->  the page's own script

   =================================================================== */

(function () {
  const API_BASE = "/api";

  // ---------------------------------------------------------------
  // Gate: this must run before a page draws anything.
  // ---------------------------------------------------------------
  // Note this is a CONVENIENCE, not the security itself. The real check is
  // on the server (requireOfficer on every write route). Hiding the page
  // just stops an officer-less user from seeing a screen full of failed
  // requests - someone editing this file still cannot change any data.
  function requireOfficer() {
    if (!window.Session) {
      console.error("sessions.js must be loaded before officer_auth.js");
      return false;
    }
    if (!Session.isLoggedIn()) {
      Session.goLogin();
      return false;
    }
    if (!Session.isRole("officer")) {
      alert("This area is for NEA officers only.");
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // fetch wrapper
  // ---------------------------------------------------------------
  // Turns the two different error shapes used across the back end into one
  // readable message:
  //   Kishore's validate() replies  { error, details: [ ... ] }
  //   the controllers reply         { message }
  async function api(path, options = {}) {
    const res = await fetch(API_BASE + path, {
      headers: Session.jsonHeaders(),
      ...options,
    });

    // Expired or missing token -> sessions.js clears it and sends the user
    // back to login, returning here afterwards.
    if (Session.handleAuthFailure(res)) {
      throw new Error("Your session has expired.");
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const details = Array.isArray(data.details) ? data.details.join(" ") : null;
      throw new Error(data.message || details || `Request failed (${res.status}).`);
    }
    return data;
  }

  // ---------------------------------------------------------------
  // Display helpers - kept here so all three pages format things the same
  // ---------------------------------------------------------------
  function formatDate(value) {
    if (!value) return "&mdash;";
    return new Date(value).toLocaleDateString("en-SG", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  // "YYYY-MM-DD" for <input type="date"> and for sending to the API.
  function toInputDate(value) {
    if (!value) return "";
    return new Date(value).toISOString().slice(0, 10);
  }

  function todayInput() {
    return new Date().toISOString().slice(0, 10);
  }

  function gradeBadge(grade) {
    if (!grade) return `<span class="grade-badge grade-none">&ndash;</span>`;
    return `<span class="grade-badge grade-${grade.toLowerCase()}">${grade}</span>`;
  }

  function statusBadge(status) {
    return `<span class="badge badge-${status.toLowerCase()}">${status}</span>`;
  }

  function priorityBadge(priority, reason) {
    return `<span class="badge badge-priority-${priority}">${reason}</span>`;
  }

  function toast(el, message, isSuccess) {
    if (!el) return;
    el.textContent = message;
    el.className = `feedback feedback-${isSuccess ? "success" : "error"}`;
    el.hidden = false;
  }

  // Escape anything that came from the database before putting it in HTML.
  // Remarks are free text typed by an officer, so this matters.
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.Officer = {
    requireOfficer,
    api,
    formatDate,
    toInputDate,
    todayInput,
    gradeBadge,
    statusBadge,
    priorityBadge,
    toast,
    escapeHtml,
  };
})();
