// models/weatherModel.js  (Quan Jun - customer-facing third-party API)
//
// Wraps NEA's *2-hour* weather forecast, published on data.gov.sg, and matches
// each forecast area to a hawker centre so the customer pages can show live
// weather.
//
// NOTE ON THE TEAM: Kaden also uses data.gov.sg weather, but a DIFFERENT
// endpoint (the 4-day outlook) for a DIFFERENT purpose (letting an officer
// avoid booking an inspection on a wet day). This file is the customer side:
// the 2-hour forecast, so a diner knows whether it is raining at the centre
// they are about to collect from. Two endpoints, two audiences, two files -
// they do not touch each other. Kaden's lives in backend/services/, this lives
// in backend/models/, and they mount on different routes.
//
// Node 18+ ships fetch() globally, so no axios / node-fetch dependency is
// needed (this project is on Node 22).
//
// The API needs no key: a weather forecast is public information, the same
// reasoning Kaden used and the same reasoning behind public hygiene-grade reads.

// data.gov.sg keeps two generations of this endpoint live at once. v2 is the
// current one; v1 is the older path. We try v2, then fall back to v1, so the
// feature does not die the day one path is retired.
const PRIMARY_URL  = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast";
const FALLBACK_URL = "https://api.data.gov.sg/v1/environment/2-hour-weather-forecast";

// How long a fetched forecast is reused before we go back to NEA.
// NEA only refreshes this forecast every half hour, so calling them on every
// page load is pure waste - four diners opening the centres page would fire
// four identical requests for data that cannot have changed. Ten minutes keeps
// the display fresh while cutting outbound calls by roughly 99%.
const CACHE_MS = 10 * 60 * 1000;

// Give up on a slow response rather than leaving the customer on a spinner.
const TIMEOUT_MS = 5000;

// ------------------------------------------------------------
// WHERE OUR CENTRES ARE
// ------------------------------------------------------------
// HawkerCenters stores a street address, not coordinates, and NEA works in
// coordinates. Rather than hardcode a guessed area NAME per centre (which
// breaks silently the day NEA renames or splits an area), we store each
// centre's lat/long once and pick the nearest forecast area at runtime from
// the coordinates NEA itself publishes.
//
// If a fifth centre is added to the database, add its coordinates here. A
// centre missing from this table simply gets no forecast - it never breaks
// the page.
const CENTER_COORDS = {
  1: { lat: 1.2803, lng: 103.8449 }, // Maxwell Food Centre
  2: { lat: 1.3083, lng: 103.8855 }, // Old Airport Road Food Centre
  3: { lat: 1.2826, lng: 103.8434 }, // Chinatown Complex Market
  4: { lat: 1.2851, lng: 103.8325 }, // Tiong Bahru Market
};

// Module-level cache, shared across every request the server handles.
let cache = { fetchedAt: 0, forecasts: null };

// Distance between two lat/long points (Haversine). Singapore is small enough
// that plain Pythagoras would do, but this is correct anywhere and costs
// nothing - we run it only a handful of times per refresh.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pull the two arrays we care about out of the response. v2 nests them under
// `data`; v1 puts them at the top level. Reading both here means the rest of
// the file never has to care which one answered.
function normalise(json) {
  const root = json && json.data ? json.data : json;
  if (!root) return null;

  const areas = root.area_metadata || [];
  const items = root.items || [];
  const forecasts = items[0] ? items[0].forecasts || [] : [];
  if (areas.length === 0 || forecasts.length === 0) return null;

  const byArea = new Map();
  forecasts.forEach((f) => byArea.set(f.area, f.forecast));

  const merged = [];
  areas.forEach((a) => {
    const loc = a.label_location;
    const forecast = byArea.get(a.name);
    if (!loc || !forecast) return;
    merged.push({
      area: a.name,
      lat: Number(loc.latitude),
      lng: Number(loc.longitude),
      forecast,
    });
  });

  return merged.length ? merged : null;
}

// Fetch from NEA, honouring the cache. Returns null (never throws) if the
// forecast cannot be obtained - callers treat "no weather" as normal.
async function fetchForecasts() {
  if (cache.forecasts && Date.now() - cache.fetchedAt < CACHE_MS) {
    return cache.forecasts;
  }

  for (const url of [PRIMARY_URL, FALLBACK_URL]) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`Weather API ${url} responded ${res.status}`);
        continue;
      }
      const parsed = normalise(await res.json());
      if (!parsed) {
        console.error(`Weather API ${url} returned an unexpected shape`);
        continue;
      }
      cache = { fetchedAt: Date.now(), forecasts: parsed };
      return parsed;
    } catch (err) {
      console.error(`Weather API ${url} failed:`, err.message);
    }
  }

  // Both endpoints failed. A slightly stale forecast beats nothing, so serve
  // the last good copy if we have one.
  if (cache.forecasts) {
    console.error("Weather API unreachable - serving stale cached forecast.");
    return cache.forecasts;
  }
  return null;
}

// Is this forecast something to warn the customer about? Matching on the words
// rather than an exact list means an unseen phrase is still classified right.
function isWetForecast(text) {
  return /rain|shower|thunder/i.test(text || "");
}

// PUBLIC: forecast for every centre we have coordinates for.
async function getForecastsForCenters() {
  const forecasts = await fetchForecasts();
  if (!forecasts) return [];

  const results = [];
  for (const [centerId, coords] of Object.entries(CENTER_COORDS)) {
    let nearest = null;
    let nearestKm = Infinity;
    forecasts.forEach((f) => {
      const km = distanceKm(coords.lat, coords.lng, f.lat, f.lng);
      if (km < nearestKm) { nearestKm = km; nearest = f; }
    });
    if (!nearest) continue;

    results.push({
      centerId: Number(centerId),
      area: nearest.area,
      forecast: nearest.forecast,
      isWet: isWetForecast(nearest.forecast),
      distanceKm: Math.round(nearestKm * 10) / 10,
      updatedAt: new Date(cache.fetchedAt).toISOString(),
    });
  }
  return results;
}

// PUBLIC: forecast for one centre. Used by the cart page at checkout.
async function getForecastForCenter(centerId) {
  const all = await getForecastsForCenters();
  return all.find((f) => f.centerId === Number(centerId));
}

module.exports = { getForecastsForCenters, getForecastForCenter };