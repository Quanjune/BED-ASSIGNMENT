// scripts/promotions.js — CUSTOMER view of the promo codes.
//
// This page is read-only on purpose. Creating and editing codes now lives on
// vendor_promotions.html, behind the vendor login, because codes belong to a
// stall and only that stall's owner (or an admin) may change them.
//
// One endpoint, no login needed:
//   GET /api/promos/active   -> only codes that work RIGHT NOW
// The server already filters out anything switched off, expired or fully
// redeemed, so whatever arrives here is safe to show as usable.

const listDiv = document.getElementById("promo-list");

// Escape user-entered text so it cannot inject HTML into the page
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}

// Turn a stored discount into readable text: 5 -> "$5 off", 10 -> "10% off"
function discountText(type, value) {
    const n = Number(value);
    return type === "percent" ? `${n}% off` : `$${n} off`;
}

// "Where can I use this?" - platform-wide codes have no stall attached.
function scopeText(promo) {
    if (promo.stallId == null) return "Works at any stall";
    const centre = promo.centerName ? ` &middot; ${escapeHtml(promo.centerName)}` : "";
    return `${escapeHtml(promo.stallName)}${centre}`;
}

// How many uses are left, so people know when a code is nearly gone.
function remainingText(promo) {
    const left = promo.usageLimit - promo.timesUsed;
    if (left <= 5) return `Only ${left} left`;
    return `${left} uses left`;
}

// ---------- READ: load and display the usable codes ----------
async function loadPromos() {
    try {
        const response = await fetch("/api/promos/active");
        if (!response.ok) throw new Error("Server returned " + response.status);
        const promos = await response.json();

        if (promos.length === 0) {
            listDiv.innerHTML = "<p class='empty'>No promotions running right now. Check back soon.</p>";
            return;
        }

        listDiv.innerHTML = "";
        promos.forEach((promo) => {
            const expiry = new Date(promo.expiryDate).toLocaleDateString();
            const card = document.createElement("div");
            card.className = "card promo-card";
            card.innerHTML = `
                <div class="promo-head">
                    <strong>${escapeHtml(promo.code)}</strong>
                    <span class="badge ${promo.stallId == null ? "sitewide" : "stall"}">
                        ${promo.stallId == null ? "Sitewide" : "Stall deal"}
                    </span>
                </div>
                <p class="promo-discount">${discountText(promo.discountType, promo.discountValue)}</p>
                <p class="promo-meta">${scopeText(promo)}</p>
                <p class="promo-meta">Valid until ${expiry} &middot; ${remainingText(promo)}</p>
                <div class="card-actions">
                    <button type="button" class="copy-btn" data-code="${escapeHtml(promo.code)}">Copy code</button>
                </div>
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        listDiv.innerHTML = "<p class='error-box'>Could not load promotions. Is the server running?</p>";
    }
}

// ---------- Copy to clipboard (event delegation on the list) ----------
listDiv.addEventListener("click", async (event) => {
    const button = event.target.closest(".copy-btn");
    if (!button) return;

    const code = button.dataset.code;
    const original = button.textContent;
    try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied!";
    } catch {
        // clipboard API needs a secure context (https or localhost); if it is
        // blocked, select the text instead so the user can copy it manually
        button.textContent = "Press Ctrl+C";
        const range = document.createRange();
        range.selectNodeContents(button.closest(".promo-card").querySelector("strong"));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
    button.classList.add("copied");
    setTimeout(() => {
        button.textContent = original;
        button.classList.remove("copied");
    }, 1600);
});

// Initial load when the page opens
loadPromos();