// scripts/centers.js — lists all hawker centres from the API (was Firestore getDocs)
async function loadCentres() {
  const container = document.getElementById("centres-container");
  try {
    const res = await fetch("/api/centers");
    if (!res.ok) throw new Error("Failed to load centres");
    const centres = await res.json();
    centres.forEach(c => {
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `<p class="highlight">#${c.centerId}</p><p>${c.name}</p>`;
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
