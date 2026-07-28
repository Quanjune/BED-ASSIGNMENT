/* ===================================================================
   session.js  (Timely - shared)
   One small helper so the customer-facing pages all read the login
   state the same way, instead of each script re-implementing it.

   WHERE THE TOKEN LIVES
   login.html / auth.js stores the customer session in localStorage
   ("token" + "user"). The vendor pages use a SEPARATE sessionStorage
   session ("hawkerToken") handled by vendor_auth.js - don't mix them.
   A vendor who signs in through login.html gets both, which is fine:
   on the public pages they simply count as a logged-in user.

   USAGE
     Session.isLoggedIn()            -> true / false
     Session.getUser()               -> { userId, name, email, role } | null
     Session.isRole("vendor")        -> true / false
     Session.authHeaders()           -> {} or { Authorization: "Bearer ..." }
     Session.goLogin("complaints.html?stallId=3")  -> redirect to login
   Include with:  <script src="./scripts/session.js"></script>
   BEFORE the page script that uses it.
   =================================================================== */

(function () {
  const TOKEN_KEY = "token";
  const USER_KEY = "user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;   // corrupted entry - treat as logged out
    }
  }

  function isLoggedIn() {
    return Boolean(getToken());
  }

  function isRole(role) {
    const user = getUser();
    return Boolean(user && user.role === role);
  }

  // Spread into a fetch's headers. Returns an empty object when logged out,
  // so the same call works for guests on public endpoints.
  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  // Convenience for POST/PUT bodies: JSON content-type + the token.
  function jsonHeaders() {
    return Object.assign({ "Content-Type": "application/json" }, authHeaders());
  }

  // Send the user to login, remembering where they wanted to go.
  // auth.js reads ?next= after a successful sign-in and returns them here.
  function goLogin(returnTo) {
    const target = returnTo || (window.location.pathname.split("/").pop() + window.location.search);
    window.location.href = "login.html?next=" + encodeURIComponent(target);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  window.Session = { getToken, getUser, isLoggedIn, isRole, authHeaders, jsonHeaders, goLogin, logout };
})();