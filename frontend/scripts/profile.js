// frontend/scripts/profile.js
// Loads the logged-in user's profile from /api/auth/me, allows editing
// name + email (PUT /api/auth/me), and logs out. Role is display-only.

const API = "/api/auth";
const token = localStorage.getItem("token");

// Must be logged in to view the profile.
if (!token) {
  window.location.href = "login.html";
}

let current = { name: "", email: "", role: "" };

async function loadProfile() {
  try {
    const res = await fetch(`${API}/me`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) {
      // token missing / expired -> back to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
      return;
    }
    const data = await res.json();
    current = data.user;
    document.getElementById("pfName").textContent = current.name || "-";
    document.getElementById("pfRole").textContent = current.role || "-";
    document.getElementById("pfEmail").textContent = current.email || "-";
  } catch (err) {
    alert("Couldn't reach the server. Is it running?");
  }
}

// PUT /api/auth/me needs BOTH name and email, so send the current pair
// with just the one field changed.
async function saveField(field, newValue) {
  const body = { name: current.name, email: current.email };
  body[field] = newValue;
  try {
    const res = await fetch(`${API}/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Update failed.");
      return;
    }
    await loadProfile(); // refresh the display
  } catch (err) {
    alert("Couldn't reach the server. Is it running?");
  }
}

// Edit buttons (name + email)
document.querySelectorAll("[data-edit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.edit;                 // "name" or "email"
    const label = field === "name" ? "username" : "email";
    const newValue = prompt(`Enter new ${label}:`, current[field] || "");
    if (newValue === null) return;                  // cancelled
    const trimmed = newValue.trim();
    if (!trimmed) { alert(`Your ${label} cannot be empty.`); return; }
    saveField(field, trimmed);
  });
});

// Payment — placeholder for now (not stored in the DB yet; team still deciding).
document.getElementById("pfPaymentBtn")?.addEventListener("click", () => {
  alert("Payment details aren't saved yet - the team is still deciding how to store them.");
});

// Logout — clear the token everywhere and go back to login.
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("hawkerToken");
  sessionStorage.removeItem("hawkerUser");
  window.location.href = "login.html";
});

loadProfile();
