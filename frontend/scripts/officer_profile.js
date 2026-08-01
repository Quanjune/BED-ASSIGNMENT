// officer_profile.js  (Kaden - NEA officer portal, profile page)
//
// The officer's version of user.html. Same two endpoints as the customer
// profile - GET /api/auth/me and PUT /api/auth/me, both Aswin's - so nothing
// on the back end is duplicated. The only difference is that there is no
// saved-payment-card row, because an NEA officer never pays for anything.
//
// Uses Officer.api() from officer_auth.js, which attaches the token, handles
// an expired session and turns the two different server error shapes into one
// readable message.

if (!Officer.requireOfficer()) {
  throw new Error("Not an officer.");
}

const feedbackEl = document.getElementById("pfFeedback");

// Held so an edit can send BOTH fields back: PUT /api/auth/me expects a
// complete name + email pair, not just the field that changed.
let current = { name: "", email: "", role: "" };

// ---------- load ----------

async function loadProfile() {
  try {
    const data = await Officer.api("/auth/me");
    current = data.user;

    document.getElementById("pfName").textContent = current.name || "-";
    document.getElementById("pfRole").textContent = current.role || "-";
    document.getElementById("pfEmail").textContent = current.email || "-";
  } catch (err) {
    Officer.toast(feedbackEl, `Could not load your profile: ${err.message}`, false);
  }
}

// ---------- edit ----------

// Both Edit buttons share one listener via the data-edit attribute, so adding
// another editable field later needs no new JavaScript.
document.querySelectorAll("button[data-edit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.edit;          // "name" or "email"
    const label = field === "name" ? "username" : "email address";

    const entered = prompt(`Enter your new ${label}:`, current[field] || "");
    if (entered === null) return;            // Cancel

    const value = entered.trim();
    if (!value) {
      Officer.toast(feedbackEl, `Your ${label} cannot be empty.`, false);
      return;
    }
    if (value === current[field]) return;    // nothing changed

    saveField(field, value);
  });
});

async function saveField(field, newValue) {
  // Send the current pair with just the one field replaced.
  const body = { name: current.name, email: current.email };
  body[field] = newValue;

  try {
    await Officer.api("/auth/me", { method: "PUT", body: JSON.stringify(body) });
    Officer.toast(feedbackEl, "Saved.", true);

    // Keep the header pill in step with the new name without a page reload.
    if (field === "name") {
      const stored = Session.getUser();
      if (stored) {
        stored.name = newValue;
        localStorage.setItem("user", JSON.stringify(stored));
      }
      const nameTag = document.getElementById("officer-name");
      if (nameTag) nameTag.textContent = newValue;
    }

    await loadProfile();
  } catch (err) {
    // The server validates properly (email format, duplicate address), so its
    // message is more useful than anything invented here.
    Officer.toast(feedbackEl, err.message, false);
  }
}

// ---------- logout ----------

document.getElementById("logoutBtn").addEventListener("click", () => {
  Session.logout();                 // clears both the customer and vendor keys
  window.location.href = "login.html";
});

// ---------- start ----------
loadProfile();