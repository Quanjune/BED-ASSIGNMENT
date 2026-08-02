// scripts/centers.js — lists all hawker centres from the API
//
// Each card also carries a live weather chip, fed by NEA's 2-hour forecast
// through our own /api/weather/centers endpoint. The forecast is fetched ONCE
// for the whole page (not once per card), and if it fails the cards still
// render — the centre list is the point, the chip is a bonus.

// Image paths from the DB contain spaces (e.g. "maxwell _food_center").
// encodeURI() turns them into %20 so the browser can fetch them.
function imgSrc(path) {
  return path ? encodeURI(path) : "";
}

// Fallback shown if an image is missing or fails to load.
const PLACEHOLDER = "../media/icons/hawker_icon.svg";

// Escape anything from the DB or a third-party server before putting it in HTML.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

// -> Map of centerId : { area, forecast, isWet }
// Calls OUR backend, not data.gov.sg directly: the outbound call happens
// server-side (which is what the assignment asks for) and the response is
// cached for every visitor instead of each browser fetching its own copy.
async function loadWeather() {
  try {
    const res = await fetch("/api/weather/centers");
    if (!res.ok) throw new Error("weather unavailable");
    const rows = await res.json();
    const map = new Map();
    rows.forEach((w) => map.set(w.centerId, w));
    return map;
  } catch (err) {
    console.error(err);
    return new Map();   // no chips shown, page still works
  }
}

// Pick an icon for the forecast text. NEA returns phrases like "Partly Cloudy
// (Day)", "Light Rain", "Thundery Showers" — match on keywords so an unseen
// phrase still gets a sensible icon.
function weatherIcon(forecast) {
  const text = (forecast || "").toLowerCase();
  if (text.includes("thunder")) return "⛈️";
  if (text.includes("rain") || text.includes("shower")) return "🌧️";
  if (text.includes("cloudy") || text.includes("overcast")) return "☁️";
  if (text.includes("hazy") || text.includes("mist") || text.includes("fog")) return "🌫️";
  if (text.includes("windy")) return "💨";
  return "☀️";
}

// Build the weather chip, or nothing when we have no forecast for this centre.
function weatherHtml(entry) {
  if (!entry || !entry.forecast) return "";
  const icon = weatherIcon(entry.forecast);
  const wetClass = entry.isWet ? " weather-wet" : "";
  return `<p class="item-weather${wetClass}" title="NEA 2-hour forecast for ${escapeHtml(entry.area)}">
            <span class="weather-icon">${icon}</span>
            <span class="weather-text">${escapeHtml(entry.forecast)}</span>
          </p>`;
}

async function loadCentres() {
  const container = document.getElementById("centres-container");
  try {
    // Kick off both requests together rather than one after another.
    const [res, weather] = await Promise.all([
      fetch("/api/centers"),
      loadWeather(),
    ]);
    if (!res.ok) throw new Error("Failed to load centres");
    const centres = await res.json();

    centres.forEach(c => {
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `
        <img class="item-img" src="${imgSrc(c.imagePath)}" alt="${escapeHtml(c.name)}"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}';">
        <div class="item-body">
          <p class="item-title">${escapeHtml(c.name)}</p>
          <p class="item-sub">${escapeHtml(c.location || "")}</p>
          ${weatherHtml(weather.get(c.centerId))}
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