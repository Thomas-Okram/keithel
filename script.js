/* =========================================================
   KEITHEL — script.js
   A vanilla-JS market app.
   Sections follow the class days: DOM → Events → Async → Storage
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   0. CONFIG & STATE
   --------------------------------------------------------- */

const API_URL = "https://dummyjson.com/products?limit=30";

const KEYS = {
  cart: "keithel_cart",
  saved: "keithel_saved",
  theme: "keithel_theme",
  view: "keithel_view",
  sort: "keithel_sort",
  cat: "keithel_category",
  cache: "keithel_products",
  cacheAt: "keithel_products_at",
};

const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes
const FREE_SHIP_AT = 2000; // ₹
const DELIVERY_FEE = 49; // ₹

// --- Application state. Change these, then re-render. Never the reverse.
let allProducts = [];
let cart = [];
let saved = [];
let searchTerm = "";
let activeCategory = "All";
let sortMode = "featured";

/* ---------------------------------------------------------
   1. ELEMENT REFERENCES  (Day 15 — the DOM)
   --------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const el = {
  header: $("#siteHeader"),
  progress: $("#scrollProgress"),
  tagline: $("#shopTagline"),
  ticker: $("#tickerTrack"),

  searchBox: $("#searchBox"),
  searchInput: $("#searchInput"),
  searchClear: $("#searchClear"),
  toolbar: $("#toolbar"),
  chipArea: $("#chipArea"),
  sortSelect: $("#sortSelect"),
  viewToggle: $("#viewToggle"),

  grid: $("#productGrid"),
  sectionTitle: $("#sectionTitle"),
  resultCount: $("#resultCount"),

  statTotal: $("#statTotal"),
  statStock: $("#statStock"),
  statValue: $("#statValue"),
  statRating: $("#statRating"),

  cartPill: $("#cartPill"),
  cartCount: $("#cartCount"),
  cartTotal: $("#cartTotal"),
  savedPill: $("#savedPill"),
  savedCount: $("#savedCount"),
  themeToggle: $("#themeToggle"),

  backdrop: $("#backdrop"),
  drawer: $("#cartDrawer"),
  drawerBody: $("#drawerBody"),
  drawerSub: $("#drawerSub"),
  drawerClose: $("#drawerClose"),
  sumSubtotal: $("#sumSubtotal"),
  sumDelivery: $("#sumDelivery"),
  sumTotal: $("#sumTotal"),
  freeShipText: $("#freeShipText"),
  freeShipFill: $("#freeShipFill"),
  checkoutBtn: $("#checkoutBtn"),
  clearCartBtn: $("#clearCartBtn"),

  modal: $("#quickView"),
  modalCard: $("#quickViewCard"),

  toastStack: $("#toastStack"),
  toTop: $("#toTop"),
  shopNowBtn: $("#shopNowBtn"),
  surpriseBtn: $("#surpriseBtn"),
  footerYear: $("#footerYear"),
};

/* ---------------------------------------------------------
   2. SMALL HELPERS
   --------------------------------------------------------- */

const rupees = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function debounce(fn, delay = 320) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// localStorage that never throws (private mode, quota, corrupt data)
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — fail quietly */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

/* ---------------------------------------------------------
   3. TOASTS
   --------------------------------------------------------- */

