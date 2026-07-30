// scripts/cart.js — shows the logged-in user's cart and lets them
// change quantities or remove items. Mirrors the style of products.js /
// product-detail.js (plain fetch, imgSrc helper, onerror image fallback).

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

// Payment methods that need a saved card on the profile.
const CARD_METHODS = ["visa", "mastercard"];

// ---------------------------------------------------------------
// AUTH: the cart belongs to a logged-in user, so every request must
// carry the JWT that Aswin's /api/auth/login returns. A login page
// stores that token in localStorage under "token"; we read it
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
// STATE
// ---------------------------------------------------------------
let selectedPaymentMethod = null;
let appliedPromo = null;      // the code string currently applied, or null
let savedCardLast4 = null;    // filled by loadCardStatus()

// Ask the profile endpoint whether this user has a card saved.
// Used to block Visa / Mastercard before they get as far as paying.
async function loadCardStatus() {
  try {
    const res = await fetch("/api/auth/me", { headers: authHeaders() });
    if (!res.ok) return;
    const me = await res.json();
    savedCardLast4 = (me.user && me.user.cardLast4) || null;
  } catch (err) {
    console.error("loadCardStatus:", err);
  }
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
    await loadCardStatus();

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

    // ---- Order summary: fulfillment, promo, fees, payment method, pay button ----
    summaryBox.innerHTML = `
      <div class="fulfillment">
        <h4>Fulfillment</h4>
        <label><input type="radio" name="fulfillment" value="takeaway" checked> Takeaway</label>
        <label><input type="radio" name="fulfillment" value="delivery"> Delivery</label>
      </div>

      <div class="promo">
        <h4>Promo Code</h4>
        <div class="promo-row">
          <input type="text" id="promo-input" placeholder="e.g. SAVE5" autocomplete="off">
          <button type="button" id="promo-apply">Apply</button>
        </div>
        <p id="promo-msg" class="promo-msg"></p>
      </div>

      <div class="summary-line">
        <span>Subtotal</span>
        <span id="sum-subtotal">$${Number(data.total).toFixed(2)}</span>
      </div>

      <!-- fee + discount rows are filled in by refreshQuote() from the server -->
      <div id="fees"></div>

      <div class="summary-line summary-grand">
        <span>Total</span>
        <span class="summary-total" id="sum-total">$${Number(data.total).toFixed(2)}</span>
      </div>

      <h4>Payment Method</h4>
      <div class="payments">
        <button type="button" data-method="cash">Cash</button>
        <button type="button" data-method="paynow">PayNow</button>
        <button type="button" data-method="visa">Visa</button>
        <button type="button" data-method="mastercard">Mastercard</button>
      </div>
      <p id="pay-warning" class="pay-warning"></p>

      <button id="pay-now" class="pay-btn">Pay Now</button>
      <button id="clear-cart">Clear Cart</button>
    `;

    wireEvents();
    wireCheckout();
    restorePromo();   // re-apply a code the user entered before a page refresh
    refreshQuote();   // ask the server for the fee breakdown
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
        clearPromo();
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


/* =========================================================
   PROMO CODES  (reuses Timely's PromoCodes table)
   The browser only ever sends the CODE. Every discount is
   worked out by the server, so a user editing this file
   cannot give themselves money off.
   ========================================================= */

// Keep the applied code across a page refresh (quantity changes reload the
// cart). sessionStorage clears itself when the tab closes.
function restorePromo() {
  const saved = sessionStorage.getItem("promoCode");
  if (!saved) return;
  appliedPromo = saved;
  const input = document.getElementById("promo-input");
  if (input) input.value = saved;
}

function clearPromo() {
  appliedPromo = null;
  sessionStorage.removeItem("promoCode");
}

function showPromoMessage(text, ok) {
  const msg = document.getElementById("promo-msg");
  if (!msg) return;
  msg.textContent = text || "";
  msg.className = "promo-msg " + (text ? (ok ? "promo-ok" : "promo-bad") : "");
}

async function applyPromo() {
  const input = document.getElementById("promo-input");
  if (!input) return;
  const code = input.value.trim();

  if (!code) {                 // empty box = remove the code
    clearPromo();
    showPromoMessage("", true);
    refreshQuote();
    return;
  }

  appliedPromo = code;
  sessionStorage.setItem("promoCode", code);
  await refreshQuote();        // the server tells us whether it was valid
}


/* =========================================================
   CHECKOUT: fees, payment method, pay now
   All money is calculated by the SERVER (/api/orders/quote),
   so the fees shown here always match what gets charged.
   ========================================================= */

// Which fulfillment radio is currently chosen?
function currentFulfillment() {
  const checked = document.querySelector("input[name='fulfillment']:checked");
  return checked ? checked.value : "takeaway";
}

// Ask the server for the fee breakdown for the current cart + fulfillment + promo.
async function refreshQuote() {
  try {
    let url = `/api/orders/quote?fulfillment=${currentFulfillment()}`;
    if (appliedPromo) url += `&promoCode=${encodeURIComponent(appliedPromo)}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return;
    // { subtotal, deliveryFee, minOrderFee, discount, total, minOrder, promoCode, promoError }
    const q = await res.json();

    const sub = document.getElementById("sum-subtotal");
    const tot = document.getElementById("sum-total");
    const fees = document.getElementById("fees");
    if (sub) sub.textContent = `$${q.subtotal.toFixed(2)}`;
    if (tot) tot.textContent = `$${q.total.toFixed(2)}`;

    // Promo feedback under the input box.
    if (appliedPromo) {
      if (q.promoError) {
        showPromoMessage(q.promoError, false);
        clearPromo();
      } else {
        showPromoMessage(`${q.promoCode} applied - $${q.discount.toFixed(2)} off`, true);
      }
    }

    if (fees) {
      fees.innerHTML = `
        ${q.minOrderFee > 0 ? `
          <div class="summary-line fee-row">
            <span>Min Order Fee <small>(min $${q.minOrder.toFixed(2)})</small></span>
            <span>$${q.minOrderFee.toFixed(2)}</span>
          </div>` : ""}
        ${q.deliveryFee > 0 ? `
          <div class="summary-line fee-row">
            <span>Delivery Fee</span>
            <span>$${q.deliveryFee.toFixed(2)}</span>
          </div>` : ""}
        ${q.discount > 0 ? `
          <div class="summary-line discount-row">
            <span>Promo (${q.promoCode})</span>
            <span>-$${q.discount.toFixed(2)}</span>
          </div>` : ""}
      `;
    }
  } catch (err) {
    console.error("refreshQuote:", err);
  }
}

// Show or clear the "you need a card" warning under the payment buttons.
function updatePayWarning() {
  const warn = document.getElementById("pay-warning");
  if (!warn) return;

  if (CARD_METHODS.includes(selectedPaymentMethod) && !savedCardLast4) {
    warn.textContent = "No card saved on your profile. You'll be sent there to add one.";
    warn.style.display = "block";
  } else {
    warn.textContent = "";
    warn.style.display = "none";
  }
}

function wireCheckout() {
  // Changing takeaway/delivery re-asks the server for fees.
  document.querySelectorAll("input[name='fulfillment']").forEach(r => {
    r.addEventListener("change", refreshQuote);
  });

  // Promo code: Apply button, or just pressing Enter in the box.
  const applyBtn = document.getElementById("promo-apply");
  if (applyBtn) applyBtn.addEventListener("click", applyPromo);

  const promoInput = document.getElementById("promo-input");
  if (promoInput) {
    promoInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); applyPromo(); }
    });
  }

  // Payment method buttons: highlight the chosen one.
  const paymentButtons = document.querySelectorAll(".payments button");
  paymentButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      paymentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPaymentMethod = btn.dataset.method;
      updatePayWarning();
    });
  });

  // Pay Now
  const payBtn = document.getElementById("pay-now");
  if (payBtn) payBtn.addEventListener("click", onPayNow);

  // QR modal "Done" -> actually place the order
  const qrDone = document.getElementById("qr-done");
  if (qrDone) qrDone.addEventListener("click", () => {
    document.getElementById("qr-modal").style.display = "none";
    placeOrder();
  });

  // QR modal "Cancel" / clicking the dark backdrop -> close without paying
  const qrCancel = document.getElementById("qr-cancel");
  if (qrCancel) qrCancel.addEventListener("click", closeQr);

  const qrModal = document.getElementById("qr-modal");
  if (qrModal) qrModal.addEventListener("click", e => {
    if (e.target === qrModal) closeQr();   // only the backdrop, not the white box
  });
}

function closeQr() {
  const modal = document.getElementById("qr-modal");
  if (modal) modal.style.display = "none";
}

async function onPayNow() {
  if (!selectedPaymentMethod) {
    alert("Please select a payment method.");
    return;
  }

  // Card payment with no saved card -> send them to the profile page to add
  // one, remembering to come back here afterwards.
  if (CARD_METHODS.includes(selectedPaymentMethod) && !savedCardLast4) {
    const go = confirm(
      "You don't have a card saved on your profile.\n\n" +
      "Add one now? You'll come straight back to your cart."
    );
    if (go) window.location.href = "user.html?next=cart.html&reason=card";
    return;
  }

  // PayNow shows the QR first; the order is placed after they tap Done.
  if (selectedPaymentMethod === "paynow") {
    const modal = document.getElementById("qr-modal");
    if (modal) { modal.style.display = "flex"; return; }
  }

  placeOrder();
}

// Send the order to the server. The server recalculates all money.
async function placeOrder() {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        paymentMethod: selectedPaymentMethod,
        fulfillment: currentFulfillment(),
        promoCode: appliedPromo || undefined
      })
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "payment-failed.html?reason=session";
      return;
    }
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));

      // A rejected promo code shouldn't dump the user on the failure page -
      // they can just fix the code and try again.
      if (msg.code === "BAD_PROMO") {
        clearPromo();
        showPromoMessage(msg.message, false);
        refreshQuote();
        return;
      }
      // Same for a missing card: send them to the profile instead.
      if (msg.code === "NO_CARD") {
        savedCardLast4 = null;
        updatePayWarning();
        if (confirm(msg.message + "\n\nGo to your profile to add one?")) {
          window.location.href = "user.html?next=cart.html&reason=card";
        }
        return;
      }

      window.location.href = "payment-failed.html?reason=" + encodeURIComponent(msg.message || "error");
      return;
    }

    const order = await res.json();
    // Pass a few details to the success page.
    sessionStorage.setItem("lastOrderId", order.orderId);
    sessionStorage.setItem("lastOrderTotal", order.total);
    clearPromo();
    window.location.href = "payment-success.html";
  } catch (err) {
    console.error("placeOrder:", err);
    window.location.href = "payment-failed.html?reason=network";
  }
}

document.addEventListener("DOMContentLoaded", loadCart);