// scripts/stalls.js — lists stalls in a centre
//
// Each card now carries three extra things on top of the photo + name:
//   * a star rating   (GET /api/feedback/stall-ratings)
//   * a promo tag     (GET /api/promos/active, counted per stall)
//   * Review / Report buttons that jump to the right page with the stall
//     already chosen, so nobody has to re-pick it from a dropdown
//
// Both extra fetches happen ONCE for the whole page, not once per card.
// If either fails the cards still render - the stall list is the important
// part, the badges are a bonus.

function imgSrc(path) {
  return path ? encodeURI(path) : "";
}
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

const params = new URLSearchParams(window.location.search);
const centerId = params.get("centerId");

// Escape anything that came from the database before putting it in HTML.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

// ---------- extra data for the cards ----------

// -> Map of stallId : { avgRating, reviewCount }
async function loadRatings() {
  try {
    const res = await fetch("/api/feedback/stall-ratings");
    if (!res.ok) throw new Error("ratings unavailable");
    const rows = await res.json();
    const map = new Map();
    rows.forEach((r) => map.set(r.stallId, r));
    return map;
  } catch (err) {
    console.error(err);
    return new Map();   // no ratings shown, page still works
  }
}

// -> Map of stallId : number of active codes for that stall
// Platform-wide codes (stallId null) are skipped: they are not "this stall's".
async function loadPromoCounts() {
  try {
    const res = await fetch("/api/promos/active");
    if (!res.ok) throw new Error("promos unavailable");
    const promos = await res.json();
    const map = new Map();
    promos.forEach((p) => {
      if (p.stallId == null) return;   // defensive: no sitewide codes exist any more
      map.set(p.stallId, (map.get(p.stallId) || 0) + 1);
    });
    return map;
  } catch (err) {
    console.error(err);
    return new Map();
  }
}

// Build the "★ 4.5 (12)" line, or an invitation when nobody has reviewed yet.
function ratingHtml(entry) {
  if (!entry || !entry.reviewCount) {
    return `<p class="item-rating item-rating-empty">No reviews yet</p>`;
  }
  const rounded = Math.round(entry.avgRating);
  const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
  return `<p class="item-rating">
            <span class="stars">${stars}</span>
            <span class="rating-value">${entry.avgRating.toFixed(1)}</span>
            <span class="rating-count">(${entry.reviewCount})</span>
          </p>`;
}

// ---------- main render ----------
async function loadStalls() {
  const container = document.getElementById("stalls-container");
  try {
    // Kick off all three requests together rather than one after another.
    const [res, ratings, promoCounts] = await Promise.all([
      fetch(`/api/centers/${centerId}/stalls`),
      loadRatings(),
      loadPromoCounts(),
    ]);
    if (!res.ok) throw new Error("Failed to load stalls");
    const stalls = await res.json();

    stalls.forEach((s) => {
      const promoCount = promoCounts.get(s.stallId) || 0;
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `
        <img class="item-img" src="${imgSrc(s.imagePath)}" alt="${escapeHtml(s.name)}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
        <div class="item-body">
          <p class="item-title">${escapeHtml(s.name)}</p>
          ${ratingHtml(ratings.get(s.stallId))}
          ${promoCount ? `<p class="item-promo">🏷 ${promoCount} promo${promoCount > 1 ? "s" : ""}</p>` : ""}
          <div class="item-actions">
            <button type="button" class="card-btn review-btn" data-stall="${s.stallId}">★ Review</button>
            <button type="button" class="card-btn report-btn" data-stall="${s.stallId}">⚠ Report</button>
          </div>
        </div>
      `;

      // Clicking the card opens the menu...
      card.addEventListener("click", () => {
        window.location.href = `products.html?stallId=${s.stallId}`;
      });

      // ...but the two buttons must NOT also trigger that. stopPropagation
      // keeps the click from bubbling up to the card handler above.
      card.querySelector(".review-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        // Reviews are readable by guests, so no login gate here.
        window.location.href = `feedback.html?centerId=${centerId}&stallId=${s.stallId}`;
      });

      card.querySelector(".report-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        const target = `complaints.html?centerId=${centerId}&stallId=${s.stallId}`;
        // Complaints must be attributable, so guests are sent to log in first
        // and bounced back here afterwards.
        if (window.Session && !Session.isLoggedIn()) {
          Session.goLogin(target);
          return;
        }
        window.location.href = target;
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Could not load stalls.</p>";
  }
}
document.addEventListener("DOMContentLoaded", loadStalls);