function showToast(message, type = "ok") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "err" ? "err" : ""}`;

  const icon =
    type === "err"
      ? `<path d="M12 7v6M12 17h.01"/>`
      : `<path d="M4 12.5l5 5L20 7"/>`;

  toast.innerHTML = `
    <span class="toast-ico">
      <svg viewBox="0 0 24 24">${icon}</svg>
    </span>
    <span>${message}</span>
  `;

  el.toastStack.append(toast);

  // keep at most 3 on screen
  const all = $$(".toast", el.toastStack);
  if (all.length > 3) all[0].remove();

  setTimeout(() => {
    toast.classList.add("hide");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  }, 2400);
}

/* ---------------------------------------------------------
   4. RIPPLE + COUNT-UP (motion helpers)
   --------------------------------------------------------- */

document.addEventListener("pointerdown", (e) => {
  const btn = e.target.closest(".ripple, .btn, .card-add, .chip");
  if (!btn) return;

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);

  const ink = document.createElement("span");
  ink.className = "ripple-ink";
  ink.style.width = ink.style.height = `${size}px`;
  ink.style.left = `${e.clientX - rect.left - size / 2}px`;
  ink.style.top = `${e.clientY - rect.top - size / 2}px`;

  btn.append(ink);
  ink.addEventListener("animationend", () => ink.remove(), { once: true });
});

function countUp(
  node,
  target,
  { prefix = "", decimals = 0, duration = 900 } = {},
) {
  const start = Number(node.dataset.count) || 0;
  const t0 = performance.now();

  function frame(now) {
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    const value = start + (target - start) * eased;

    node.textContent = decimals
      ? prefix + value.toFixed(decimals)
      : prefix + Math.round(value).toLocaleString("en-IN");

    if (p < 1) requestAnimationFrame(frame);
    else node.dataset.count = target;
  }

  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------
   5. THEME  (persisted)
   --------------------------------------------------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.set(KEYS.theme, theme);
}

function initTheme() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(store.get(KEYS.theme) ?? (prefersDark ? "dark" : "light"));
}

el.themeToggle.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  showToast(next === "dark" ? "Dark mode on" : "Light mode on");
});

/* ---------------------------------------------------------
   6. RENDERING  (Day 15 — data in, HTML out)
   --------------------------------------------------------- */

function stars(rating) {
  return `
    <span class="card-rating">
      <svg viewBox="0 0 24 24"><path d="m12 2 3 6.6 7 .9-5.1 4.9 1.3 7L12 18l-6.2 3.4 1.3-7L2 9.5l7-.9L12 2Z"/></svg>
      ${rating.toFixed(1)}
    </span>
  `;
}

function stockBadge(stock) {
  if (stock === 0) return `<span class="badge badge-out">Out of stock</span>`;
  if (stock <= 10)
    return `<span class="badge badge-low">Only ${stock} left</span>`;
  return `<span class="badge badge-ok">In stock</span>`;
}

function createCard(product, index) {
  const { id, name, price, mrp, off, category, stock, rating, image, emoji } =
    product;
  const isSaved = saved.includes(id);
  const out = stock === 0;

  return `
    <article class="card ${out ? "is-out" : ""}" data-id="${id}" style="--i:${index}">
      <div class="card-media">
        ${
          image
            ? `<img src="${image}" alt="${name}" loading="lazy"
                  onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'${emoji}'}))">`
            : `<span class="fallback">${emoji}</span>`
        }

        <div class="card-flags">
          ${stockBadge(stock)}
          ${off >= 10 ? `<span class="badge badge-save">${off}% OFF</span>` : ""}
        </div>

        <button class="save-btn ${isSaved ? "saved" : ""}" data-action="save" aria-label="Save">
          <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z"/>
          </svg>
        </button>

        <button class="quick-btn" data-action="quick">Quick view</button>
      </div>

      <div class="card-body">
        <div class="card-top">
          <span class="card-cat">${category}</span>
          ${stars(rating)}
        </div>

        <h3 class="card-name">${name}</h3>

        <div class="price-row">
          <span class="price">${rupees(price)}</span>
          ${off >= 10 ? `<span class="mrp">${rupees(mrp)}</span><span class="off">${off}% off</span>` : ""}
        </div>

        <button class="card-add" data-action="add" ${out ? "disabled" : ""}>
          ${out ? "Unavailable" : "Add to cart"}
        </button>
      </div>
    </article>
  `;
}

function renderProducts(list) {
  if (list.length === 0) {
    el.grid.innerHTML = `
      <div class="state">
        <span class="state-emoji">🧺</span>
        <h3>Nothing matched</h3>
        <p>Try a different word, or clear the filters to see everything again.</p>
        <button class="btn btn-ghost ripple" id="resetBtn">Reset filters</button>
      </div>
    `;
    $("#resetBtn")?.addEventListener("click", resetFilters);
    return;
  }

  el.grid.innerHTML = list.map(createCard).join("");
}

function renderStats(list) {
  const inStock = list.filter((p) => p.stock > 0);
  const value = list.reduce((acc, p) => acc + p.price * p.stock, 0);
  const rating = list.length
    ? list.reduce((acc, p) => acc + p.rating, 0) / list.length
    : 0;

  countUp(el.statTotal, list.length);
  countUp(el.statStock, inStock.length);
  countUp(el.statValue, value, { prefix: "₹" });
  countUp(el.statRating, rating, { decimals: 1 });
}

function renderChips(list) {
  const categories = ["All", ...new Set(list.map((p) => p.category))];

  el.chipArea.innerHTML = categories
    .map(
      (cat, i) => `
      <button class="chip ${cat === activeCategory ? "active" : ""}"
              data-category="${cat}" style="--i:${i}">${cat}</button>
    `,
    )
    .join("");
}

function renderLoading() {
  el.grid.innerHTML = Array.from(
    { length: 10 },
    (_, i) => `
    <div class="skel" style="--i:${i}">
      <div class="skel-media"><div class="sk"></div></div>
      <div class="skel-body">
        <div class="sk" style="width:40%"></div>
        <div class="sk" style="width:85%;height:16px"></div>
        <div class="sk" style="width:50%;height:20px"></div>
        <div class="sk" style="height:38px;border-radius:11px"></div>
      </div>
    </div>
  `,
  ).join("");
}

function renderError(message) {
  el.grid.innerHTML = `
    <div class="state">
      <span class="state-emoji">⚠️</span>
      <h3>Could not load the market</h3>
      <p>${message}</p>
      <button class="btn btn-primary ripple" id="retryBtn">Try again</button>
    </div>
  `;
  $("#retryBtn")?.addEventListener("click", loadProducts);
}

/* ---------------------------------------------------------
   7. FILTER + SORT  (Day 16 — one pipeline, one re-render)
   --------------------------------------------------------- */

const SORTERS = {
  featured: (a, b) => b.rating * b.stock - a.rating * a.stock,
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  name: (a, b) => a.name.localeCompare(b.name),
};

function applyFilters() {
  let result = allProducts;

  if (activeCategory !== "All") {
    result = result.filter((p) => p.category === activeCategory);
  }

  if (searchTerm !== "") {
    const term = searchTerm.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term),
    );
  }

  // sort a COPY — never mutate allProducts
  result = [...result].sort(SORTERS[sortMode]);

  renderProducts(result);
  renderStats(result);

  el.sectionTitle.textContent =
    activeCategory === "All" ? "All products" : activeCategory;
  el.resultCount.textContent =
    result.length === allProducts.length
      ? `${result.length} items`
      : `${result.length} of ${allProducts.length} items`;

  store.set(KEYS.cat, activeCategory);
  store.set(KEYS.sort, sortMode);

  return result;
}

function resetFilters() {
  searchTerm = "";
  activeCategory = "All";
  el.searchInput.value = "";
  el.searchBox.classList.remove("has-value");
  renderChips(allProducts);
  applyFilters();
}

/* ---------------------------------------------------------
   8. EVENTS  (Day 16)
   --------------------------------------------------------- */

// --- Search (debounced)
const runSearch = debounce(() => {
  const matches = applyFilters();
  console.log(
    matches.length
      ? `${matches.length} matched`
      : `No results for "${searchTerm}"`,
  );
}, 260);

el.searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  el.searchBox.classList.toggle("has-value", searchTerm !== "");
  runSearch();
});

el.searchClear.addEventListener("click", () => {
  searchTerm = "";
  el.searchInput.value = "";
  el.searchBox.classList.remove("has-value");
  el.searchInput.focus();
  applyFilters();
});

// --- Category chips: ONE delegated listener (chips are re-created)
el.chipArea.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;

  $$(".chip", el.chipArea).forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");

  activeCategory = chip.dataset.category;
  applyFilters();
});

// --- Sort
el.sortSelect.addEventListener("change", (e) => {
  sortMode = e.target.value;
  applyFilters();
});

// --- Grid / list view
el.viewToggle.addEventListener("click", () => {
  const isList = document.body.classList.toggle("list-view");
  store.set(KEYS.view, isList ? "list" : "grid");
});

// --- Product grid: ONE delegated listener for add / save / quick view
el.grid.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-action]");
  if (!trigger) return;

  const card = e.target.closest(".card");
  if (!card) return;

  const id = Number(card.dataset.id);
  const product = allProducts.find((p) => p.id === id);
  if (!product) return;

  switch (trigger.dataset.action) {
    case "add":
      addToCart(product, card, trigger);
      break;
    case "save":
      toggleSaved(product, trigger);
      break;
    case "quick":
      openQuickView(product);
      break;
  }
});

// --- Hero buttons
el.shopNowBtn.addEventListener("click", () => {
  $("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
});

el.surpriseBtn.addEventListener("click", () => {
  const available = allProducts.filter((p) => p.stock > 0);
  if (!available.length) return showToast("Nothing in stock yet", "err");

  const pick = available[Math.floor(Math.random() * available.length)];
  openQuickView(pick);
});

// --- Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(
    document.activeElement.tagName,
  );

  if (e.key === "/" && !typing) {
    e.preventDefault();
    el.searchInput.focus();
  }

  if (e.key === "Escape") {
    if (el.modal.classList.contains("open")) return closeQuickView();
    if (el.drawer.classList.contains("open")) return closeDrawer();
    if (typing) {
      el.searchInput.blur();
      resetFilters();
    }
  }

  if (e.key.toLowerCase() === "t" && !typing) el.themeToggle.click();
  if (e.key.toLowerCase() === "c" && !typing) openDrawer();
});

/* ---------------------------------------------------------
   9. CART  (Day 18 — state + persistence)
   --------------------------------------------------------- */

function addToCart(product, card, button) {
  if (product.stock === 0) return;

  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    if (existing.qty >= product.stock) {
      return showToast(`Only ${product.stock} in stock`, "err");
    }
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  flyToCart(card);
  updateCart();
  bumpBadge();

  button.classList.add("added");
  button.textContent = "Added ✓";
  setTimeout(() => {
    button.classList.remove("added");
    button.textContent = "Add to cart";
  }, 1100);

  showToast(`${product.name} added`);
}

function updateCart() {
  const itemCount = cart.reduce((acc, i) => acc + i.qty, 0);
  const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const delivery =
    subtotal === 0 || subtotal >= FREE_SHIP_AT ? 0 : DELIVERY_FEE;

  el.cartCount.textContent = itemCount;
  el.cartCount.classList.toggle("show", itemCount > 0);
  el.cartTotal.textContent = rupees(subtotal);

  el.drawerSub.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
  el.sumSubtotal.textContent = rupees(subtotal);
  el.sumDelivery.textContent = delivery === 0 ? "Free" : rupees(delivery);
  el.sumTotal.textContent = rupees(subtotal + delivery);

  // Free-delivery progress bar
  const pct = Math.min((subtotal / FREE_SHIP_AT) * 100, 100);
  el.freeShipFill.style.width = `${pct}%`;
  el.freeShipText.textContent =
    subtotal >= FREE_SHIP_AT
      ? "🎉 You've unlocked free delivery"
      : `Add ${rupees(FREE_SHIP_AT - subtotal)} more for free delivery`;

  store.set(KEYS.cart, cart);
}

function bumpBadge() {
  el.cartCount.classList.remove("bump");
  void el.cartCount.offsetWidth; // force reflow so the animation restarts
  el.cartCount.classList.add("bump");
}

// --- Fly-to-cart animation
function flyToCart(card) {
  const media = $(".card-media img, .card-media .fallback", card);
  if (!media) return;

  const from = media.getBoundingClientRect();
  const to = el.cartPill.getBoundingClientRect();

  const clone = document.createElement("div");
  clone.className = "fly";
  clone.style.cssText = `
    left:${from.left}px; top:${from.top}px;
    width:${from.width}px; height:${from.height}px;
  `;
  clone.innerHTML =
    media.tagName === "IMG"
      ? `<img src="${media.src}" alt="">`
      : `<div style="display:grid;place-items:center;height:100%;font-size:30px">${media.textContent}</div>`;

  document.body.append(clone);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  clone.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.55}px, ${dy * 0.3 - 70}px) scale(.6)`,
        opacity: 0.95,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0 },
    ],
    { duration: 780, easing: "cubic-bezier(.4,0,.2,1)" },
  ).onfinish = () => clone.remove();
}

