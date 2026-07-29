// scripts/complaints.js — Complaints page logic (Customer component)
// Talks to the back-end REST API:
//   GET    /api/complaints                 the full list (public)
//   GET    /api/complaints/stall/:stallId  one stall's complaints
//   POST   /api/complaints                 login required
//   PUT    /api/complaints/:id             stall's vendor, or admin
//   DELETE /api/complaints/:id             author, or admin
//   GET /api/centers, /api/centers/:id/stalls   (Quan Jun's, reused for dropdowns)
//
// WHAT CHANGED
// 1. ?stallId= in the URL (from the stall card's "Report" button) pre-selects
//    the centre + stall, so the stall is already chosen.
// 2. Guests can still READ the list, but get a sign-in prompt instead of the form.
// 3. "Mark Resolved" only shows for the stall's own vendor or an admin;
//    "Delete" only on your own complaint. The server enforces both.

const form = document.getElementById("complaint-form");
const formCard = document.getElementById("form-card");
const guestNotice = document.getElementById("guest-notice");
const guestLoginLink = document.getElementById("guest-login-link");
const formMessage = document.getElementById("form-message");
const listDiv = document.getElementById("complaint-list");
const centerSelect = document.getElementById("centerId");
const stallSelect = document.getElementById("stallId");
const userIdInput = document.getElementById("userId");
const fieldCenter = document.getElementById("field-center");
const fieldStall = document.getElementById("field-stall");
const fieldLocked = document.getElementById("field-locked");
const lockedStallName = document.getElementById("locked-stall-name");
const changeStallLink = document.getElementById("change-stall");

// Stall passed in from the stalls page, e.g. complaints.html?centerId=1&stallId=3
const params = new URLSearchParams(window.location.search);
const presetCenterId = params.get("centerId");
const presetStallId = params.get("stallId");

// Escape user-entered text so it cannot inject HTML into the page
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}

// ---------- Who is looking at this page? ----------
// session.js should provide window.Session. If it failed to load (missing file,
// 404, wrong path) we must NOT quietly treat a signed-in user as a guest - that
// hides the form from people who are actually logged in. So fall back to reading
// localStorage directly and say loudly in the console what went wrong.
if (!window.Session) {
    console.error(
        "session.js did not load - falling back to localStorage. " +
        "Check that frontend/scripts/session.js exists and is included before this script."
    );
    window.Session = {
        getToken() { return localStorage.getItem("token"); },
        getUser() {
            try { return JSON.parse(localStorage.getItem("user") || "null"); }
            catch { return null; }
        },
        isLoggedIn() { return Boolean(localStorage.getItem("token")); },
        isRole(role) { const u = this.getUser(); return Boolean(u && u.role === role); },
        authHeaders() {
            const t = this.getToken();
            return t ? { Authorization: "Bearer " + t } : {};
        },
        jsonHeaders() {
            return Object.assign({ "Content-Type": "application/json" }, this.authHeaders());
        },
        goLogin(returnTo) {
            const target = returnTo ||
                (window.location.pathname.split("/").pop() + window.location.search);
            window.location.href = "login.html?next=" + encodeURIComponent(target);
        },
    };
}

const currentUser = Session.getUser();
const loggedIn = Session.isLoggedIn();

// A vendor's own stallId, looked up once so we know which complaints they may
// resolve. Customers/admins/guests leave this null.
let myStallId = null;

async function loadMyStall() {
    if (!loggedIn || !currentUser || currentUser.role !== "vendor") return;
    try {
        const res = await fetch("/api/vendors/stall", { headers: Session.authHeaders() });
        if (!res.ok) return;
        const stall = await res.json();
        myStallId = stall.stallId;
    } catch {
        /* not fatal - the buttons just won't show */
    }
}

function applyAuthState() {
    if (loggedIn) {
        guestNotice.classList.add("hidden");
        formCard.classList.remove("hidden");
        userIdInput.value = currentUser ? currentUser.name : "";
    } else {
        formCard.classList.add("hidden");
        guestNotice.classList.remove("hidden");
    }
}

