// admin-revenue.js  (Aswin - Revenue & Orders)
// Reads the /api/admin revenue endpoints and renders the stat cards, three
// charts and the top-stalls-by-revenue table. Admin-only page.

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

// $ with thousands separators, no decimals (for large totals).
function money(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

async function loadSummary() {
  const s = await authFetch("/revenue-summary");
  document.getElementById("total-revenue").textContent = money(s.totalRevenue);
  document.getElementById("total-orders").textContent = Number(s.totalOrders).toLocaleString();
  document.getElementById("avg-order-value").textContent = "$" + Number(s.avgOrderValue).toFixed(2);
  document.getElementById("best-hawker").textContent = s.bestHawker;
}

async function loadCharts() {
  const [month, payment, centre] = await Promise.all([
    authFetch("/revenue-by-month"),
    authFetch("/orders-by-payment"),
    authFetch("/revenue-by-centre")
  ]);

  const common = { responsive: true, maintainAspectRatio: false };

  new Chart(document.getElementById("revenueChart"), {
    type: "line",
    data: {
      labels: month.map(r => r.month),
      datasets: [{ label: "Revenue", data: month.map(r => r.revenue), borderColor: ORANGE, backgroundColor: ORANGE, tension: 0.3, fill: false }]
    },
    options: { ...common, plugins: { legend: { display: false } } }
  });

  new Chart(document.getElementById("paymentChart"), {
    type: "doughnut",
    data: {
      labels: payment.map(r => r.method),
      datasets: [{ data: payment.map(r => r.count), backgroundColor: PALETTE }]
    },
    options: { ...common, plugins: { legend: { position: "right" } } }
  });

  new Chart(document.getElementById("centreRevChart"), {
    type: "bar",
    data: {
      labels: centre.map(r => r.centre),
      datasets: [{ label: "Revenue", data: centre.map(r => r.revenue), backgroundColor: ORANGE }]
    },
    options: { ...common, plugins: { legend: { display: false } } }
  });
}

async function loadTable() {
  const stalls = await authFetch("/top-stalls-by-revenue");
  const tbody = document.getElementById("rev-stalls-body");
  tbody.innerHTML = "";
  stalls.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${i + 1}</td>` +
      `<td>${s.stallName}</td>` +
      `<td>${s.centre}</td>` +
      `<td>${Number(s.orderCount).toLocaleString()}</td>` +
      `<td>${money(s.revenue)}</td>`;
    tbody.appendChild(tr);
  });
}

// Each section loads independently so one failure never blanks the rest.
loadSummary().catch(err => console.error("Revenue summary failed:", err));
loadCharts().catch(err => console.error("Revenue charts failed:", err));
loadTable().catch(err => console.error("Revenue table failed:", err));