/* ---------------------------------------------------------
   10. SAVED ITEMS
   --------------------------------------------------------- */

function toggleSaved(product, button) {
  const index = saved.indexOf(product.id);

  if (index === -1) {
    saved.push(product.id);
    button.classList.add("saved");
    showToast(`${product.name} saved`);
  } else {
    saved.splice(index, 1);
    button.classList.remove("saved");
    showToast(`${product.name} removed from saved`);
  }

  button.classList.add("pop");
  setTimeout(() => button.classList.remove("pop"), 520);

  updateSaved();
}

function updateSaved() {
  el.savedCount.textContent = saved.length;
  el.savedCount.classList.toggle("show", saved.length > 0);
  store.set(KEYS.saved, saved);
}

el.savedPill.addEventListener("click", () => {
  if (saved.length === 0) return showToast("Nothing saved yet");

  const names = allProducts
    .filter((p) => saved.includes(p.id))
    .map((p) => p.name)
    .slice(0, 3)
    .join(", ");

  showToast(
    `Saved: ${names}${saved.length > 3 ? ` +${saved.length - 3} more` : ""}`,
  );
});

/* ---------------------------------------------------------
   11. DRAWER
   --------------------------------------------------------- */

function renderDrawer() {
  if (cart.length === 0) {
    el.drawerBody.innerHTML = `
      <div class="state" style="padding:56px 10px">
        <span class="state-emoji">🛒</span>
        <h3>Your cart is empty</h3>
        <p>Pick something from the market and it will show up here.</p>
      </div>
    `;
    return;
  }

  el.drawerBody.innerHTML = cart
    .map(
      ({ id, name, price, qty, image, emoji }, i) => `
      <div class="line-item" data-id="${id}" style="--i:${i}">
        <div class="line-media">
          ${image ? `<img src="${image}" alt="${name}">` : `<span>${emoji}</span>`}
        </div>
        <div class="line-info">
          <div class="line-name">${name}</div>
          <div class="line-price">${rupees(price)} × ${qty} = <strong>${rupees(price * qty)}</strong></div>
        </div>
        <div class="qty">
          <button data-step="-1" aria-label="Decrease">−</button>
          <span>${qty}</span>
          <button data-step="1" aria-label="Increase">+</button>
        </div>
      </div>
    `,
    )
    .join("");
}

