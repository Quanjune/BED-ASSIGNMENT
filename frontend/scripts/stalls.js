// scripts/stalls.js — lists stalls in a centre
//
// Each card carries four extra things on top of the photo + name:
//   * an NEA hygiene grade badge (GET /api/hygiene-grades/current)
//   * a star rating              (GET /api/feedback/stall-ratings)
//   * a promo tag                (GET /api/promos/active, counted per stall)
//   * Review / Report buttons that jump to the right page with the stall
//     already chosen, so nobody has to re-pick it from a dropdown
//
// All three extra fetches happen ONCE for the whole page, not once per card.
// If any of them fails the cards still render - the stall list is the
// important part, the badges are a bonus.

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

// -> Map of stallId : { grade, validTo, isCurrent, daysUntilExpiry }
//
// Kaden's endpoint already returns ONE row per stall (the newest grade), and
// it is deliberately public - a hygiene grade is public information under the
// NEA scheme - so no Authorization header is needed here.
async function loadHygieneGrades() {
  try {
    const res = await fetch("/api/hygiene-grades/current");
    if (!res.ok) throw new Error("hygiene grades unavailable");
    const rows = await res.json();
    const map = new Map();
    rows.forEach((g) => map.set(g.stallId, g));
    return map;
  } catch (err) {
    console.error(err);
    return new Map();   // no badges shown, page still works
  }
}

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

// Build the NEA grade badge, e.g. a green "A".
//
// A stall with no grade row at all gets nothing rather than an empty box -
// a missing grade is not the same as a bad one, and inventing a placeholder
// would be misleading on a page about food hygiene.
//
// isCurrent comes back from SQL as 1/0. When it is 0 the grade has expired,
// so the badge is greyed out and labelled instead of being shown as if it
// were still valid.
function gradeHtml(entry) {
  if (!entry || !entry.grade) return "";

  const grade = escapeHtml(entry.grade);
  const expired = !entry.isCurrent;
  const cssClass = expired ? "grade-expired" : `grade-${grade.toLowerCase()}`;
  const title = expired
    ? `Hygiene grade ${grade} (expired)`
    : `NEA hygiene grade ${grade}`;

  return `<p class="item-grade">
            <span class="grade-badge ${cssClass}" title="${title}">${grade}</span>
            <span class="grade-label">${expired ? "Grade expired" : "Hygiene grade"}</span>
          </p>`;
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
    // Kick off all four requests together rather than one after another.
    const [res, grades, ratings, promoCounts] = await Promise.all([
      fetch(`/api/centers/${centerId}/stalls`),
      loadHygieneGrades(),
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
          ${gradeHtml(grades.get(s.stallId))}
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