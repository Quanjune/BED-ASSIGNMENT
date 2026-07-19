// Talks to the back-end REST API: GET/POST /api/complaints, PUT/DELETE /api/complaints/:id

const form = document.getElementById("complaint-form");
const formMessage = document.getElementById("form-message");
const listDiv = document.getElementById("complaint-list");

// Escape user-entered text so it cannot inject HTML into the page
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ---------- READ: load and display all complaints ----------
async function loadComplaints() {
    try {
        const response = await fetch("/api/complaints");
        if (!response.ok) throw new Error("Server returned " + response.status);
        const complaints = await response.json();

        if (complaints.length === 0) {
            listDiv.innerHTML = "<p class='empty'>No complaints on record.</p>";
            return;
        }

        listDiv.innerHTML = "";
        complaints.forEach((c) => {
            const badgeClass = c.status === "Resolved" ? "badge resolved" : "badge open";
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="complaint-head">
                    <strong>Stall ${c.stallId} — ${escapeHtml(c.category || "General")}</strong>
                    <span class="${badgeClass}">${escapeHtml(c.status)}</span>
                </div>
                <p class="description">${escapeHtml(c.description)}</p>
                <p class="meta">by ${escapeHtml(c.userId)} on ${new Date(c.createdAt).toLocaleDateString()}</p>
                <div class="card-actions">
                    ${c.status !== "Resolved"
                        ? `<button data-id="${c.complaintId}" class="resolve-btn">Mark Resolved</button>`
                        : ""}
                    <button data-id="${c.complaintId}" class="delete-btn secondary">Delete</button>
                </div>
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
    event.preventDefault(); // stop the browser's default page reload

    const body = {
        stallId: parseInt(document.getElementById("stallId").value),
        userId: document.getElementById("userId").value.trim(),
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
    };

    try {
        const response = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) {
            showMessage(result.error || "Something went wrong", true);
            return;
        }
        showMessage("Complaint submitted. Reference #" + result.complaintId, false);
        form.reset();
        loadComplaints();
    } catch (error) {
        console.error(error);
        showMessage("Could not reach the server.", true);
    }
});

// ---------- UPDATE (status) + DELETE (event delegation on the list) ----------
listDiv.addEventListener("click", async (event) => {
    const id = event.target.dataset.id;
    if (!id) return; // click was not on a button

    // UPDATE -> PUT /api/complaints/:id with { status: "Resolved" }
    if (event.target.classList.contains("resolve-btn")) {
        try {
            const response = await fetch(`/api/complaints/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
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
            const response = await fetch(`/api/complaints/${id}`, { method: "DELETE" });
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

// Initial load when the page opens
loadComplaints();