function openDrawer() {
  renderDrawer();
  el.drawer.classList.add("open");
  el.backdrop.classList.add("open");
  el.drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
}

function closeDrawer() {
  el.drawer.classList.remove("open");
  el.backdrop.classList.remove("open");
  el.drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
}

el.cartPill.addEventListener("click", openDrawer);
el.drawerClose.addEventListener("click", closeDrawer);
el.backdrop.addEventListener("click", () => {
  closeDrawer();
  closeQuickView();
});

// --- Quantity stepper (delegated — the list is re-rendered constantly)
el.drawerBody.addEventListener("click", (e) => {
  const button = e.target.closest("[data-step]");
  if (!button) return;

  const row = button.closest(".line-item");
  const id = Number(row.dataset.id);
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  const step = Number(button.dataset.step);
  const stock = allProducts.find((p) => p.id === id)?.stock ?? 99;

  if (step > 0 && item.qty >= stock) {
    return showToast(`Only ${stock} in stock`, "err");
  }

  item.qty += step;

  if (item.qty <= 0) {
    // animate the row out, then remove from state
    row.classList.add("removing");
    cart = cart.filter((i) => i.id !== id);
    updateCart();
    setTimeout(renderDrawer, 320);
    return;
  }

  updateCart();
  renderDrawer();
});

