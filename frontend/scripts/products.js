// scripts/products.js — lists products in a stall

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

const params = new URLSearchParams(window.location.search);
const stallId = params.get("stallId");

async function loadProducts() {
  const container = document.getElementById("products-container");
  try {
    const res = await fetch(`/api/stalls/${stallId}/products`);
    if (!res.ok) throw new Error("Failed to load products");
    const products = await res.json();

    products.forEach(p => {
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `
        <img class="item-img" src="${imgSrc(p.imagePath)}" alt="${p.name}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
        <div class="item-body">
          <p class="item-title">${p.name}</p>
          <p class="price">$${Number(p.basePrice).toFixed(2)}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        window.location.href = `product-detail.html?productId=${p.productId}`;
      });
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Could not load products.</p>";
  }
}
document.addEventListener("DOMContentLoaded", loadProducts);