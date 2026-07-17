// Template/template.js
// ---------------------------------------------------------------
// Builds the header (navbar) and footer ONCE, then injects them
// into every page. Previously each page had its own copy of the
// HTML, so they drifted out of sync.
//
// Each page just needs:
//     <div id="site-header"></div>
//     ... page content ...
//     <div id="site-footer"></div>
//     <script src="./Template/template.js"></script>
// ---------------------------------------------------------------

// Which nav link should be highlighted? Work it out from the URL.
const currentPage = window.location.pathname.split("/").pop() || "home.html";

// One source of truth for the nav links.
const NAV_LINKS = [
  { label: "Home",       href: "./home.html" },
  { label: "Order",      href: "./centers.html" },
  { label: "History",    href: "./history.html" },
  { label: "Promotions", href: "./promotions.html" }
];

function buildHeader() {
  const links = NAV_LINKS.map(link => {
    // mark the link for the page we're on
    const active = link.href.endsWith(currentPage) ? ' class="active-link"' : "";
    return `<li><a href="${link.href}"${active}>${link.label}</a></li>`;
  }).join("");

  return `
    <header>
      <div class="header-brand">
        <button id="hamburger">
          <img src="../media/icons/hamburger_menu.svg" alt="Hamburger Menu">
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
          <li><a href="./cart.html">Cart</a></li>
          <li><a href="./user.html">User</a></li>
        </ul>
      </nav>
      <div class="header-actions">
        <a href="./cart.html" id="cart">
          Cart <img src="../media/icons/shopping_cart.svg" alt="Shopping Cart Icon">
        </a>
        <div id="user">
          <a href="./user.html">
            <img src="../media/icons/user.svg" alt="User Icon">
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
          <h3>Connect with us</h3>
          <ul>
            <li><a href="#"><img src="../media/icons/twitter.svg" alt="Twitter Icon"></a></li>
            <li><a href="#"><img src="../media/icons/facebook.svg" alt="Facebook Icon"></a></li>
            <li><a href="#"><img src="../media/icons/instagram.svg" alt="Instagram Icon"></a></li>
            <li><a href="#"><img src="../media/icons/github.svg" alt="GitHub Icon"></a></li>
          </ul>
        </div>

        <div class="footer-nav">
          <nav>
            <h3>Pages</h3>
            <ul>
              <li><a href="./home.html">Home</a></li>
              <li><a href="./centers.html">Order</a></li>
              <li><a href="./history.html">History</a></li>
              <li><a href="./promotions.html">Promotions</a></li>
            </ul>
          </nav>
          <nav>
            <h3>Order</h3>
            <ul>
              <li><a href="./centers.html">Hawker Centers</a></li>
              <li><a href="./centers.html">Stalls</a></li>
              <li><a href="./cart.html">Cart</a></li>
            </ul>
          </nav>
        </div>

        <div class="footer-info">
          <h3>Contact Us</h3>
          <p>Singapore</p>
          <p>+65 5752 6239</p>
          <p>support@hawkers.com</p>
        </div>
      </div>

      <p>&copy; 2026 Hawkers. All rights reserved.</p>
    </footer>
  `;
}

// ---------------------------------------------------------------
// Inject, then wire up the hamburger menu.
// The hamburger listener must run AFTER the header exists in the DOM,
// which is why it lives inside this function.
// ---------------------------------------------------------------
function loadTemplate() {
  const headerSlot = document.getElementById("site-header");
  const footerSlot = document.getElementById("site-footer");

  if (headerSlot) headerSlot.innerHTML = buildHeader();
  if (footerSlot) footerSlot.innerHTML = buildFooter();

  const hamburger = document.getElementById("hamburger");
  const navLinks  = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });
  }
}

document.addEventListener("DOMContentLoaded", loadTemplate);