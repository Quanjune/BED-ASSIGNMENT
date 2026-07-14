// scripts/cart.js — shows the logged-in user's cart and lets them
// change quantities or remove items. Mirrors the style of products.js /
// product-detail.js (plain fetch, imgSrc helper, onerror image fallback).

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

// ---------------------------------------------------------------
// AUTH: the cart belongs to a logged-in user, so every request must
// carry the JWT that Aswin's /api/auth/login returns. A login page
// stores that token in localStorage under "accessToken"; we read it
// here and send it as an Authorization header.
// ---------------------------------------------------------------
function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------
// LOAD + RENDER the cart.
// ---------------------------------------------------------------
async function loadCart() {
  const itemsBox = document.getElementById("cart-items");
  const summaryBox = document.getElementById("cart-summary");

  // Not logged in -> don't even call the API; show a friendly prompt.
  if (!getToken()) {
    itemsBox.innerHTML = "<p>Please log in to view your cart.</p>";
    summaryBox.innerHTML = "";
    return;
  }

  try {
    const res = await fetch("/api/cart", { headers: authHeaders() });

    // 401/403 -> token missing or expired.
    if (res.status === 401 || res.status === 403) {
      itemsBox.innerHTML = "<p>Your session has expired. Please log in again.</p>";
      summaryBox.innerHTML = "";
      return;
    }
    if (!res.ok) throw new Error("Failed to load cart");

    const data = await res.json(); // { items: [...], total: number }

    if (!data.items || data.items.length === 0) {
      itemsBox.innerHTML = "<p>Your cart is empty.</p>";
      summaryBox.innerHTML = "";
      return;
    }

    // One row per cart line.
    itemsBox.innerHTML = data.items.map(item => `
      <div class="cart-row" data-id="${item.cartItemId}">
        <img class="cart-img" src="${imgSrc(item.imagePath)}" alt="${item.productName}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
        <div class="cart-info">
          <p class="cart-name">${item.productName}</p>
          <p class="price">$${Number(item.unitPrice).toFixed(2)} each</p>
        </div>
        <div class="cart-qty">
          <button class="qty-btn" data-action="dec" data-id="${item.cartItemId}" data-qty="${item.quantity}">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" data-action="inc" data-id="${item.cartItemId}" data-qty="${item.quantity}">+</button>
        </div>
        <p class="cart-line-total">$${Number(item.lineTotal).toFixed(2)}</p>
        <button class="remove-btn" data-id="${item.cartItemId}">Remove</button>
      </div>
    `).join("");

    summaryBox.innerHTML = `
      <div class="summary-line">
        <span>Total</span>
        <span class="summary-total">$${Number(data.total).toFixed(2)}</span>
      </div>
      <button id="clear-cart">Clear Cart</button>
    `;

    wireEvents();
  } catch (err) {
    console.error(err);
    itemsBox.innerHTML = "<p>Could not load your cart.</p>";
  }
}

// ---------------------------------------------------------------
// Attach listeners after the rows exist in the DOM.
// ---------------------------------------------------------------
function wireEvents() {
  // + / - quantity buttons
  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const current = parseInt(btn.dataset.qty);
      const newQty = btn.dataset.action === "inc" ? current + 1 : current - 1;

      if (newQty < 1) {
        // Pressing - at quantity 1 would remove the item: confirm first.
        if (confirm("Remove this item from your cart?")) {
          await removeItem(id);
        }
        // If they cancel, do nothing - quantity stays at 1.
      } else {
        await updateQty(id, newQty);
      }
    });
  });

  // Remove buttons
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", () => removeItem(btn.dataset.id));
  });

  // Clear whole cart
  const clearBtn = document.getElementById("clear-cart");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (!confirm("Remove all items from your cart?")) return;
      try {
        await fetch("/api/cart", { method: "DELETE", headers: authHeaders() });
        loadCart();
      } catch (err) {
        console.error(err);
      }
    });
  }
}

async function updateQty(cartItemId, quantity) {
  try {
    const res = await fetch(`/api/cart/${cartItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ quantity })
    });
    if (res.status === 401 || res.status === 403) {
      alert("Your session expired. Please log in again.");
      return;
    }
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      alert("Could not update quantity: " + (msg.message || res.status));
      return;
    }
    loadCart(); // refresh totals
  } catch (err) {
    console.error(err);
    alert("Something went wrong updating the cart.");
  }
}

async function removeItem(cartItemId) {
  try {
    const res = await fetch(`/api/cart/${cartItemId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (!res.ok) throw new Error("Remove failed");
    loadCart();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadCart);