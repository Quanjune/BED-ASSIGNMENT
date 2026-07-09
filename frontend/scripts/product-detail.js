// scripts/product-detail.js — shows one product (was Firestore getDoc)
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
      <img src="${p.imagePath || ''}" alt="${p.name}">
      <p class="desc">${p.description || ''}</p>
      <p class="price">$${Number(p.basePrice).toFixed(2)}</p>
      <button id="add-btn">Add to Order</button>
    `;
    // Add-to-order will POST to /api/cart once that feature is built.
    document.getElementById("add-btn").addEventListener("click", () => {
      alert("Add to order will be wired up in the cart feature.");
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = "<p>Could not load product.</p>";
  }
}
document.addEventListener("DOMContentLoaded", loadProduct);
