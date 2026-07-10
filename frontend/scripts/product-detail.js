// scripts/product-detail.js — shows one product

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

const params = new URLSearchParams(window.location.search);
const productId = params.get("productId");

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
    `;

    document.getElementById("add-btn").addEventListener("click", () => {
      alert("Add to order will be wired up in the cart feature.");
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = "<p>Could not load product.</p>";
  }
}
document.addEventListener("DOMContentLoaded", loadProduct);