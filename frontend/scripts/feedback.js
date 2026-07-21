// scripts/feedback.js — Feedback & Reviews page logic (Customer component)
// Talks to the back-end REST API:
//   GET/POST /api/feedback, GET/PUT/DELETE /api/feedback/:id   (mine)
//   GET /api/centers, GET /api/centers/:centerId/stalls        (Quan Jun's, reused for the dropdowns)

const form = document.getElementById("feedback-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const formMessage = document.getElementById("form-message");
const listDiv = document.getElementById("feedback-list");
const centerSelect = document.getElementById("centerId");
const stallSelect = document.getElementById("stallId");

let editingId = null; // null = creating new; a number = editing that feedbackId

// Escape user-entered text so it cannot inject HTML into the page
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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

// ---------- READ: load and display all feedback ----------
async function loadFeedback() {
    try {
        const response = await fetch("/api/feedback");
        if (!response.ok) throw new Error("Server returned " + response.status);
        const feedbackList = await response.json();

        if (feedbackList.length === 0) {
            listDiv.innerHTML = "<p class='empty'>No feedback yet. Be the first!</p>";
            return;
        }

        listDiv.innerHTML = "";
        feedbackList.forEach((fb) => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="review-head">
                    <strong>${escapeHtml(fb.stallName)}</strong>
                    <span class="stars">${"★".repeat(fb.rating)}${"☆".repeat(5 - fb.rating)}</span>
                </div>
                <p class="comment">${fb.comment ? escapeHtml(fb.comment) : "<em>No comment</em>"}</p>
                <p class="meta">by ${escapeHtml(fb.userId)} on ${new Date(fb.createdAt).toLocaleDateString()} &middot; ${escapeHtml(fb.centerName)}</p>
                <div class="card-actions">
                    <button data-id="${fb.feedbackId}" class="edit-btn secondary">Edit</button>
                    <button data-id="${fb.feedbackId}" class="delete-btn">Delete</button>
                </div>
            `;
            listDiv.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        listDiv.innerHTML = "<p class='error-box'>Could not load feedback. Is the server running?</p>";
    }
}

// ---------- CREATE or UPDATE: submit the form ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // stop the browser's default page reload

    const body = {
        stallId: parseInt(stallSelect.value),
        userId: document.getElementById("userId").value.trim(),
        rating: parseInt(document.getElementById("rating").value),
        comment: document.getElementById("comment").value.trim(),
    };

    try {
        let response;
        if (editingId === null) {
            // CREATE -> POST /api/feedback
            response = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        } else {
            // UPDATE -> PUT /api/feedback/:id (back-end updates rating + comment only)
            response = await fetch(`/api/feedback/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating: body.rating, comment: body.comment }),
            });
        }

        const result = await response.json();
        if (!response.ok) {
            // shows back-end validation messages, e.g. "rating must be between 1 and 5"
            showMessage(result.error || "Something went wrong", true);
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
        if (!confirm("Delete this feedback?")) return;
        try {
            const response = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
            const result = await response.json();
            if (!response.ok) {
                showMessage(result.error || "Delete failed", true);
                return;
            }
            showMessage("Feedback deleted.", false);
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

            document.getElementById("userId").value = fb.userId;
            document.getElementById("rating").value = fb.rating;
            document.getElementById("comment").value = fb.comment || "";

            // stall and user cannot change on an edit (back-end only updates rating/comment)
            centerSelect.disabled = true;
            stallSelect.disabled = true;
            document.getElementById("userId").disabled = true;

            editingId = fb.feedbackId;
            formTitle.textContent = "Edit Feedback #" + fb.feedbackId;
            submitBtn.textContent = "Save Changes";
            cancelEditBtn.classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error(error);
            showMessage("Could not load that feedback for editing.", true);
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
    document.getElementById("userId").disabled = false;
}

cancelEditBtn.addEventListener("click", resetForm);

function showMessage(text, isError) {
    formMessage.textContent = text;
    formMessage.className = isError ? "error" : "success";
}

// Initial load when the page opens
loadCenters();
loadFeedback();