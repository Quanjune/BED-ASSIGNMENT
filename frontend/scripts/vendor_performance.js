/* ===================================================================
   Vendor Performance  (Kishore - Vendor Management, Sprint 3)

   Read-only dashboard. One GET does everything:
     GET /api/vendors/performance?days=30   (Authorization: Bearer <token>)

   The page never sends a stallId. The backend reads it off the token,
   exactly like the menu and agreements pages.

   Charts are hand-built inline SVG - no chart library, no CDN, so the
   page still works with no internet during the demo.
   =================================================================== */

const API = "/api/vendors/performance";

const statusEl = document.getElementById("status");
const linkNote = document.getElementById("link-note");
const daysSel = document.getElementById("in-days");

// ---- helpers ------------------------------------------------------
function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "vm-status " + (type || "");
    statusEl.hidden = false;
}
function clearStatus() { statusEl.hidden = true; }

function money(v) {
    const n = Number(v);
    return isNaN(n) ? "\u2014" : "S$" + n.toFixed(2);
}
function esc(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function set(id, text) { document.getElementById(id).textContent = text; }

// "+12.4% vs previous 30 days" with a colour class.
function renderDelta(id, pct, days) {
    const el = document.getElementById(id);
    if (pct === 0) {
        el.textContent = "No change vs previous " + days + " days";
        el.className = "vp-kpi-delta flat";
        return;
    }
    const up = pct > 0;
    el.textContent = (up ? "\u25B2 +" : "\u25BC ") + pct + "% vs previous " + days + " days";
    el.className = "vp-kpi-delta " + (up ? "up" : "down");
}

// 401/403 -> session dead. Hand back to the gate (it bounces to login).
function handleAuthFail(res, data) {
    if (res.status === 401 || res.status === 403) {
        VendorAuth.showLogin((data && data.error) || "Your session has expired. Please sign in again.");
        return true;
    }
    return false;
}

// ---- charts (plain SVG) -------------------------------------------

// Vertical bar chart. rows = [{ label, value, tip }]
function barChart(rows, formatValue) {
    if (!rows.length || rows.every(r => !r.value)) {
        return '<p class="vm-empty">No sales in this period yet.</p>';
    }

    const W = 720, H = 200, PAD_B = 26, PAD_T = 12;
    const max = Math.max(...rows.map(r => r.value));
    const slot = W / rows.length;
    const barW = Math.max(3, Math.min(34, slot * 0.62));

    let bars = "";
    rows.forEach((r, i) => {
        const h = max ? ((H - PAD_T - PAD_B) * r.value) / max : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = H - PAD_B - h;
        bars += '<rect class="vp-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
                '" width="' + barW.toFixed(1) + '" height="' + Math.max(h, r.value ? 2 : 0).toFixed(1) +
                '" rx="3"><title>' + esc(r.tip) + "</title></rect>";
    });

    // Only label every Nth tick so 90 days doesn't turn into mush.
    const every = Math.ceil(rows.length / 12);
    let labels = "";
    rows.forEach((r, i) => {
        if (i % every !== 0 && i !== rows.length - 1) return;
        const x = i * slot + slot / 2;
        labels += '<text class="vp-axis" x="' + x.toFixed(1) + '" y="' + (H - 8) +
                  '" text-anchor="middle">' + esc(r.label) + "</text>";
    });

    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
           'role="img" aria-label="Bar chart">' +
           '<line class="vp-grid" x1="0" y1="' + (H - PAD_B) + '" x2="' + W + '" y2="' + (H - PAD_B) + '"/>' +
           bars + labels + "</svg>" +
           '<p class="vp-chart-peak">Peak: ' + formatValue(max) + "</p>";
}

// ---- section renderers --------------------------------------------

function renderRevenueChart(series, days) {
    const rows = series.map(p => {
        const d = new Date(p.day + "T00:00:00");
        return {
            label: d.getDate() + "/" + (d.getMonth() + 1),
            value: p.revenue,
            tip: p.day + " \u2014 " + money(p.revenue) + " from " + p.orders + " order(s)"
        };
    });
    document.getElementById("chart-revenue").innerHTML = barChart(rows, money);
}

function renderTopDishes(list) {
    const box = document.getElementById("top-dishes");
    if (!list.length) {
        box.innerHTML = '<p class="vm-empty">No dishes sold in this period yet.</p>';
        return;
    }
    const max = Math.max(...list.map(d => d.revenue));
    box.innerHTML = list.map((d, i) =>
        '<div class="vp-rank">' +
          '<span class="vp-rank-no">' + (i + 1) + "</span>" +
          '<div class="vp-rank-body">' +
            '<div class="vp-rank-top">' +
              "<span>" + esc(d.name) + "</span>" +
              "<strong>" + money(d.revenue) + "</strong>" +
            "</div>" +
            '<div class="vp-rank-bar"><i style="width:' +
              (max ? (d.revenue / max) * 100 : 0).toFixed(1) + '%"></i></div>' +
            '<div class="vp-rank-sub">' + d.qty + " sold</div>" +
          "</div>" +
        "</div>"
    ).join("");
}

function renderPeakHours(hours) {
    const box = document.getElementById("peak-hours");
    if (!hours.length) {
        box.innerHTML = '<p class="vm-empty">No orders in this period yet.</p>';
        return;
    }
    // Fill 0-23 so the shape of the trading day is visible.
    const byHour = {};
    hours.forEach(h => { byHour[h.hour] = h; });
    const rows = [];
    for (let h = 0; h < 24; h++) {
        const r = byHour[h];
        rows.push({
            label: String(h).padStart(2, "0"),
            value: r ? r.orders : 0,
            tip: String(h).padStart(2, "0") + ":00 \u2014 " +
                 (r ? r.orders + " order(s), " + money(r.revenue) : "no orders")
        });
    }
    box.innerHTML = barChart(rows, v => v + " orders");
}

function renderRatings(r) {
    const box = document.getElementById("ratings");
    if (!r) {
        box.innerHTML = '<p class="vm-empty">Ratings are not available yet \u2014 the Feedback table has not been added to this database.</p>';
        return;
    }
    if (!r.total) {
        box.innerHTML = '<p class="vm-empty">No customer ratings yet.</p>';
        return;
    }
    const stars = "\u2605".repeat(Math.round(r.avgRating)) +
                  "\u2606".repeat(5 - Math.round(r.avgRating));
    let bars = "";
    for (let s = 5; s >= 1; s--) {
        const n = r.breakdown[s] || 0;
        const pct = r.total ? (n / r.total) * 100 : 0;
        bars += '<div class="vp-star-row"><span>' + s + "\u2605</span>" +
                '<div class="vp-rank-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
                "<span>" + n + "</span></div>";
    }
    box.innerHTML =
        '<div class="vp-score"><span class="vp-score-num">' + r.avgRating.toFixed(1) + "</span>" +
        '<span class="vp-score-stars">' + stars + "</span>" +
        '<span class="vp-score-sub">' + r.total + " review(s)</span></div>" + bars;
}

function renderReviews(list) {
    const box = document.getElementById("reviews");
    if (!list.length) {
        box.innerHTML = '<p class="vm-empty">No reviews yet.</p>';
        return;
    }
    box.innerHTML = list.map(f =>
        '<div class="vp-review">' +
          '<div class="vp-review-head">' +
            '<span class="vp-review-stars">' + "\u2605".repeat(f.rating) + "\u2606".repeat(5 - f.rating) + "</span>" +
            '<span class="vp-review-date">' + new Date(f.createdAt).toLocaleDateString("en-SG") + "</span>" +
          "</div>" +
          "<p>" + esc(f.comment || "(no comment left)") + "</p>" +
        "</div>"
    ).join("");
}

function renderMenu(m, complaints) {
    const box = document.getElementById("menu-snapshot");
    let html =
        '<div class="vp-stats">' +
          '<div><span>' + m.itemCount + "</span><small>dishes on menu</small></div>" +
          "<div><span>" + money(m.avgPrice).replace("S$", "$") + "</span><small>average price</small></div>" +
          "<div><span>" + m.totalLikes + "</span><small>total likes</small></div>" +
        "</div>";
    if (m.mostLiked) {
        html += '<p class="vp-line">Most liked: <strong>' + esc(m.mostLiked.name) +
                "</strong> (" + m.mostLiked.likes + " likes)</p>";
    }
    if (complaints) {
        const cls = complaints.open > 0 ? "danger" : "ok";
        html += '<p class="vp-line">Complaints: <span class="vm-badge ' + cls + '">' +
                complaints.open + " open</span> \u00b7 " + complaints.resolved + " resolved</p>";
    }
    box.innerHTML = html;
}

function renderCompliance(c) {
    const box = document.getElementById("compliance");
    const bits = [];

    if (c.grade) {
        bits.push('<p class="vp-line">Hygiene grade: <span class="vm-badge ' +
            (c.grade.grade === "A" ? "ok" : c.grade.grade === "B" ? "warn" : "danger") +
            '">' + esc(c.grade.grade) + "</span> valid to " +
            new Date(c.grade.validTo).toLocaleDateString("en-SG") + "</p>");
    }
    if (c.lastInspection) {
        bits.push('<p class="vp-line">Last inspection score: <strong>' + c.lastInspection.score +
            "</strong> on " + new Date(c.lastInspection.completedDate).toLocaleDateString("en-SG") + "</p>");
    }
    if (c.nextExpiry) {
        const d = c.nextExpiry.daysToExpiry;
        const cls = d < 0 ? "danger" : d <= 30 ? "warn" : "ok";
        const txt = d < 0 ? "Expired" : d + " days left";
        bits.push('<p class="vp-line">Next document due: <strong>' + esc(c.nextExpiry.name) +
            "</strong> <span class=\"vm-badge " + cls + '">' + txt + "</span></p>");
    }
    if (c.expiringCount) {
        bits.push('<p class="vp-line"><a href="./vendor_agreements.html">' + c.expiringCount +
            " document(s) need attention \u2192</a></p>");
    }

    box.innerHTML = bits.length
        ? bits.join("")
        : '<p class="vm-empty">No inspection or document records for this stall yet.</p>';
}

// ---- load ---------------------------------------------------------
async function loadDashboard() {
    clearStatus();
    const days = Number(daysSel.value);

    try {
        const res = await VendorAuth.authFetch(API + "?days=" + days);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (handleAuthFail(res, data)) return;
            showStatus(data.error || "Couldn't load your dashboard (" + res.status + ").", "err");
            return;
        }

        // KPIs
        set("kpi-revenue", money(data.sales.revenue));
        set("kpi-orders", data.sales.orderCount);
        set("kpi-items", data.sales.itemsSold);
        set("kpi-aov", money(data.sales.avgOrderValue));
        renderDelta("kpi-revenue-delta", data.sales.change.revenue, days);
        renderDelta("kpi-orders-delta", data.sales.change.orders, days);
        renderDelta("kpi-items-delta", data.sales.change.items, days);
        set("kpi-aov-sub", "across " + data.sales.orderCount + " order(s)");

        // Sections
        renderRevenueChart(data.series, days);
        renderTopDishes(data.topDishes);
        renderPeakHours(data.peakHours);
        renderRatings(data.ratings);
        renderReviews(data.recentReviews);
        renderMenu(data.menu, data.complaints);
        renderCompliance(data.compliance);

        // Be honest about how the sales figures were linked to this stall.
        if (data.salesLink && !data.salesLink.exact) {
            linkNote.textContent = data.salesLink.note;
            linkNote.hidden = false;
        } else {
            linkNote.hidden = true;
        }
    } catch (e) {
        showStatus("Couldn't reach the server. Is the backend running?", "err");
    }
}

// ---- start --------------------------------------------------------
daysSel.addEventListener("change", loadDashboard);
VendorAuth.initVendorGate({ onReady: loadDashboard });