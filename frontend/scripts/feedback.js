// scripts/feedback.js — Feedback & Reviews page logic (Customer component)
// Talks to the back-end REST API:
//   GET  /api/feedback                     every review
//   GET  /api/feedback/stall/:stallId      one stall's reviews
//   POST /api/feedback                     login required
//   PUT/DELETE /api/feedback/:id           author (or admin) only
//   GET  /api/centers, /api/centers/:id/stalls   (Quan Jun's, reused for dropdowns)
//
// THREE THINGS THIS PAGE NOW DOES DIFFERENTLY
// 1. ?stallId= in the URL (from the stall card's "Review" button) pre-selects
//    the centre + stall and filters the list to that stall.
// 2. Guests see the reviews but get a sign-in prompt instead of the form.
// 3. Edit/Delete only appear on YOUR OWN reviews - the server enforces the
//    same rule, this just avoids showing buttons that would fail.

const form = document.getElementById("feedback-form");
const formCard = document.getElementById("form-card");
const guestNotice = document.getElementById("guest-notice");
const guestLoginLink = document.getElementById("guest-login-link");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const formMessage = document.getElementById("form-message");
const listDiv = document.getElementById("feedback-list");
const listHeading = document.getElementById("list-heading");
const centerSelect = document.getElementById("centerId");
const stallSelect = document.getElementById("stallId");
const userIdInput = document.getElementById("userId");
const fieldCenter = document.getElementById("field-center");
const fieldStall = document.getElementById("field-stall");
const fieldLocked = document.getElementById("field-locked");
const lockedStallName = document.getElementById("locked-stall-name");
const changeStallLink = document.getElementById("change-stall");

let editingId = null; // null = creating new; a number = editing that feedbackId

// Stall passed in from the stalls page, e.g. feedback.html?centerId=1&stallId=3
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

function applyAuthState() {
    if (loggedIn) {
        guestNotice.classList.add("hidden");
        formCard.classList.remove("hidden");
        userIdInput.value = currentUser ? currentUser.name : "";
    } else {
        // Guests read, they don't write.
        formCard.classList.add("hidden");
        guestNotice.classList.remove("hidden");
    }
}

if (guestLoginLink) {
    guestLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Come back to this exact page (stall filter included) after signing in.
        Session.goLogin("feedback.html" + window.location.search);
    });
}

