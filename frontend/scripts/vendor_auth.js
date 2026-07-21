/* ===================================================================
   vendor_auth.js  (Kishore - Vendor Management)
   Shared by vendor.html, vendor_agreements.html, vendor_performance.html.

   NOTE: login is handled centrally by Aswin's login.html + auth.js.

   What it does:
   1. Reads the JWT that login.html saved in sessionStorage. If there is
      no token, it redirects to login.html instead of showing a form.
   2. Asks the backend "whose stall am I?" (GET /api/vendors/stall) and
      fills the "Your stall" header. A bad/expired token -> back to login.
   3. Exposes authFetch() - fetch that automatically sends the token as
      Authorization: Bearer <token> - used by every vendor page script.

   The page never picks a stall. The BACKEND decides which stall you
   own from your token, so each vendor only ever sees and edits their
   own stall.
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
        // The no-stall case is now caught by login.html before a vendor ever reaches this page, so this just sends bad/expired sessions back to the central login.
        clearSession();
        window.location.href = "login.html";
        return;
      }
      const stall = await res.json();
      if (els.stallName) els.stallName.textContent = stall.stallName || "Your stall";
      if (els.stallCenter) els.stallCenter.textContent =
        (stall.centerName || "") + (stall.location ? " \u00b7 " + stall.location : "");
      showDash();
      if (onReadyCb) onReadyCb(stall);
    } catch (e) {
      alert("Couldn't reach the server. Is the backend running?");
    }
  }

  async function doLogin() {
    const email = els.email.value.trim();
    const password = els.password.value;
    if (!email || !password) { showLogin("Email and password are both required."); return; }

    els.btnLogin.disabled = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showLogin(data.message || "Login failed."); return; }

      if (!data.user || data.user.role !== "vendor") {
        showLogin("That account isn't a vendor account. Sign in with a stall owner login.");
        return;
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

    if (getToken()) loadStall();                 // signed in via login.html -> load dashboard
    else window.location.href = "login.html";    // not logged in -> central login page 
  }

  window.VendorAuth = { authFetch, initVendorGate, showLogin, getUser };
})();