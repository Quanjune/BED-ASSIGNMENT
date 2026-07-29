// Template/admin-template.js
// ---------------------------------------------------------------
// Admin header (navbar). Mirrors the customer template so the look
// matches the rest of the site, but shows only the admin pages and
// a Logout button. Each admin page just needs:
//     <div id="site-header"></div>
//     ... page content ...
//     <script src="./Template/admin-template.js"></script>
// ---------------------------------------------------------------

const currentPage = window.location.pathname.split("/").pop() || "admin-analytics.html";

// One source of truth for the admin nav links.
const ADMIN_NAV = [
  { label: "Analytics & Reports", href: "./admin-analytics.html" },
  { label: "User Management",     href: "./admin-users.html" }
];

function buildAdminHeader() {
  const links = ADMIN_NAV.map(link => {
    const active = link.href.endsWith(currentPage) ? ' class="active-link"' : "";
    return `<li><a href="${link.href}"${active}>${link.label}</a></li>`;
  }).join("");

  return `
    <header>
      <div class="header-brand">
        <button id="hamburger">
          <img src="../media/icons/hamburger_menu.svg" alt="Menu">
        </button>
        <div class="logo">
          <img src="../media/icons/hawker_icon.svg" alt="Hawkers Logo">
          <h1>Hawkers</h1>
        </div>
      </div>
      <nav class="header-nav">
        <ul id="nav-links">
          ${links}
        </ul>
      </nav>
      <div class="header-actions">
        <div id="user">
          <a href="./user.html" title="Profile">
            <img src="../media/icons/user.svg" alt="Profile">
          </a>
        </div>
      </div>
    </header>
  `;
}

function loadAdminTemplate() {
  const slot = document.getElementById("site-header");
  if (slot) slot.innerHTML = buildAdminHeader();

  const hamburger = document.getElementById("hamburger");
  const navLinks  = document.getElementById("nav-links");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => navLinks.classList.toggle("active"));
  }
}

document.addEventListener("DOMContentLoaded", loadAdminTemplate);
