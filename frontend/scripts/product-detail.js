// scripts/product-detail.js — shows one product and adds it to the cart

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

const params = new URLSearchParams(window.location.search);
const productId = params.get("productId");

// The cart is per-user, so adding needs the login token (stored by the
// login page in localStorage as "accessToken"). Same approach as cart.js.
function getToken() {
  return localStorage.getItem("accessToken");
}

async function loadProduct() {
  const box = document.getElementById("product-detail");
  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) throw new Error("Product not found");
    const p = await res.json();

    box.innerHTML = `
      <h2>${p.name}</h2>
      <img class="detail-img" src="${imgSrc(p.imagePath)}" alt="${p.name}"
           onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
      <p class="desc">${p.description || ""}</p>
      <p class="price">$${Number(p.basePrice).toFixed(2)}</p>
      <button id="add-btn">Add to Order</button>
      <span id="add-msg"></span>
    `;

    document.getElementById("add-btn").addEventListener("click", addToCart);
  } catch (err) {
    console.error(err);
    box.innerHTML = "<p>Could not load product.</p>";
  }
}

async function addToCart() {
  const msg = document.getElementById("add-msg");

  // Must be logged in to have a cart.
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
      body: JSON.stringify({ productId: Number(productId), quantity: 1 })
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