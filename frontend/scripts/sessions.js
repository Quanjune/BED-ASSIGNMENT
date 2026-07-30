/* ===================================================================
   session.js  (Timely - shared)
   One small helper so the customer-facing pages all read the login
   state the same way, instead of each script re-implementing it.

   complaints.html, feedback.html and stalls.html all load this file
   BEFORE their own script. Without it, those pages fall back to a
   guest view and their write actions fail - which is the 404 you saw.

   WHERE THE TOKEN LIVES
   login.html / auth.js stores the customer session in localStorage
   ("token" + "user"). The vendor pages use a SEPARATE sessionStorage
   session ("hawkerToken") handled by vendor_auth.js - don't mix them.

   ABOUT EXPIRY
   The backend signs tokens with { expiresIn: '1h' } and there is no
   refresh flow, so after an hour every write fails with 403
   "Invalid or expired token." A token also stops working if
   ACCESS_TOKEN_SECRET changes. isLoggedIn() therefore reads the
   token's own `exp` claim and treats an expired one as signed out,
   so the UI never shows a form that is guaranteed to fail on submit.
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

  // Read the middle segment of the JWT. NOT verification - the signature is
  // checked on the server. We only want the `exp` claim so the page can tell
  // "signed in" from "holding a dead token".
  function readPayload(token) {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return JSON.parse(atob(b64));
    } catch {
      return null;
    }
  }

  function expiresInSeconds() {
    const token = getToken();
    if (!token) return null;
    const payload = readPayload(token);
    if (!payload || !payload.exp) return null;
    return payload.exp - Math.floor(Date.now() / 1000);
  }

  function isExpired() {
    const left = expiresInSeconds();
    if (left === null) return false;  // can't tell - let the server decide
    return left <= 0;
  }

  function isLoggedIn() {
    if (!getToken()) return false;
    if (isExpired()) {
      console.warn("Your session expired, so you have been signed out. Please log in again.");
      logout();
      return false;
    }
    return true;
  }

  function isRole(role) {
    const user = getUser();
    return Boolean(user && user.role === role);
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  function jsonHeaders() {
    return Object.assign({ "Content-Type": "application/json" }, authHeaders());
  }

  // Call with a fetch Response after any protected request. If the server
  // rejected the token, wipe the dead session and send the user to log in,
  // returning here afterwards. Returns true when it handled things.
  function handleAuthFailure(response) {
    if (response.status !== 401 && response.status !== 403) return false;
    logout();
    alert("Your session has expired. Please sign in again.");
    goLogin();
    return true;
  }

  function goLogin(returnTo) {
    const target = returnTo || (window.location.pathname.split("/").pop() + window.location.search);
    window.location.href = "login.html?next=" + encodeURIComponent(target);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // the vendor pages keep their own copy - clear that too so the two
    // sessions can never disagree about whether you are signed in
    sessionStorage.removeItem("hawkerToken");
    sessionStorage.removeItem("hawkerUser");
  }

  window.Session = {
    getToken, getUser, isLoggedIn, isRole, isExpired, expiresInSeconds,
    authHeaders, jsonHeaders, handleAuthFailure, goLogin, logout,
  };
})();