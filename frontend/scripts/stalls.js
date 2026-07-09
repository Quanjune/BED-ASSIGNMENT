// scripts/stalls.js — lists stalls in a centre

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

const params = new URLSearchParams(window.location.search);
const centerId = params.get("centerId");

async function loadStalls() {
  const container = document.getElementById("stalls-container");
  try {
    const res = await fetch(`/api/centers/${centerId}/stalls`);
    if (!res.ok) throw new Error("Failed to load stalls");
    const stalls = await res.json();

    stalls.forEach(s => {
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `
        <img class="item-img" src="${imgSrc(s.imagePath)}" alt="${s.name}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
        <div class="item-body">
          <p class="item-title">${s.name}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        window.location.href = `products.html?stallId=${s.stallId}`;
      });
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Could not load stalls.</p>";
  }
}
document.addEventListener("DOMContentLoaded", loadStalls);