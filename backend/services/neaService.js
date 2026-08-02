// neaService.js  (Aswin - third-party API)
// Fetches the live NEA "Hawker Centres" dataset from data.gov.sg (Singapore's
// open-data portal) and caches it briefly so we don't call the government API
// on every page load.
//
// This is a THIRD-PARTY API invoked from the BACK-END (not the browser):
//   browser -> our /api/admin/nea/hawker-centres -> here -> data.gov.sg
// Doing it server-side avoids CORS, lets us trim/reshape the data, and keeps
// the front-end talking only to our own API.

const DATASET_URL =
  "https://data.gov.sg/api/action/datastore_search" +
  "?resource_id=d_68a42f09f350881996d83f9cd73ab02f&limit=500";

let cache = { data: null, at: 0 };
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

async function fetchHawkerCentres() {
  // Serve a fresh cached copy if we have one.
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.data, cached: true };
  }

  // Abort if data.gov.sg is too slow, so our request never hangs.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(DATASET_URL, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`data.gov.sg responded ${res.status}`);

  const json = await res.json();
  const records = (json.result && json.result.records) || [];

  // Keep only the fields we show, with tidy names and real numbers.
  const centres = records.map((r) => ({
    name: r.name_of_centre,
    location: r.location_of_centre,
    type: r.type_of_centre,
    owner: r.owner,
    stalls: Number(r.no_of_stalls) || 0,
    cookedFoodStalls: Number(r.no_of_cooked_food_stalls) || 0,
  }));

  const summary = {
    totalCentres: centres.length,
    totalStalls: centres.reduce((s, c) => s + c.stalls, 0),
    totalCookedFoodStalls: centres.reduce((s, c) => s + c.cookedFoodStalls, 0),
  };

  const result = { source: "data.gov.sg (NEA)", summary, centres };
  cache = { data: result, at: Date.now() };
  return { ...result, cached: false };
}

module.exports = { fetchHawkerCentres };
