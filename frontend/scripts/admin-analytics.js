// admin-analytics.js  (Aswin - Analytics & Reports)
// Reads the /api/admin analytics endpoints and renders the stat cards,
// four compact charts and the top-stalls table. Admin-only page.

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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

const ORANGE = "#e8811c";
const PALETTE = ["#e8811c", "#4caf50", "#f2c744", "#29b6d8", "#9c5bd4", "#ef5350"];

async function loadSummary() {
  const s = await authFetch("/summary");
  document.getElementById("best-hawker").textContent = s.bestHawker;
  document.getElementById("total-complaints").textContent = s.totalComplaints;
  document.getElementById("avg-rating").textContent = Number(s.avgRating).toFixed(1) + " / 5";
  document.getElementById("review-count").textContent = s.reviewCount;
  document.getElementById("total-orders").textContent = Number(s.totalOrders).toLocaleString();
}

async function loadCharts() {
  const [category, centre, month, stalls] = await Promise.all([
    authFetch("/complaints-by-category"),
    authFetch("/complaints-by-centre"),
    authFetch("/complaints-by-month"),
    authFetch("/top-stalls")
  ]);

  const common = { responsive: true, maintainAspectRatio: false };

  new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: category.map(r => r.category),
      datasets: [{ data: category.map(r => r.count), backgroundColor: PALETTE }]
    },
    options: { ...common, plugins: { legend: { position: "right" } } }
  });

  new Chart(document.getElementById("centreChart"), {
    type: "bar",
    data: {
      labels: centre.map(r => r.centre),
      datasets: [{ label: "Complaints", data: centre.map(r => r.count), backgroundColor: ORANGE }]
    },
    options: { ...common, plugins: { legend: { display: false } } }
  });

  // Highest rated stalls: top 5 by average rating.
  const top5 = stalls.slice(0, 5);
  new Chart(document.getElementById("ratingChart"), {
    type: "bar",
    data: {
      labels: top5.map(r => r.stallName),
      datasets: [{ label: "Rating", data: top5.map(r => Number(r.avgRating)), backgroundColor: ORANGE }]
    },
    options: { ...common, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 5 } } }
  });

  new Chart(document.getElementById("monthChart"), {
    type: "line",
    data: {
      labels: month.map(r => r.month),
      datasets: [{ label: "Complaints", data: month.map(r => r.count), borderColor: ORANGE, backgroundColor: ORANGE, tension: 0.3, fill: false }]
    },
    options: { ...common, plugins: { legend: { display: false } } }
  });

  // Top stalls table.
  const tbody = document.getElementById("top-stalls-body");
  tbody.innerHTML = "";
  stalls.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${i + 1}</td>` +
      `<td>${s.stallName}</td>` +
      `<td>${s.centre}</td>` +
      `<td>${Number(s.avgRating).toFixed(1)}</td>` +
      `<td>${s.reviewCount}</td>` +
      `<td>${s.complaintCount}</td>` +
      `<td>${Number(s.orderCount || 0).toLocaleString()}</td>` +
      `<td>$${Number(s.revenue || 0).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}

// Summary and charts load independently, so a failure in one never blanks the other.
loadSummary().catch(err => console.error("Summary failed:", err));
loadCharts().catch(err => console.error("Charts failed:", err));
