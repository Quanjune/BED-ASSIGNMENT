// scripts/history.js
// Loads the logged-in user's past orders from GET /api/orders and renders
// one expandable card per order, plus summary stats at the top.
// The token identifies the user, so the browser never sends a userId.

const listEl = document.getElementById("history-list");
const statTotal = document.getElementById("stat-total");
const statCompleted = document.getElementById("stat-completed");
const statSpent = document.getElementById("stat-spent");

// Auth token is saved by the login page under the key "token".
const token = localStorage.getItem("token");

// Turn a SQL datetime string into a readable date + time.
function formatWhen(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (isNaN(d)) return "";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" }) +
         " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Build the collapsed + expanded markup for one order.
function buildCard(order) {
  const items = order.items || [];
  const firstItem = items.length ? items[0].productName : "Order";
  const extra = items.length > 1 ? ` +${items.length - 1} more` : "";
  const isDelivery = order.fulfillment === "delivery";

  const card = document.createElement("div");
  card.className = "history-card";

  const itemLines = items.map(i =>
    `<div class="detail-item">${i.quantity}× ${i.productName} — $${Number(i.itemTotal).toFixed(2)}</div>`
  ).join("");

  const feeLine = isDelivery
    ? `<div class="detail-item">Delivery Fee: $${Number(order.deliveryFee || 0).toFixed(2)}</div>`
    : `<div class="detail-item">Takeaway Charge: $0.00</div>`;

  const minFeeLine = Number(order.minOrderFee) > 0
    ? `<div class="detail-item">Min Order Fee: $${Number(order.minOrderFee).toFixed(2)}</div>`
    : "";

  card.innerHTML = `
    <div class="status">${order.status === "paid" ? "Delivered" : order.status}</div>

    <div class="history-row main-row">
      <div>
        <div class="title">${firstItem}${extra}</div>
        <div class="meta">
          <span>🕒 ${formatWhen(order.createdAt)}</span>
          <span>📍 ${isDelivery ? "Delivery" : "Takeaway"}</span>
          <span>#${order.orderId}</span>
        </div>
      </div>
      <div class="price">$${Number(order.total).toFixed(2)}</div>
    </div>

    <div class="history-details" style="display:none;">
      ${itemLines}
      <div class="detail-item">Subtotal: $${Number(order.subtotal).toFixed(2)}</div>
      ${feeLine}
      ${minFeeLine}
      <div class="detail-item">Payment Method: ${(order.paymentMethod || "unknown").toUpperCase()}</div>
      <div class="detail-total">Total: $${Number(order.total).toFixed(2)}</div>
    </div>
  `;

  // Clicking the top row toggles the breakdown open/closed.
  card.querySelector(".main-row").onclick = () => {
    const details = card.querySelector(".history-details");
    details.style.display = details.style.display === "none" ? "block" : "none";
  };

  return card;
}

async function loadHistory() {
  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  try {
    const res = await fetch("/api/orders", {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "./login.html";
      return;
    }
    if (!res.ok) throw new Error("Failed to load orders");

    const orders = await res.json();

    if (!orders.length) {
      listEl.innerHTML = `<p class="empty">No orders yet</p>`;
      return;
    }

    let totalOrders = 0;
    let completedOrders = 0;
    let totalSpent = 0;

    orders.forEach(order => {
      totalOrders++;
      if (order.status === "paid") completedOrders++;
      totalSpent += Number(order.total) || 0;
      listEl.appendChild(buildCard(order));
    });

    statTotal.textContent = `Total Order: ${totalOrders}`;
    statCompleted.textContent = `Completed: ${completedOrders}`;
    statSpent.textContent = `Total Spent: $${totalSpent.toFixed(2)}`;
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="empty">Could not load your order history.</p>`;
  }
}

loadHistory();