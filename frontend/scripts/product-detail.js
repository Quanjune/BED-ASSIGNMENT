// scripts/product-detail.js — shows one product, its customisation options,
// a live-updating price, and adds the chosen combination to the cart.

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

const params = new URLSearchParams(window.location.search);
const productId = params.get("productId");

// Login token (saved by the login page as "token").
function getToken() {
  return localStorage.getItem("token");
}

let basePrice = 0;      // product base price
let addonGroups = [];   // [{groupId,title,groupType,isRequired,options:[...]}]

async function loadProduct() {
  const box = document.getElementById("product-detail");
  try {
    // Fetch product + its addon options in parallel.
    const [prodRes, addonRes] = await Promise.all([
      fetch(`/api/products/${productId}`),
      fetch(`/api/products/${productId}/addons`)
    ]);
    if (!prodRes.ok) throw new Error("Product not found");
    const p = await prodRes.json();
    addonGroups = addonRes.ok ? await addonRes.json() : [];
    basePrice = Number(p.basePrice);

    box.innerHTML = `
      <h2>${p.name}</h2>
      <img class="detail-img" src="${imgSrc(p.imagePath)}" alt="${p.name}"
           onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
      <p class="desc">${p.description || ""}</p>
      <div id="addon-groups">${renderGroups()}</div>
      <p class="price">Total: <span id="live-price">$${basePrice.toFixed(2)}</span></p>
      <button id="add-btn">Add to Order</button>
      <span id="add-msg"></span>
    `;

    // Recalculate price whenever any option changes.
    box.querySelectorAll(".addon-input").forEach(inp => {
      inp.addEventListener("change", recalcPrice);
    });
    document.getElementById("add-btn").addEventListener("click", addToCart);
    recalcPrice();
  } catch (err) {
    console.error(err);
    box.innerHTML = "<p>Could not load product.</p>";
  }
}

// Build the HTML for all option groups.
function renderGroups() {
  if (!addonGroups.length) return "";
  return addonGroups.map(g => {
    const inputType = g.groupType === "checkbox" ? "checkbox" : "radio";
    const required = g.isRequired ? '<span class="req">*</span>' : "";
    const opts = g.options.map((o, i) => {
      // For a required radio group, pre-select the first (usually $0) option.
      const checked = (inputType === "radio" && g.isRequired && i === 0) ? "checked" : "";
      const priceLabel = o.price > 0 ? ` (+$${o.price.toFixed(2)})` : "";
      return `
        <label class="addon-item">
          <input class="addon-input" type="${inputType}" name="group-${g.groupId}"
                 value="${o.optionId}" data-price="${o.price}" ${checked}>
          <span>${o.label}${priceLabel}</span>
        </label>`;
    }).join("");
    return `<div class="addon-group"><h4>${g.title}${required}</h4>${opts}</div>`;
  }).join("");
}

// Sum base + all checked options, times nothing (qty handled at cart).
function recalcPrice() {
  let total = basePrice;
  document.querySelectorAll(".addon-input:checked").forEach(inp => {
    total += Number(inp.dataset.price || 0);
  });
  const el = document.getElementById("live-price");
  if (el) el.textContent = `$${total.toFixed(2)}`;
}

// Which optionIds are currently selected?
function selectedOptionIds() {
  return Array.from(document.querySelectorAll(".addon-input:checked"))
    .map(inp => Number(inp.value));
}

async function addToCart() {
  const msg = document.getElementById("add-msg");
  if (!getToken()) {
    msg.textContent = "Please log in to add items.";
    return;
  }

  try {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        productId: Number(productId),
        quantity: 1,
        optionIds: selectedOptionIds()
      })
    });

    if (res.status === 401 || res.status === 403) {
      msg.textContent = "Please log in to add items.";
      return;
    }
    if (!res.ok) throw new Error("Add to cart failed");

    msg.textContent = "Added to cart \u2713";
  } catch (err) {
    console.error(err);
    msg.textContent = "Could not add to cart.";
  }
}

document.addEventListener("DOMContentLoaded", loadProduct);