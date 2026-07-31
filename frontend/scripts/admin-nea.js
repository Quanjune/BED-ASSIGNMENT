// admin-nea.js  (Aswin - third-party API page)
// Shows live NEA hawker-centre data. The browser calls OUR endpoint
// (/api/admin/nea/hawker-centres); the back-end is what calls data.gov.sg.
// Admin-only page.

const API = "/api/admin";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user || user.role !== "admin") {
  alert("Admins only. Please log in as an administrator.");
  window.location.href = "login.html";
}

async function authFetch(path) {
  const res = await fetch(API + path, {
    headers: { "Authorization": "Bearer " + token }
  });
  if (res.status === 401 || res.status === 403) {
    window.location.href = "login.html";
    throw new Error("Not authorised");
  }
  return res;
}

let allCentres = [];

function render() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const rows = allCentres.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.location || "").toLowerCase().includes(q)
  );

  const tbody = document.getElementById("nea-body");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No centres match.</td></tr>`;
    return;
  }
  rows.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${c.name}</td>` +
      `<td>${c.location || "-"}</td>` +
      `<td>${c.type || "-"}</td>` +
      `<td>${c.owner || "-"}</td>` +
      `<td>${c.stalls}</td>` +
      `<td>${c.cookedFoodStalls}</td>`;
    tbody.appendChild(tr);
  });
}

async function load() {
  const tbody = document.getElementById("nea-body");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading live NEA data…</td></tr>`;
  try {
    const res = await authFetch("/nea/hawker-centres");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      tbody.innerHTML = `<tr><td colspan="6" class="muted">${err.message || "Could not load NEA data."}</td></tr>`;
      return;
    }
    const data = await res.json();
    allCentres = data.centres || [];

    document.getElementById("total-centres").textContent = data.summary.totalCentres;
    document.getElementById("total-stalls").textContent = Number(data.summary.totalStalls).toLocaleString();
    document.getElementById("total-cooked").textContent = Number(data.summary.totalCookedFoodStalls).toLocaleString();
    document.getElementById("freshness").textContent = data.cached ? "· cached" : "· just fetched";

    render();
  } catch (err) {
    console.error("NEA load error:", err);
  }
}

document.getElementById("searchInput").addEventListener("input", render);
load();
