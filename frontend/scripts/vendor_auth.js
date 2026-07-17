/* ===================================================================
   vendor_auth.js  (Kishore - Vendor Management)
   Shared by vendor.html, vendor_agreements.html, vendor_performance.html.

   Sign-in lives ONLY on Aswin's login.html. This file is the gate:
   it reads the token Aswin's auth.js saved, checks the role, asks the
   backend which stall the token owns, then opens the dashboard.

   Flow:
   1. Sign in on login.html -> auth.js saves localStorage["token"] and
      localStorage["user"].
   2. Vendor page loads -> this file reads THAT SAME token.
        - no token             -> bounce to login.html
        - token but not vendor -> bounce to home.html (wrong account)
        - vendor token         -> GET /api/vendors/stall, open dashboard.
   3. authFetch() sends Authorization: Bearer <token> on every vendor
      request, so the backend resolves stallId from the token. The page
      never picks a stall -> each vendor login only sees its own stall.

   The keys below ("token" / "user") MUST match Aswin's auth.js.
   =================================================================== */

(function () {
  // MUST match Aswin's auth.js  (localStorage.setItem("token", ...) / "user")
  const TOKEN_KEY = "token";
  const USER_KEY = "user";
  const LOGIN_PAGE = "login.html";
  const HOME_PAGE = "home.html";

  // ---- session helpers ----
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // fetch() that attaches the JWT. Everything vendor-side goes through this.
  function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(url, Object.assign({}, options, { headers }));
  }

  // ---- page elements (dashboard only) ----
  let els = {};
  let onReadyCb = null;

  function showDash() {
    if (els.dash) els.dash.hidden = false;
  }

  // Called by page scripts on 401/403 (token missing/expired).
  // Nothing to recover here - send them back to Aswin's login page.
  function showLogin(msg) {
    clearSession();
    if (msg) sessionStorage.setItem("vendorLoginMsg", msg);
    window.location.href = LOGIN_PAGE;
  }

  // Ask the backend which stall belongs to this token, then open the dashboard.
  async function loadStall() {
    try {
      const res = await authFetch("/api/vendors/stall");
      if (!res.ok) {
        showLogin("Please sign in with a vendor account.");
        return;
      }
      const stall = await res.json();
      if (els.stallName) els.stallName.textContent = stall.stallName || "Your stall";
      if (els.stallCenter) els.stallCenter.textContent =
        (stall.centerName || "") + (stall.location ? " \u00b7 " + stall.location : "");
      showDash();
      if (onReadyCb) onReadyCb(stall);
    } catch (e) {
      // backend unreachable - show it on the dash status line
      if (els.dash) els.dash.hidden = false;
      if (els.status) {
        els.status.textContent = "Couldn't reach the server. Is the backend running?";
        els.status.className = "vm-status err";
        els.status.hidden = false;
      }
    }
  }

  function doLogout() {
    clearSession();
    window.location.href = LOGIN_PAGE;
  }

  // Call this once per page. onReady(stall) runs after the gate passes.
  function initVendorGate(opts) {
    onReadyCb = opts && opts.onReady;
    els = {
      dash: document.getElementById("dash-section"),
      status: document.getElementById("status"),
      stallName: document.getElementById("stall-name"),
      stallCenter: document.getElementById("stall-center"),
    };
    if (els.btnLogout) els.btnLogout.addEventListener("click", doLogout);

    // ---- the gate ----
    const token = getToken();
    const user = getUser();

    if (!token) {
      window.location.href = LOGIN_PAGE;
      return;
    }
    if (!user || user.role !== "vendor") {
      alert("This area is for stall owner (vendor) accounts. Please sign in with a vendor login.");
      window.location.href = HOME_PAGE;
      return;
    }
    loadStall();
  }

  window.VendorAuth = { authFetch, initVendorGate, showLogin, getUser };
})();