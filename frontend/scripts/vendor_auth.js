/* ===================================================================
   vendor_auth.js  (Kishore - Vendor Management)
   Shared by vendor.html and vendor_agreements.html.

   CHANGED: this now uses Aswin's login page (login.html) as the ONE
   and only sign-in. It no longer shows its own login card.

   How it fits together:
   1. You sign in on Aswin's login.html with your email + password.
      Aswin's auth.js saves the JWT in  localStorage["token"]  and the
      user in  localStorage["user"].
   2. When a vendor page loads, this file reads THAT SAME token.
        - no token             -> bounce to login.html
        - token but not vendor -> bounce to home.html (wrong account)
        - vendor token         -> ask the backend "whose stall am I?"
                                  (GET /api/vendors/stall) and open the
                                  dashboard.
   3. authFetch() sends the token as  Authorization: Bearer <token>  on
      every vendor request, so the backend resolves your stallId from
      the token. The page never picks a stall -> each of the 16 vendor
      logins only ever sees and edits their own stall.

   NOTE: the keys below ("token" / "user") and localStorage MUST match
   what Aswin's auth.js writes. That is the whole point of the fix - the
   old version read sessionStorage["hawkerToken"], which Aswin never set,
   so the two login systems could never see each other.
   =================================================================== */

(function () {
  // MUST match Aswin's auth.js  (localStorage.setItem("token", ...) / "user")
  const TOKEN_KEY = "token";
  const USER_KEY = "user";
  const LOGIN_PAGE = "login.html";
  const HOME_PAGE = "home.html";

  // ---- session helpers (localStorage = stays signed in like the rest of the site) ----
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

  // ---- page elements (dashboard header only - no inline login card anymore) ----
  let els = {};
  let onReadyCb = null;

  function showDash() {
    if (els.login) els.login.hidden = true;   // hide the leftover login card if the page still has one
    if (els.dash) els.dash.hidden = false;
  }

  // Called by page scripts when a request comes back 401/403 (token missing/expired).
  // We can't recover here, so send them back to Aswin's login page.
  function showLogin(msg) {
    clearSession();
    if (msg) sessionStorage.setItem("vendorLoginMsg", msg); // optional: login.html could read this
    window.location.href = LOGIN_PAGE;
  }

  // Ask the backend which stall belongs to this token, then open the dashboard.
  async function loadStall() {
    try {
      const res = await authFetch("/api/vendors/stall");
      if (!res.ok) {
        // 401/403 = bad/expired token -> back to login
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
      // backend unreachable - show it on the dash status line if we have one
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
      login: document.getElementById("login-section"),   // leftover card - just hidden
      dash: document.getElementById("dash-section"),
      status: document.getElementById("status"),
      btnLogout: document.getElementById("btn-logout"),
      stallName: document.getElementById("stall-name"),
      stallCenter: document.getElementById("stall-center"),
    };
    if (els.btnLogout) els.btnLogout.addEventListener("click", doLogout);

    // ---- the gate ----
    const token = getToken();
    const user = getUser();

    if (!token) {
      // not signed in at all -> Aswin's login page
      window.location.href = LOGIN_PAGE;
      return;
    }
    if (!user || user.role !== "vendor") {
      // signed in, but as a customer/admin -> this area isn't for them
      alert("This area is for stall owner (vendor) accounts. Please sign in with a vendor login.");
      window.location.href = HOME_PAGE;
      return;
    }
    // vendor token present -> confirm the stall and open the dashboard
    loadStall();
  }

  // shared entry points for the page scripts (unchanged interface)
  window.VendorAuth = { authFetch, initVendorGate, showLogin, getUser };
})();