el.clearCartBtn.addEventListener("click", () => {
  if (cart.length === 0) return;

  $$(".line-item", el.drawerBody).forEach((row, i) => {
    setTimeout(() => row.classList.add("removing"), i * 45);
  });

  setTimeout(
    () => {
      cart = [];
      updateCart();
      renderDrawer();
      showToast("Cart cleared");
    },
    cart.length * 45 + 300,
  );
});

el.checkoutBtn.addEventListener("click", () => {
  if (cart.length === 0) return showToast("Your cart is empty", "err");

  const items = cart.reduce((acc, i) => acc + i.qty, 0);
  const total = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const delivery = total >= FREE_SHIP_AT ? 0 : DELIVERY_FEE;

  el.checkoutBtn.disabled = true;
  el.checkoutBtn.textContent = "Placing order…";

  setTimeout(() => {
    showToast(
      `Order placed — ${items} item${items === 1 ? "" : "s"}, ${rupees(total + delivery)}`,
    );
    cart = [];
    updateCart();
    renderDrawer();
    closeDrawer();

    el.checkoutBtn.disabled = false;
    el.checkoutBtn.innerHTML = `Checkout
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M5 12h14M13 6l6 6-6 6"/>
      </svg>`;
  }, 1100);
});

/* ---------------------------------------------------------
   12. QUICK VIEW MODAL
   --------------------------------------------------------- */

