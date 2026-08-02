/* ===================================================================
   vendor_auth.js  (Kishore - Vendor Management)
   Shared by vendor.html and vendor_agreements.html.

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

  // ---- hygiene grade badge (data from Kaden's grading module) ----
  //
  // GET /api/hygiene-grades/stall/:stallId is a PUBLIC endpoint - a hygiene
  // grade is public information - so this one call deliberately uses plain
  // fetch() rather than authFetch(). It still only ever runs with the stallId
  // the gate resolved from the token, so a vendor only sees their own grade.
  //
  // The grade is a nice-to-have on top of the dashboard: if the request fails
  // the panel simply stays hidden and the rest of the page carries on.
  function formatGradeDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-SG", {
      year: "numeric", month: "short", day: "numeric"
    });
  }

  async function loadGrade(stallId) {
    if (!stallId || !els.grade || !els.gradeLetter || !els.gradeNote) return;
    try {
      const res = await fetch("/api/hygiene-grades/stall/" + stallId);
      if (!res.ok) return;
      const data = await res.json();

      // currentGrade is null the moment a grade lapses, so fall back to the
      // newest row on record (grades[] is already sorted newest-first) and
      // label it as expired instead of pretending the stall has no grade.
      const current = data.currentGrade;
      const latest = current || (data.grades && data.grades[0]) || null;

      els.grade.classList.remove("vm-grade-warn");

      if (!latest) {
        els.gradeLetter.textContent = "–";              // en dash
        els.gradeLetter.className = "vm-grade-letter vm-grade-none";
        els.gradeNote.textContent = "Not inspected yet";
      } else {
        els.gradeLetter.textContent = latest.grade;
        els.gradeLetter.className =
          "vm-grade-letter vm-grade-" + String(latest.grade).toLowerCase();

        if (!current) {
          els.gradeNote.textContent =
            "Expired " + formatGradeDate(latest.validTo) + " · awaiting re-inspection";
          els.grade.classList.add("vm-grade-warn");
        } else if (latest.daysUntilExpiry <= 30) {
          // Worth shouting about: the vendor needs to book a re-inspection.
          els.gradeNote.textContent =
            "Expires in " + latest.daysUntilExpiry + " day" +
            (latest.daysUntilExpiry === 1 ? "" : "s") +
            " · " + formatGradeDate(latest.validTo);
          els.grade.classList.add("vm-grade-warn");
        } else {
          els.gradeNote.textContent = "Valid until " + formatGradeDate(latest.validTo);
        }
      }

      els.grade.hidden = false;
    } catch (e) {
      /* leave the panel hidden - never block the dashboard over a badge */
    }
  }

  // Ask the backend which stall belongs to this token, then open the dashboard.
  async function loadStall() {
    try {
      const res = await authFetch("/api/vendors/stall");
      if (!res.ok) {
        // A vendor with no stall is already stopped by login.html, so by the
        // time we get here the only realistic cause is a bad or expired
        // token. Nothing on this page can fix that - drop the dead session
        // and send them back to the central login.
        clearSession();
        window.location.href = "login.html";
        return;
      }
      const stall = await res.json();
      if (els.stallName) els.stallName.textContent = stall.stallName || "My stall";
      if (els.stallCenter) els.stallCenter.textContent =
        (stall.centerName || "") + (stall.location ? " \u00b7 " + stall.location : "");
      // Optional stall photo beside the name (hidden until it actually loads).
      if (els.stallPhoto) {
        if (stall.imagePath) {
          els.stallPhoto.src = stall.imagePath;
          els.stallPhoto.alt = stall.stallName || "";
          els.stallPhoto.hidden = false;
          els.stallPhoto.onerror = () => { els.stallPhoto.hidden = true; };
        } else {
          els.stallPhoto.hidden = true;
        }
      }
      showDash();
      // Not awaited: the menu should not sit waiting on the grade lookup.
      loadGrade(stall.stallId);
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
      stallPhoto: document.getElementById("stall-photo"),
      // Hygiene grade panel. Only vendor.html carries this markup for now,
      // so loadGrade() no-ops on the other vendor pages.
      grade: document.getElementById("stall-grade"),
      gradeLetter: document.getElementById("stall-grade-letter"),
      gradeNote: document.getElementById("stall-grade-note"),
    };
    if (els.btnLogin) els.btnLogin.addEventListener("click", doLogin);
    if (els.password) els.password.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    if (els.btnLogout) els.btnLogout.addEventListener("click", doLogout);

    if (getToken()) loadStall();                 // signed in via login.html -> load dashboard
    else window.location.href = "login.html";    // not logged in -> central login page 
  }

  // shared entry points for the page scripts
  window.VendorAuth = { authFetch, initVendorGate, showLogin, getUser };
})();