// Is this row mine? (admins may edit anything, same as the server rule)
function canModify(fb) {
    if (!loggedIn || !currentUser) return false;
    if (currentUser.role === "admin") return true;
    return String(currentUser.userId) === String(fb.userId);
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
            option.value = c.centerId;     // the numeric id is what gets submitted
            option.textContent = c.name;   // the user sees the centre name
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

// ---------- READ: load and display reviews ----------
// With ?stallId= we show just that stall; otherwise every review.
async function loadFeedback() {
    try {
        const url = presetStallId
            ? `/api/feedback/stall/${presetStallId}`
            : "/api/feedback";
        const response = await fetch(url);
        if (!response.ok) throw new Error("Server returned " + response.status);
        const feedbackList = await response.json();

        if (feedbackList.length === 0) {
            listDiv.innerHTML = "<p class='empty'>No reviews yet. Be the first!</p>";
            return;
        }

        // Once we know the stall's name, put it in the heading.
        if (presetStallId && listHeading) {
            listHeading.textContent = "Reviews for " + feedbackList[0].stallName;
        }

        listDiv.innerHTML = "";
        feedbackList.forEach((fb) => {
            const mine = canModify(fb);
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="review-head">
                    <strong>${escapeHtml(fb.stallName)}</strong>
                    <span class="stars">${"★".repeat(fb.rating)}${"☆".repeat(5 - fb.rating)}</span>
                </div>
                <p class="comment">${fb.comment ? escapeHtml(fb.comment) : "<em>No comment</em>"}</p>
                <p class="meta">by ${escapeHtml(fb.userName)} on ${new Date(fb.createdAt).toLocaleDateString()} &middot; ${escapeHtml(fb.centerName)}</p>
                ${fb.vendorReply && fb.vendorReply.trim() ? `
                <div class="vendor-reply">
                    <p class="vendor-reply-label">Reply from ${escapeHtml(fb.stallName)}</p>
                    <p class="vendor-reply-text">${escapeHtml(fb.vendorReply)}</p>
                </div>` : ""}
                ${mine ? `
                <div class="card-actions">
                    <button data-id="${fb.feedbackId}" class="edit-btn secondary">Edit</button>
                    <button data-id="${fb.feedbackId}" class="delete-btn">Delete</button>
                </div>` : ""}
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        listDiv.innerHTML = "<p class='error-box'>Could not load reviews. Is the server running?</p>";
    }
}

// ---------- CREATE or UPDATE: submit the form ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // stop the browser's default page reload

    if (!loggedIn) {
        showMessage("Please sign in to leave a review.", true);
        return;
    }

    // userId is NOT sent - the server reads the author from the token.
    const body = {
        stallId: parseInt(stallSelect.value),
        rating: parseInt(document.getElementById("rating").value),
        comment: document.getElementById("comment").value.trim(),
    };

    try {
        let response;
        if (editingId === null) {
            // CREATE -> POST /api/feedback
            response = await fetch("/api/feedback", {
                method: "POST",
                headers: Session.jsonHeaders(),
                body: JSON.stringify(body),
            });
        } else {
            // UPDATE -> PUT /api/feedback/:id (back-end updates rating + comment only)
            response = await fetch(`/api/feedback/${editingId}`, {
                method: "PUT",
                headers: Session.jsonHeaders(),
                body: JSON.stringify({ rating: body.rating, comment: body.comment }),
            });
        }

        const result = await response.json();
        if (!response.ok) {
            // shows back-end validation messages, e.g. "rating must be between 1 and 5"
            showMessage(result.error || result.message || "Something went wrong", true);
            return;
        }

        showMessage(editingId === null ? "Feedback submitted, thank you!" : "Feedback updated!", false);
        resetForm();
        loadFeedback(); // refresh the list so the change shows immediately
    } catch (error) {
        console.error(error);
        showMessage("Could not reach the server.", true);
    }
});

// ---------- EDIT / DELETE buttons (event delegation on the list) ----------
listDiv.addEventListener("click", async (event) => {
    const id = event.target.dataset.id;
    if (!id) return; // click was not on an Edit/Delete button

    // DELETE -> DELETE /api/feedback/:id
    if (event.target.classList.contains("delete-btn")) {
        if (!confirm("Delete this review?")) return;
        try {
            const response = await fetch(`/api/feedback/${id}`, {
                method: "DELETE",
                headers: Session.authHeaders(),
            });
            const result = await response.json();
            if (!response.ok) {
                showMessage(result.error || "Delete failed", true);
                return;
            }
            showMessage("Review deleted.", false);
            loadFeedback();
        } catch (error) {
            console.error(error);
            showMessage("Could not reach the server.", true);
        }
    }

    // EDIT -> fetch the single row and load its values into the form
    if (event.target.classList.contains("edit-btn")) {
        try {
            const response = await fetch(`/api/feedback/${id}`);
            if (!response.ok) throw new Error("Not found");
            const fb = await response.json();

            // Pre-select the centre, load its stalls, then pre-select the stall.
            // (await matters: the stall option must exist before we can select it.)
            centerSelect.value = fb.centerId;
            await loadStallsForCenter(fb.centerId);
            stallSelect.value = fb.stallId;

            document.getElementById("rating").value = fb.rating;
            document.getElementById("comment").value = fb.comment || "";

            // stall cannot change on an edit (back-end only updates rating/comment)
            centerSelect.disabled = true;
            stallSelect.disabled = true;

            editingId = fb.feedbackId;
            formTitle.textContent = "Edit Review #" + fb.feedbackId;
            submitBtn.textContent = "Save Changes";
            cancelEditBtn.classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error(error);
            showMessage("Could not load that review for editing.", true);
        }
    }
});

// ---------- Helpers ----------
function resetForm() {
    form.reset();
    editingId = null;
    formTitle.textContent = "Leave Feedback";
    submitBtn.textContent = "Submit Feedback";
    cancelEditBtn.classList.add("hidden");
    centerSelect.disabled = false;
    stallSelect.innerHTML = '<option value="">-- choose a centre first --</option>';
    stallSelect.disabled = true;
    userIdInput.value = currentUser ? currentUser.name : "";
    // Coming from a stall card? Put that stall back rather than clearing it.
    applyPreset();
}

cancelEditBtn.addEventListener("click", resetForm);

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
        window.location.href = "feedback.html";
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
    await loadCenters();
    await applyPreset();
    loadFeedback();
})();