function openQuickView(product) {
  const {
    id,
    name,
    brand,
    description,
    price,
    mrp,
    off,
    category,
    stock,
    rating,
    image,
    emoji,
  } = product;

  el.modalCard.innerHTML = `
    <button class="icon-btn qv-close" id="qvClose" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>

    <div class="qv">
      <div class="qv-media">
        ${image ? `<img src="${image}" alt="${name}">` : `<span style="font-size:72px">${emoji}</span>`}
      </div>

      <div class="qv-body">
        <div class="qv-head">
          <span class="qv-cat">${category}</span>
          ${stars(rating)}
        </div>

        <h2 class="qv-title">${name}</h2>
        <p class="qv-desc">${description}</p>

        <div class="qv-meta">
          <span class="qv-tag">Brand · ${brand}</span>
          <span class="qv-tag">${stock > 0 ? `${stock} in stock` : "Out of stock"}</span>
        </div>

        <div class="qv-price">
          <span class="price">${rupees(price)}</span>
          ${off >= 10 ? `<span class="mrp">${rupees(mrp)}</span><span class="off">${off}% off</span>` : ""}
        </div>

        <button class="btn btn-primary ripple" id="qvAdd" data-id="${id}" ${stock === 0 ? "disabled" : ""}
                style="margin-top:6px">
          ${stock === 0 ? "Unavailable" : "Add to cart"}
        </button>
      </div>
    </div>
  `;

  el.modal.classList.add("open");
  el.modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");

  $("#qvClose").addEventListener("click", closeQuickView);
  $("#qvAdd")?.addEventListener("click", (e) => {
    const card = $(`.card[data-id="${id}"]`);
    addToCart(product, card ?? el.modalCard, e.currentTarget);
    closeQuickView();
  });
}

function closeQuickView() {
  el.modal.classList.remove("open");
  el.modal.setAttribute("aria-hidden", "true");
  if (!el.drawer.classList.contains("open"))
    document.body.classList.remove("locked");
}

el.modal.addEventListener("click", (e) => {
  if (e.target === el.modal) closeQuickView();
});

/* ---------------------------------------------------------
   13. SCROLL BEHAVIOUR
   --------------------------------------------------------- */

let ticking = false;

window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;

  requestAnimationFrame(() => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    el.progress.style.width = `${(y / max) * 100}%`;
    el.header.classList.toggle("scrolled", y > 8);
    el.toTop.classList.toggle("show", y > 600);

    ticking = false;
  });
});

el.toTop.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" }),
);

/* ---------------------------------------------------------
   14. DATA LOADING  (Day 17 — async / await / fetch)
   --------------------------------------------------------- */

const EMOJI_BY_CATEGORY = {
  beauty: "💄",
  fragrances: "🌸",
  furniture: "🪑",
  groceries: "🧺",
  "home-decoration": "🖼️",
  "kitchen-accessories": "🍳",
  laptops: "💻",
  "mens-shirts": "👔",
  "mens-shoes": "👞",
  "mens-watches": "⌚",
  "mobile-accessories": "🔌",
  motorcycle: "🏍️",
  "skin-care": "🧴",
  smartphones: "📱",
  "sports-accessories": "🏸",
  sunglasses: "🕶️",
  tablets: "📱",
  tops: "👚",
  vehicle: "🚗",
  "womens-bags": "👜",
  "womens-dresses": "👗",
  "womens-jewellery": "💍",
  "womens-shoes": "👠",
  "womens-watches": "⌚",
};

