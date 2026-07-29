// admin-users.js  (Aswin - User Management)
// Lists every user with a role filter + name search, and lets an admin
// delete a user. Roles are shown as read-only badges. Admin-only page.

const API = "/api/admin";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user || user.role !== "admin") {
  alert("Admins only. Please log in as an administrator.");
  window.location.href = "login.html";
}

async function authFetch(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { "Authorization": "Bearer " + token, ...(options.headers || {}) }
  });
  if (res.status === 401 || res.status === 403) {
    window.location.href = "login.html";
    throw new Error("Not authorised");
  }
  return res;
}

let allUsers = [];   // cached list, filtered client-side

const TRASH_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
  `<polyline points="3 6 5 6 21 6"></polyline>` +
  `<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>` +
  `</svg>`;

function badge(role) {
  return `<span class="badge badge-${role}">${role}</span>`;
}

function updateCounts() {
  const c = { vendor: 0, customer: 0, admin: 0 };
  allUsers.forEach(u => { if (c[u.role] !== undefined) c[u.role]++; });
  document.getElementById("count-vendor").textContent = c.vendor;
  document.getElementById("count-customer").textContent = c.customer;
  document.getElementById("count-admin").textContent = c.admin;
  document.getElementById("count-total").textContent = allUsers.length;
}

function render() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const roleF = document.getElementById("roleFilter").value;

  const rows = allUsers.filter(u =>
    (roleF === "all" || u.role === roleF) &&
    (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  );

  const tbody = document.getElementById("users-body");
  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">No users match.</td></tr>`;
    return;
  }

  rows.forEach(u => {
    const isSelf = u.userId === user.userId;
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${u.name}</td>` +
      `<td>${u.email}</td>` +
      `<td>${badge(u.role)}</td>` +
      `<td>${u.stallName || "-"}</td>` +
      `<td>` +
        (isSelf
          ? `<span class="muted">You</span>`
          : `<button class="del-btn" data-id="${u.userId}" data-name="${u.name}" title="Delete user">${TRASH_SVG}</button>`) +
      `</td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".del-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.id, btn.dataset.name));
  });
}

async function loadUsers() {
  const res = await authFetch("/users");
  allUsers = await res.json();
  updateCounts();
  render();
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    const res = await authFetch(`/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { alert(data.message || "Failed to delete user."); return; }
    loadUsers();   // refresh
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("roleFilter").addEventListener("change", render);

loadUsers().catch(err => console.error("User management load error:", err));
