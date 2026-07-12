const API = "/api/auth"; // the same server serves both the frontend and the API

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

      // Success: save the token + basic user info in the browser
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on the role the server sent back
      const role = data.user.role;
      if (role === "admin") {
        window.location.href = "home.html";   // TODO: swap to admin-analytics.html once built
      } else if (role === "vendor") {
        window.location.href = "home.html";   // TODO: swap to vendor-dashboard.html once built
      } else {
        window.location.href = "home.html";   // customer
      }
    } catch (err) {
      errorBox.textContent = "Cannot reach the server. Is it running?";
    }
  });
}

// ---------- SIGNUP ----------
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  const errorBox = document.getElementById("errorBox");

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
    if (password.length < 6) {
      errorBox.textContent = "Password must be at least 6 characters.";
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
