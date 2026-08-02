// weatherService.js  (Kaden - NEA inspections)
// Third-party API: Singapore's 4-day weather outlook from data.gov.sg.
//
// WHY A "SERVICE" AND NOT A MODEL
//   Everything in models/ talks to our SQL Server. This talks to somebody
//   else's server over HTTP, so it does not belong there. Keeping it in its
//   own folder makes the boundary obvious: if data.gov.sg changes its
//   response, exactly one file has to change.
//
// WHY WEATHER
//   Hawker centres are open-air and an inspection is a physical site visit.
//   An officer picking a date wants to know if thundery showers are forecast,
//   the same way they would check before any outdoor job.
//
// NO API KEY
//   data.gov.sg's real-time endpoints are open, so there is nothing to store
//   in .env and nothing secret to leak.
//
// THE RESPONSE (trimmed - this is what the real API returns)
//   {
//     "code": 0,
//     "data": { "records": [ {
//        "date": "2026-08-02",
//        "forecasts": [ {
//           "timestamp": "2026-08-03T00:00:00+08:00",
//           "day": "Sunday",
//           "temperature": { "low": 26, "high": 34, "unit": "Degrees Celsius" },
//           "forecast": { "code": "TL", "text": "Thundery Showers",
//                         "summary": "Afternoon thundery showers" },
//           "relativeHumidity": { "low": 60, "high": 90 },
//           "wind": { "direction": "SSE", "speed": { "low": 10, "high": 20 } }
//        } ]
//     } ] }
//   }
//
//   Note the shape is deeply nested and the useful fields sit four levels
//   down. normalise() flattens it so the rest of the app never has to know
//   any of that.

const API_URL = "https://api-open.data.gov.sg/v2/real-time/api/four-day-outlook";

// If data.gov.sg is slow, the officer should not sit staring at a spinner.
// Five seconds is generous for a small JSON response.
const TIMEOUT_MS = 5000;

// Forecast codes that mean an officer may want a different day. Taken from
// the "code" field, which is more reliable than matching on the English text.
const WET_CODES = ["TL", "TS", "SH", "RA", "HG", "HR", "LR", "PS", "ST", "WR"];

// One forecast entry, flattened to just what the scheduling page shows.
function normalise(entry) {
  // The timestamp is already in Singapore time (+08:00), so the first ten
  // characters are the local calendar date. Using new Date() here would risk
  // shifting the day when the server runs in a different timezone.
  const date = entry.timestamp.slice(0, 10);

  return {
    date,
    day: entry.day,
    forecast: entry.forecast.text,
    summary: entry.forecast.summary || entry.forecast.text,
    code: entry.forecast.code,
    tempLow: entry.temperature.low,
    tempHigh: entry.temperature.high,
    humidityHigh: entry.relativeHumidity ? entry.relativeHumidity.high : null,
    // Worked out here rather than in the browser so the rule lives in one place.
    wet: WET_CODES.includes(entry.forecast.code),
  };
}

// GET the outlook and return it as a flat array, soonest first.
// Throws on network failure or a bad response - the caller decides what that
// should mean for the user.
async function getFourDayOutlook() {
  // Node 18+ has fetch built in, so there is no extra package to install.
  // AbortSignal.timeout aborts the request rather than letting it hang.
  const res = await fetch(API_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!res.ok) {
    throw new Error(`data.gov.sg replied ${res.status}`);
  }

  const body = await res.json();

  // Their own status field. 0 means success; anything else is an error even
  // though the HTTP status was 200.
  if (body.code !== 0) {
    throw new Error(body.errorMsg || "data.gov.sg returned an error code");
  }

  const records = body.data && body.data.records;
  if (!Array.isArray(records) || !records.length) {
    throw new Error("data.gov.sg returned no forecast records");
  }

  return records[0].forecasts.map(normalise);
}

// The forecast for one specific date, or null if that date is outside the
// four-day window. Null is not an error - it is the normal answer for an
// inspection booked three weeks out.
async function getForecastForDate(isoDate) {
  const outlook = await getFourDayOutlook();
  return outlook.find((f) => f.date === isoDate) || null;
}

module.exports = { getFourDayOutlook, getForecastForDate };