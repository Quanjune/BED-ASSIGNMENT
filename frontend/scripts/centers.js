// scripts/centers.js — lists all hawker centres from the API

// Image paths from the DB contain spaces (e.g. "maxwell _food_center").
// encodeURI() turns them into %20 so the browser can fetch them.
function imgSrc(path) {
  return path ? encodeURI(path) : "";
}

// Fallback shown if an image is missing or fails to load.
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

async function loadCentres() {
  const container = document.getElementById("centres-container");
  try {
    const res = await fetch("/api/centers");
    if (!res.ok) throw new Error("Failed to load centres");
    const centres = await res.json();

    centres.forEach(c => {
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `
        <img class="item-img" src="${imgSrc(c.imagePath)}" alt="${c.name}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
        <div class="item-body">
          <p class="item-title">${c.name}</p>
          <p class="item-sub">${c.location || ""}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        window.location.href = `stalls.html?centerId=${c.centerId}`;
      });
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Could not load hawker centres.</p>";
  }
}
document.addEventListener("DOMContentLoaded", loadCentres);