if (guestLoginLink) {
    guestLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        Session.goLogin("complaints.html" + window.location.search);
    });
}

// Can this user close this complaint? (the stall's vendor, or an admin)
function canResolve(c) {
    if (!loggedIn || !currentUser) return false;
    if (currentUser.role === "admin") return true;
    return currentUser.role === "vendor" && myStallId === c.stallId;
}

// Can this user delete it? (the author, or an admin)
function canDelete(c) {
    if (!loggedIn || !currentUser) return false;
    if (currentUser.role === "admin") return true;
    return String(currentUser.userId) === String(c.userId);
}

// ---------- Cascading dropdowns: centre first, then its stalls ----------
async function loadCenters() {
    try {
        const response = await fetch("/api/centers");
        if (!response.ok) throw new Error("Server returned " + response.status);
        const centers = await response.json();

        centerSelect.innerHTML = '<option value="">-- choose a centre --</option>';
        centers.forEach((c) => {
            const option = document.createElement("option");
            option.value = c.centerId;
            option.textContent = c.name;
            centerSelect.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        centerSelect.innerHTML = '<option value="">could not load centres</option>';
    }
}

async function loadStallsForCenter(centerId) {
    stallSelect.disabled = true;
    stallSelect.innerHTML = '<option value="">-- loading stalls --</option>';
    try {
        const response = await fetch(`/api/centers/${centerId}/stalls`);
        if (!response.ok) throw new Error("Server returned " + response.status);
        const stalls = await response.json();

        stallSelect.innerHTML = '<option value="">-- choose a stall --</option>';
        stalls.forEach((s) => {
            const option = document.createElement("option");
            option.value = s.stallId;
            option.textContent = s.name;
            stallSelect.appendChild(option);
        });
        stallSelect.disabled = false;
    } catch (error) {
        console.error(error);
        stallSelect.innerHTML = '<option value="">could not load stalls</option>';
    }
}

centerSelect.addEventListener("change", () => {
    if (centerSelect.value) {
        loadStallsForCenter(centerSelect.value);
    } else {
        stallSelect.innerHTML = '<option value="">-- choose a centre first --</option>';
        stallSelect.disabled = true;
    }
});

// ---------- READ: load and display complaints ----------
async function loadComplaints() {
    try {
        const url = presetStallId
            ? `/api/complaints/stall/${presetStallId}`
            : "/api/complaints";
        const response = await fetch(url);
        if (!response.ok) throw new Error("Server returned " + response.status);
        const complaints = await response.json();

        if (complaints.length === 0) {
            listDiv.innerHTML = "<p class='empty'>No complaints on record.</p>";
            return;
        }

        listDiv.innerHTML = "";
        complaints.forEach((c) => {
            const badgeClass = c.status === "Resolved" ? "badge resolved" : "badge open";
            const showResolve = c.status !== "Resolved" && canResolve(c);
            const showDelete = canDelete(c);

            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="complaint-head">
                    <strong>${escapeHtml(c.stallName)} &mdash; ${escapeHtml(c.category || "General")}</strong>
                    <span class="${badgeClass}">${escapeHtml(c.status)}</span>
                </div>
                <p class="description">${escapeHtml(c.description)}</p>
                <p class="meta">by ${escapeHtml(c.userName)} on ${new Date(c.createdAt).toLocaleDateString()} &middot; ${escapeHtml(c.centerName)}</p>
                ${(showResolve || showDelete) ? `
                <div class="card-actions">
                    ${showResolve ? `<button data-id="${c.complaintId}" class="resolve-btn">Mark Resolved</button>` : ""}
                    ${showDelete ? `<button data-id="${c.complaintId}" class="delete-btn secondary">Delete</button>` : ""}
                </div>` : ""}
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        listDiv.innerHTML = "<p class='error-box'>Could not load complaints. Is the server running?</p>";
    }
}

// ---------- CREATE: submit the form ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!loggedIn) {
        showMessage("Please sign in to file a complaint.", true);
        return;
    }

    // userId is NOT sent - the server reads the author from the token.
    const body = {
        stallId: parseInt(stallSelect.value),
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
    };

    try {
        const response = await fetch("/api/complaints", {
            method: "POST",
            headers: Session.jsonHeaders(),
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) {
            showMessage(result.error || result.message || "Something went wrong", true);
            return;
        }
        showMessage("Complaint submitted. Reference #" + result.complaintId, false);
        form.reset();
        userIdInput.value = currentUser ? currentUser.name : "";
        stallSelect.innerHTML = '<option value="">-- choose a centre first --</option>';
        stallSelect.disabled = true;
        applyPreset();   // keep the stall selected if we arrived from a stall card
        loadComplaints();
    } catch (error) {
        console.error(error);
        showMessage("Could not reach the server.", true);
    }
});

// ---------- UPDATE (status) + DELETE (event delegation on the list) ----------
listDiv.addEventListener("click", async (event) => {
    const id = event.target.dataset.id;
    if (!id) return;

    // UPDATE -> PUT /api/complaints/:id with { status: "Resolved" }
    if (event.target.classList.contains("resolve-btn")) {
        try {
            const response = await fetch(`/api/complaints/${id}`, {
                method: "PUT",
                headers: Session.jsonHeaders(),
                body: JSON.stringify({ status: "Resolved" }),
            });
            const result = await response.json();
            if (!response.ok) {
                showMessage(result.error || "Update failed", true);
                return;
            }
            showMessage("Complaint marked as resolved.", false);
            loadComplaints();
        } catch (error) {
            console.error(error);
            showMessage("Could not reach the server.", true);
        }
    }

    // DELETE -> DELETE /api/complaints/:id
    if (event.target.classList.contains("delete-btn")) {
        if (!confirm("Delete this complaint?")) return;
        try {
            const response = await fetch(`/api/complaints/${id}`, {
                method: "DELETE",
                headers: Session.authHeaders(),
            });
            const result = await response.json();
            if (!response.ok) {
                showMessage(result.error || "Delete failed", true);
                return;
            }
            showMessage("Complaint deleted.", false);
            loadComplaints();
        } catch (error) {
            console.error(error);
            showMessage("Could not reach the server.", true);
        }
    }
});

// ---------- Helpers ----------
function showMessage(text, isError) {
    formMessage.textContent = text;
    formMessage.className = isError ? "error" : "success";
}

// ---------- Stall picker: locked vs free ----------
// Arriving from a stall card (?centerId=&stallId=) means the stall is already
// decided, so the two dropdowns are swapped for a plain read-out. Leaving them
// editable was a real bug: the list below is filtered to one stall, so you could
// pick a different stall in the form and submit against something you weren't
// looking at. The selects stay in the DOM (just hidden) because the submit
// handler still reads their .value.
function lockStallPicker() {
    // Read the labels straight off the chosen <option>s - no extra request needed.
    const centreText = centerSelect.options[centerSelect.selectedIndex]?.textContent || "";
    const stallText = stallSelect.options[stallSelect.selectedIndex]?.textContent || "";
    if (!stallText) return;   // stalls not loaded yet - leave the pickers visible

    lockedStallName.innerHTML =
        "<strong>" + escapeHtml(stallText) + "</strong>" +
        (centreText ? ' <span class="locked-centre">' + escapeHtml(centreText) + "</span>" : "");

    fieldCenter.classList.add("hidden");
    fieldStall.classList.add("hidden");
    fieldLocked.classList.remove("hidden");
}

// Restore the free pickers by dropping the query string, which also unfilters
// the list below so it matches what the form can now target.
if (changeStallLink) {
    changeStallLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = "complaints.html";
    });
}

// Pre-select the centre + stall passed in the URL by the stall card button.
async function applyPreset() {
    if (!presetCenterId || !presetStallId) return;
    centerSelect.value = presetCenterId;
    await loadStallsForCenter(presetCenterId);
    stallSelect.value = presetStallId;
    lockStallPicker();
}

// ---------- Start ----------
(async function init() {
    applyAuthState();
    await loadMyStall();      // needed before the list renders its buttons
    await loadCenters();
    await applyPreset();
    loadComplaints();
})();