const titleCase = (slug) =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// The API's shape is not our shape — translate it once, here.
function normalise(api) {
  const inr = Math.round(api.price * 85);
  const discount = Math.round(api.discountPercentage ?? 0);

  return {
    id: api.id,
    name: api.title,
    brand: api.brand ?? "Keithel",
    description: api.description,
    price: inr,
    mrp: Math.round(inr / (1 - discount / 100)),
    off: discount,
    category: titleCase(api.category),
    stock: api.stock,
    rating: api.rating ?? 0,
    image: api.thumbnail ?? null,
    emoji: EMOJI_BY_CATEGORY[api.category] ?? "📦",
  };
}

function setControlsEnabled(enabled) {
  el.searchInput.disabled = !enabled;
  el.sortSelect.disabled = !enabled;
  $$(".chip", el.chipArea).forEach((c) => (c.disabled = !enabled));
}

function readCache() {
  const list = store.get(KEYS.cache);
  const at = store.get(KEYS.cacheAt);
  if (!list || !at) return null;

  const age = Date.now() - at;
  if (age > CACHE_MAX_AGE) {
    console.log("Cache expired");
    return null;
  }

  console.log(`Serving from cache (${Math.round(age / 1000)}s old)`);
  return list;
}

function saveCache(list) {
  store.set(KEYS.cache, list);
  store.set(KEYS.cacheAt, Date.now());
}

function paint() {
  renderChips(allProducts);
  applyFilters();
  buildTicker();
}

async function loadProducts() {
  renderLoading();
  setControlsEnabled(false);
  el.tagline.textContent = "Loading the market…";

  try {
    const cached = readCache();
    if (cached) {
      allProducts = cached;
      paint();
      return; // `finally` still runs
    }

    await wait(700); // let the skeleton breathe

    const response = await fetch(API_URL);

    // fetch does NOT throw on 404 / 500 — we check ourselves
    if (!response.ok)
      throw new Error(`Server responded with ${response.status}`);

    const data = await response.json();
    allProducts = data.products.map(normalise);

    saveCache(allProducts);
    paint();

    console.log(`Loaded ${allProducts.length} products`);
  } catch (error) {
    console.error("Load failed:", error);
    renderError(
      error.message || "Check your internet connection and try again.",
    );
    showToast("Could not reach the market", "err");
  } finally {
    setControlsEnabled(true);
    el.tagline.textContent = "Fresh from Imphal, every morning";
  }
}

/* ---------------------------------------------------------
   15. TICKER
   --------------------------------------------------------- */

function buildTicker() {
  const lines = [
    "Free delivery above ₹2,000",
    "Avg delivery 40 minutes",
    `${allProducts.length} products live`,
    "Pay on delivery available",
    "Supporting local sellers in Manipur",
  ];

  const row = `<span>${lines.map((l) => `${l} &nbsp;•`).join(" ")}</span>`;
  el.ticker.innerHTML = row + row; // duplicated for a seamless loop
}

/* ---------------------------------------------------------
   16. BOOT
   --------------------------------------------------------- */

function init() {
  initTheme();

  // restore state from storage
  cart = store.get(KEYS.cart, []) ?? [];
  saved = store.get(KEYS.saved, []) ?? [];
  sortMode = store.get(KEYS.sort) ?? "featured";
  activeCategory = store.get(KEYS.cat) ?? "All";

  if (store.get(KEYS.view) === "list") document.body.classList.add("list-view");
  el.sortSelect.value = sortMode;
  el.footerYear.textContent = new Date().getFullYear();

  updateCart();
  updateSaved();
  buildTicker();

  loadProducts();

  console.log(
    "%cKeithel",
    "font:600 20px Fraunces,serif;color:#c2410c",
    "\nShortcuts:  /  search   ·   c  cart   ·   t  theme   ·   Esc  close",
  );
}

init();
