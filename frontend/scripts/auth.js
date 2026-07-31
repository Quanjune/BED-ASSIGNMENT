const API = "/api/auth"; // the same server serves both the frontend and the API

// Pages like complaints.html send guests here as
//   login.html?next=complaints.html%3FstallId%3D3
// so we can drop them back where they were once they sign in.
// SAFETY: only same-site relative paths are honoured. Anything with a
// scheme or a leading slash is ignored, so this can't be used to bounce
// someone to another website after they log in.
function getNextTarget() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return null;  // http:, javascript: ...
  if (next.startsWith("/") || next.startsWith("\\")) return null;
  return next;
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const errorBox = document.getElementById("errorBox");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();          // stop the browser from reloading the page
    errorBox.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      errorBox.textContent = "Please enter your email and password.";
      return;
    }

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        // e.g. 401 wrong password — show the server's message
        errorBox.textContent = data.message || "Login failed.";
        return;
      }

      // Success — store the token + user info.
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      const role = data.user.role;

      if (role === "vendor") {
        // The vendor page reads the token from sessionStorage under these keys.
        sessionStorage.setItem("hawkerToken", data.accessToken);
        sessionStorage.setItem("hawkerUser", JSON.stringify(data.user));

        // Before sending a vendor to the stall page, confirm the backend can find
        // a stall for this account. If it can't, keep them here with a message.
        try {
          const stallRes = await fetch("/api/vendors/stall", {
            headers: { "Authorization": "Bearer " + data.accessToken }
          });
          if (!stallRes.ok) {
            // Valid login, but no stall linked — undo the sign-in, stay on login.
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            sessionStorage.removeItem("hawkerToken");
            sessionStorage.removeItem("hawkerUser");
            errorBox.textContent = "No stall is linked to this account. Please contact your operator.";
            return;
          }
        } catch (err) {
          errorBox.textContent = "Cannot reach the server. Is it running?";
          return;
        }

        window.location.href = "vendor.html";
        return;
      }

      // Customer / admin - go back where they came from, if anywhere
      const next = getNextTarget();
      if (next) {
        window.location.href = next;
      } else if (role === "admin") {
        window.location.href = "admin-analytics.html";   // admin landing
      } else if (role === "officer") {
        window.location.href = "officer.html";           // NEA officer landing
      } else {
        window.location.href = "index.html";             // customer
      }
    } catch (err) {
      errorBox.textContent = "Cannot reach the server. Is it running?";
    }
  });
}

// ---------- SIGNUP ----------
const signupForm = document.getElementById("signupForm");

// Password rule (mirrors the server: 8+ chars, at least one letter and one number).
function passwordError(pw) {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(pw)) return "Password must include at least one number.";
  return "";
}

if (signupForm) {
  const errorBox = document.getElementById("errorBox");
  const pwError = document.getElementById("pwError");
  const pwInput = document.getElementById("password");

  // Live red feedback under the password field as the user types.
  if (pwInput && pwError) {
    pwInput.addEventListener("input", () => {
      pwError.textContent = pwInput.value ? passwordError(pwInput.value) : "";
    });
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.color = "#b23a43";
    errorBox.textContent = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    if (!name || !email || !password) {
      errorBox.textContent = "Please fill in all fields.";
      return;
    }
    const pwErr = passwordError(password);
    if (pwErr) {
      if (pwError) pwError.textContent = pwErr;
      return;
    }

    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await res.json();

      if (!res.ok) {
        // e.g. 409 email already exists — show the server's message
        errorBox.textContent = data.message || "Signup failed.";
        return;
      }

      // Success — show a green message, then send them to the login page
      errorBox.style.color = "#2e7d32";
      errorBox.textContent = "Account created! Redirecting to login...";
      setTimeout(() => { window.location.href = "login.html"; }, 1200);
    } catch (err) {
      errorBox.textContent = "Cannot reach the server. Is it running?";
    }
  });
}