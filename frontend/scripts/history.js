// scripts/history.js
// Loads the logged-in user's past orders from GET /api/orders and renders
// one expandable card per order, plus summary stats at the top.
// The token identifies the user, so the browser never sends a userId.
//
// If the visitor is not logged in (or their token has expired) we do NOT
// redirect them away. We show a sign-in panel in place of the order list
// so they can see where they are and choose to log in.

const listEl = document.getElementById("history-list");
const statsEl = document.querySelector(".history-stats");
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

  const promoLine = order.promoCode
    ? `<div class="detail-item promo-line">Promo (${order.promoCode}): -$${Number(order.discount || 0).toFixed(2)}</div>`
    : "";

  card.innerHTML = `
    <div class="status">${order.status === "paid" ? "Delivered" : order.status}</div>

    <div class="history-row main-row">
      <div>
        <div class="title">${firstItem}${extra}</div>
        <div class="meta">
          <span>🕒 ${formatWhen(order.createdAt)}</span>
          <span>📍 ${order.centerName || (isDelivery ? "Delivery" : "Takeaway")}</span>
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
      ${promoLine}
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

// Renders a "please log in" panel inside the order list instead of
// bouncing the visitor to login.html.
//   reason "guest"   -> never logged in
//   reason "expired" -> had a token, but the server rejected it (401/403)
function showSignedOut(reason) {
  // The stats pills would just read "0" and look broken, so hide them.
  if (statsEl) statsEl.style.display = "none";

  const heading = reason === "expired"
    ? "Your session has expired"
    : "You're not logged in";

  const message = reason === "expired"
    ? "Please log in again to see your order history."
    : "Log in to view your past orders, receipts and spending summary.";

  listEl.innerHTML = `
    <div class="signed-out">
      <div class="signed-out-icon">\u{1F512}</div>
      <h3 class="signed-out-title">${heading}</h3>
      <p class="signed-out-text">${message}</p>
      <div class="signed-out-actions">
        <a class="btn-primary" href="./login.html">Log In</a>
        <a class="btn-secondary" href="./signup.html">Sign Up</a>
      </div>
    </div>
  `;
}

async function loadHistory() {
  // No token at all -> guest. Show the panel, do not redirect.
  if (!token) {
    showSignedOut("guest");
    return;
  }

  try {
    const res = await fetch("/api/orders", {
      headers: { Authorization: "Bearer " + token }
    });

    // Token exists but the server rejected it (expired or tampered with).
    // Clear the stale token so the navbar stops showing a logged-in state.
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      showSignedOut("expired");
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