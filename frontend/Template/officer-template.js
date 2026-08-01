// Template/officer-template.js
// ---------------------------------------------------------------
// Header for the NEA officer portal. Mirrors template.js (customer) and
// admin-template.js (admin) so all three areas of the site look the same,
// but shows only the officer pages.
//
// Each officer page just needs:
//     <div id="site-header"></div>
//     ... page content ...
//     <div id="site-footer"></div>          (optional)
//     <script src="./Template/officer-template.js"></script>
//
// Everything is wrapped in an IIFE so the names in here can never collide
// with the other two templates or with a page script.
// ---------------------------------------------------------------
(function () {
  const currentPage = window.location.pathname.split("/").pop() || "officer.html";

  // One source of truth for the officer nav links.
  const OFFICER_NAV = [
    { label: "My Worklist",    href: "./officer.html" },
    { label: "Schedule",       href: "./officer_schedule.html" },
    { label: "Grade Register", href: "./officer_grades.html" },
  ];

  function buildHeader() {
    const links = OFFICER_NAV.map((link) => {
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
            <li><div class="divider"></div></li>
            <li><a href="./index.html">Exit to site</a></li>
          </ul>
        </nav>
        <!-- Same structure as the customer and admin headers: an outlined
             name pill where the customer has "Cart", and the round profile
             icon. Logging out happens on user.html, the same place every
             other role does it - one logout button in the whole app. -->
        <div class="header-actions">
          <a href="./officer_profile.html" id="officer-name" class="portal-pill">NEA Officer</a>
          <div id="user">
            <a href="./officer_profile.html" title="Profile">
              <img src="../media/icons/user.svg" alt="Profile">
            </a>
          </div>
        </div>
      </header>
    `;
  }

  function buildFooter() {
    return `
      <footer>
        <div class="sub_footer">
          <div class="footer-branding">
            <div class="logo">
              <img src="../media/icons/hawker_icon.svg" alt="Hawkers Logo">
              <h1>Hawkers</h1>
            </div>
            <h3>NEA Officer Portal</h3>
          </div>
          <div class="footer-nav">
            <nav>
              <h3>Compliance</h3>
              <ul>
                <li><a href="./officer.html">My Worklist</a></li>
                <li><a href="./officer_schedule.html">Schedule</a></li>
                <li><a href="./officer_grades.html">Grade Register</a></li>
              </ul>
            </nav>
            <nav>
              <h3>Public</h3>
              <ul>
                <li><a href="./hygiene-grades.html">Hygiene Grades</a></li>
                <li><a href="./index.html">Home</a></li>
                <li><a href="./credit.html">Credit</a></li>
              </ul>
            </nav>
          </div>
          <div class="footer-info">
            <h3>Contact</h3>
            <p>Singapore</p>
            <p>support@hawkers.com</p>
          </div>
        </div>
        <p>&copy; 2026 Hawkers. All rights reserved.</p>
      </footer>
    `;
  }

  function loadOfficerTemplate() {
    const headerSlot = document.getElementById("site-header");
    if (headerSlot) headerSlot.innerHTML = buildHeader();

    const footerSlot = document.getElementById("site-footer");
    if (footerSlot) footerSlot.innerHTML = buildFooter();

    // The hamburger listener has to be attached AFTER the header exists in
    // the DOM, which is why it lives in here and not at the top of the file.
    const hamburger = document.getElementById("hamburger");
    const navLinks = document.getElementById("nav-links");
    if (hamburger && navLinks) {
      hamburger.addEventListener("click", () => navLinks.classList.toggle("active"));
    }

    // Show who is signed in, using the session sessions.js already read.
    const nameTag = document.getElementById("officer-name");
    const user = window.Session ? Session.getUser() : null;
    if (nameTag && user && user.name) nameTag.textContent = user.name;


  }

  document.addEventListener("DOMContentLoaded", loadOfficerTemplate);
})();