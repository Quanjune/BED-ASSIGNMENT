/* ===================================================================
   vendor_auth.js  (Kishore - Vendor Management)
   Shared by vendor.html and vendor_agreements.html.

   What it does:
   1. Shows a small "Vendor sign in" card until you log in.
   2. Calls Aswin's  POST /api/auth/login  and keeps the JWT in
      sessionStorage (cleared when the tab closes).
   3. After login it asks the backend "whose stall am I?"
      (GET /api/vendors/stall) and fills the "Your stall" header.
   4. Exposes authFetch() - fetch that automatically sends the token
      as  Authorization: Bearer <token>  - used by every page script.

   The page never picks a stall. The BACKEND decides which stall you
   own from your token, so each of the 16 vendor logins only ever sees
   and edits their own stall.
   =================================================================== */

(function () {
  const TOKEN_KEY = "hawkerToken";
  const USER_KEY = "hawkerUser";

  // ---- session storage helpers ----
  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  }
  function saveSession(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  // fetch() that attaches the JWT. Everything vendor-side goes through this.
  function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(url, Object.assign({}, options, { headers }));
  }

  // ---- gate wiring (login card <-> dashboard) ----
  let els = {};
  let onReadyCb = null;

  function showLogin(msg) {
    if (els.login) els.login.hidden = false;
    if (els.dash) els.dash.hidden = true;
    if (msg && els.loginStatus) {
      els.loginStatus.textContent = msg;
      els.loginStatus.className = "vm-status err";
      els.loginStatus.hidden = false;
    }
  }
  function showDash() {
    if (els.login) els.login.hidden = true;
    if (els.dash) els.dash.hidden = false;
  }

  // Ask the backend which stall belongs to this token, then open the dashboard.
  async function loadStall() {
    try {
      const res = await authFetch("/api/vendors/stall");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        clearSession();
        showLogin(err.error || err.message || "Please sign in with a vendor account.");
        return;
      }
      const stall = await res.json();
      if (els.stallName) els.stallName.textContent = stall.stallName || "Your stall";
      if (els.stallCenter) els.stallCenter.textContent =
        (stall.centerName || "") + (stall.location ? " \u00b7 " + stall.location : "");
      showDash();
      if (onReadyCb) onReadyCb(stall);
    } catch (e) {
      showLogin("Couldn't reach the server. Is the backend running?");
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
      saveSession(data.accessToken, data.user);
      els.password.value = "";
      if (els.loginStatus) els.loginStatus.hidden = true;
      await loadStall();
    } catch (e) {
      showLogin("Couldn't reach the server. Is the backend running?");
    } finally {
      els.btnLogin.disabled = false;
    }
  }

  function doLogout() {
    clearSession();
    showLogin();
  }

  // Call this once per page. onReady(stall) runs after a successful gate.
  function initVendorGate(opts) {
    onReadyCb = opts && opts.onReady;
    els = {
      login: document.getElementById("login-section"),
      dash: document.getElementById("dash-section"),
      email: document.getElementById("login-email"),
      password: document.getElementById("login-password"),
      btnLogin: document.getElementById("btn-login"),
      loginStatus: document.getElementById("login-status"),
      btnLogout: document.getElementById("btn-logout"),
      stallName: document.getElementById("stall-name"),
      stallCenter: document.getElementById("stall-center"),
    };
    if (els.btnLogin) els.btnLogin.addEventListener("click", doLogin);
    if (els.password) els.password.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    if (els.btnLogout) els.btnLogout.addEventListener("click", doLogout);

    if (getToken()) loadStall();   // already signed in this tab? skip the form
    else showLogin();
  }

  // shared entry points for the page scripts
  window.VendorAuth = { authFetch, initVendorGate, showLogin, getUser };
})();
