// =====================================================================
// CONFIG — edit this line with your real UPI ID before going live
// =====================================================================
const UPI_ID = "REPLACE_WITH_YOUR_UPI_ID@bank";   // e.g. "9153866504@ybl"
const UPI_PAYEE_NAME = "Ashirbad Enterprise";
// =====================================================================

const CART_KEY = "ashirbad_cart_v1";
let cart = [];              // [{ product_id, name, price, mrp, qty, stock, img }]
let allProducts = [];
let selectedPaymentMethod = "cod";
const SHOP_CONFIG = window.SHOP_CONFIG || { mode: "catalog" };
let activeCategory = "";
let searchQuery = "";

const money = n => "₹" + (Number(n) || 0).toLocaleString("en-IN");

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showToast(text, type = "success") {
    const el = document.getElementById("shopToast");
    el.textContent = text;
    el.className = "shop-toast" + (type === "error" ? " error" : "");
    el.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}

// ---------------- Cart persistence ----------------
function loadCart() {
    try {
        const raw = localStorage.getItem(CART_KEY);
        cart = raw ? JSON.parse(raw) : [];
    } catch (e) {
        cart = [];
    }
}
function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.getElementById("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
    renderCart();
}
function cartQtyFor(productId) {
    const item = cart.find(i => i.product_id === productId);
    return item ? item.qty : 0;
}
function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function addToCart(product, qty) {
    const existing = cart.find(i => i.product_id === product._id);
    const newQty = (existing ? existing.qty : 0) + qty;
    const stock = Number(product.stock) || 0;

    if (newQty > stock) {
        showToast(`Only ${stock} unit(s) of ${product.name} available.`, "error");
        return;
    }
    if (existing) {
        existing.qty = newQty;
    } else {
        cart.push({
            product_id: product._id,
            name: product.name,
            price: Number(product.price) || 0,
            mrp: Number(product.mrp) || 0,
            qty: newQty,
            stock,
            img: product.image || "",
        });
    }
    saveCart();
    renderProducts();
}

function updateCartItemQty(productId, delta) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
        cart = cart.filter(i => i.product_id !== productId);
    } else if (newQty > item.stock) {
        showToast(`Only ${item.stock} unit(s) available.`, "error");
        return;
    } else {
        item.qty = newQty;
    }
    saveCart();
    renderCart();
    renderProducts();
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.product_id !== productId);
    saveCart();
    renderCart();
    renderProducts();
}

// ---------------- Product grid ----------------
async function loadProducts() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;
    try {
        const res = await fetch("/api/products");
        allProducts = await res.json();
        if (SHOP_CONFIG.mode === "catalog") {
            buildCategoryChips();
            setupCatalogSearch();
        }
        renderProducts();
    } catch (err) {
        grid.innerHTML = '<p class="empty-note">Unable to load products right now. Please refresh.</p>';
    }
}

function setupCatalogSearch() {
    const input = document.getElementById("catalogSearch");
    if (!input) return;
    input.addEventListener("input", () => {
        searchQuery = input.value.trim().toLowerCase();
        renderProducts();
    });
}

function buildCategoryChips() {
    const chipRow = document.getElementById("chipRow");
    if (!chipRow) return;
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
    chipRow.innerHTML = '<button class="chip active" data-filter="">All Categories</button>' +
        categories.map(c => `<button class="chip" data-filter="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
    chipRow.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
            chipRow.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            activeCategory = chip.dataset.filter;
            renderProducts();
        });
    });
}

function renderProducts() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    let filtered = allProducts.filter(p => !activeCategory || p.category === activeCategory);
    if (SHOP_CONFIG.mode === "catalog" && searchQuery) {
        filtered = filtered.filter(p =>
            (p.name || "").toLowerCase().includes(searchQuery) ||
            (p.brand || "").toLowerCase().includes(searchQuery)
        );
    }

    let moreLinkHtml = "";
    if (SHOP_CONFIG.mode === "home" && SHOP_CONFIG.limit) {
        const totalMatching = filtered.length;
        filtered = filtered.slice(0, SHOP_CONFIG.limit);
        if (totalMatching > SHOP_CONFIG.limit) {
            const catalogUrl = SHOP_CONFIG.catalogUrl || "/catalog";
            moreLinkHtml = `<div style="grid-column:1/-1; text-align:center; padding:16px 0 4px;">
                <a href="${catalogUrl}" class="btn btn-outline">View Full Catalog (${totalMatching} items) →</a>
            </div>`;
        }
    }

    if (!filtered.length) {
        grid.innerHTML = '<p class="empty-note">No medicines found.</p>';
        return;
    }

    grid.innerHTML = filtered.map(p => renderProductCard(p)).join("") + moreLinkHtml;
    wireProductCards(grid);
}

function renderProductCard(p) {
    const stock = Number(p.stock) || 0;
    const inCartQty = cartQtyFor(p._id);
    const outOfStock = stock <= 0;

    let stockLineClass = "in", stockText = "In stock", flag = "";
    if (outOfStock) { stockLineClass = "low-text"; stockText = "Out of stock"; }
    else if (stock <= 20) { stockLineClass = "low-text"; stockText = `Only ${stock} left`; flag = '<span class="flag low">Low Stock</span>'; }

    const imageBlock = p.image
        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.remove()">`
        : "💊";

    const footer = outOfStock
        ? `<button class="add-btn" disabled>Out of Stock</button>`
        : `<div class="stepper">
             <button type="button" data-act="minus">−</button>
             <span class="qty-val" data-qty>1</span>
             <button type="button" data-act="plus">+</button>
           </div>
           <button class="add-btn" data-act="add">Add to Cart</button>`;

    return `
        <div class="card" data-product-id="${p._id}">
            <div class="card-photo">${imageBlock}${flag}</div>
            <div class="card-tear"></div>
            <div class="card-body">
                <div class="stock-line ${stockLineClass}"><span class="dot ${stockLineClass === 'low-text' ? 'low' : ''}"></span>${stockText}${inCartQty ? ` · ${inCartQty} in cart` : ""}</div>
                <h4>${escapeHtml(p.name)}</h4>
                <p class="desc">${escapeHtml(p.brand || "")}${p.brand && p.category ? " · " : ""}${escapeHtml(p.category || "")}</p>
                <div class="card-meta">
                    <div class="price-tag">${money(p.price)}${p.mrp && Number(p.mrp) > Number(p.price) ? `<span class="mrp">${money(p.mrp)}</span>` : ""}</div>
                </div>
                <div class="qty-row">${footer}</div>
            </div>
        </div>
    `;
}

function wireProductCards(grid) {
    grid.querySelectorAll(".card").forEach(card => {
        const pid = card.dataset.productId;
        const product = allProducts.find(p => p._id === pid);
        if (!product) return;
        const qtyEl = card.querySelector("[data-qty]");
        const minusBtn = card.querySelector('[data-act="minus"]');
        const plusBtn = card.querySelector('[data-act="plus"]');
        const addBtn = card.querySelector('[data-act="add"]');
        let qty = 1;

        if (minusBtn) minusBtn.addEventListener("click", () => {
            qty = Math.max(1, qty - 1);
            qtyEl.textContent = qty;
        });
        if (plusBtn) plusBtn.addEventListener("click", () => {
            qty = Math.min(Number(product.stock) || 1, qty + 1);
            qtyEl.textContent = qty;
        });
        if (addBtn) addBtn.addEventListener("click", () => {
            addToCart(product, qty);
            addBtn.classList.add("added");
            const original = addBtn.textContent;
            addBtn.textContent = "Added ✓";
            openCart();
            setTimeout(() => { addBtn.classList.remove("added"); addBtn.textContent = original; }, 1000);
        });
    });
}

/* ================= TICKER ================= */
const tickerItems = [
    "GENUINE STOCK ONLY", "PAY LATER OR CASH ON DELIVERY", "24–48 HR COLD CHAIN DISPATCH",
    "ASANSOL DEPOT · EST. 2004"
];
const track = document.getElementById("tickerTrack");
if (track) {
    track.innerHTML = tickerItems.concat(tickerItems).map(t => `<span>${t}</span>`).join("");
}

/* ================= SCROLL REVEAL ================= */
const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

/* ================= CART DRAWER ================= */
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");
const drawerBody = document.getElementById("drawerBody");
const drawerSubtotal = document.getElementById("drawerSubtotal");

function openCart() { drawer.classList.add("open"); overlay.classList.add("open"); }
function closeCart() { drawer.classList.remove("open"); overlay.classList.remove("open"); }

function renderCart() {
    if (!cart.length) {
        drawerBody.innerHTML = `<div class="drawer-empty">
            <p>No items added yet.</p>
            <p style="font-family:var(--mono); font-size:12px;">Browse the catalog and add products to your cart.</p>
        </div>`;
        drawerSubtotal.textContent = money(0);
        updateShareLinks(0);
        return;
    }
    let subtotal = 0;
    drawerBody.innerHTML = cart.map(item => {
        const lineTotal = item.qty * item.price;
        subtotal += lineTotal;
        return `
            <div class="drawer-item">
                <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" onerror="this.remove()">
                <div class="info">
                    <h5>${escapeHtml(item.name)}</h5>
                    <div class="meta">${item.qty} × ${money(item.price)} = ${money(lineTotal)}</div>
                    <button class="remove" data-remove="${item.product_id}">Remove</button>
                </div>
            </div>
        `;
    }).join("");
    drawerSubtotal.textContent = money(subtotal);
    drawerBody.querySelectorAll("[data-remove]").forEach(el => {
        el.addEventListener("click", () => removeFromCart(el.dataset.remove));
    });
    updateShareLinks(subtotal);
}

function updateShareLinks(subtotal) {
    const lines = cart.map(i => `• ${i.name} — ${i.qty} unit(s)`).join("%0A");
    const waText = `Hello Ashirbad Enterprise, I'd like to request a quote for:%0A${lines}%0A%0AEstimated subtotal: ${encodeURIComponent(money(subtotal))}`;
    document.getElementById("waBtn").href = `https://wa.me/919153866504?text=${waText}`;
    const mailBody = cart.map(i => `- ${i.name}: ${i.qty} unit(s)`).join("%0D%0A");
    document.getElementById("mailBtn").href = `mailto:procurementashirbadenter24@gmail.com?subject=Wholesale%20Requisition%20Request&body=Hello%2C%0D%0A%0D%0AI'd%20like%20to%20request%20a%20quote%20for%3A%0D%0A${mailBody}%0D%0A%0D%0AEstimated%20subtotal%3A%20${encodeURIComponent(money(subtotal))}`;
}

document.getElementById("cartOpenBtn").addEventListener("click", openCart);
document.getElementById("drawerClose").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

/* ================= CHECKOUT DRAWER (no auth) ================= */
const checkoutDrawer = document.getElementById("checkoutDrawer");
const checkoutOverlay = document.getElementById("checkoutOverlay");
const checkoutMsg = document.getElementById("checkoutMsg");
const optCod = document.getElementById("optCod");
const optUpi = document.getElementById("optUpi");
const upiBox = document.getElementById("upiBox");
const upiConfirmRow = document.getElementById("upiConfirmRow");
const upiConfirmCheckbox = document.getElementById("upiConfirmCheckbox");
const placeOrderBtn = document.getElementById("placeOrderBtn");

document.getElementById("checkoutBtn").addEventListener("click", () => {
    if (!cart.length) {
        showToast("Your cart is empty.", "error");
        return;
    }
    closeCart();
    openCheckout();
});

function openCheckout() {
    renderCheckoutSummary();
    selectPaymentMethod("cod");
    checkoutDrawer.classList.add("open");
    checkoutOverlay.classList.add("open");
}
function closeCheckout() { checkoutDrawer.classList.remove("open"); checkoutOverlay.classList.remove("open"); }
document.getElementById("checkoutClose").addEventListener("click", closeCheckout);
checkoutOverlay.addEventListener("click", closeCheckout);

function renderCheckoutSummary() {
    const total = cartTotal();
    document.getElementById("checkoutItems").innerHTML = cart.map(i =>
        `<div class="sum-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><b>${money(i.qty * i.price)}</b></div>`
    ).join("");
    document.getElementById("coTotal").textContent = money(total);
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    if (optCod) optCod.classList.toggle("active", method === "cod");
    if (optUpi) optUpi.classList.toggle("active", method === "upi");
    if (upiBox) upiBox.classList.toggle("hidden", method !== "upi");
    if (upiConfirmRow) upiConfirmRow.classList.toggle("hidden", method !== "upi");
    if (upiConfirmCheckbox) upiConfirmCheckbox.checked = false;
    if (method === "upi" && typeof renderUpiQr === "function") renderUpiQr();
}
if (optCod) optCod.addEventListener("click", () => selectPaymentMethod("cod"));

function fieldError(id, show) {
    document.getElementById(id).classList.toggle("invalid", show);
}
function showFormMsg(el, text, type) {
    el.textContent = text;
    el.className = "form-msg show " + type;
}

async function placeOrder() {
    const name = document.getElementById("coName").value.trim();
    const phone = document.getElementById("coPhone").value.trim();
    const address = document.getElementById("coAddress").value.trim();
    const notes = document.getElementById("coNotes").value.trim();

    let ok = true;
    fieldError("f-co-name", !name); if (!name) ok = false;
    const validPhone = /^[6-9]\d{9}$/.test(phone);
    fieldError("f-co-phone", !validPhone); if (!validPhone) ok = false;

    if (!ok) {
        showFormMsg(checkoutMsg, "Please fix the highlighted fields.", "error");
        return;
    }
    if (selectedPaymentMethod === "upi" && !upiConfirmCheckbox.checked) {
        showFormMsg(checkoutMsg, "Please confirm you've completed the UPI payment, or switch to Cash on Delivery.", "error");
        return;
    }

    const payload = {
        customer_name: name,
        phone,
        address,
        items: cart.map(item => ({
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            qty: item.qty,
        })),
        payment_method: selectedPaymentMethod,
        payment_status: "unpaid",
        source: "storefront",
        notes: selectedPaymentMethod === "upi"
            ? `Customer marked UPI payment as completed — please verify before dispatch. ${notes}`.trim()
            : `Cash on Delivery. ${notes}`.trim(),
    };

    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = "Placing order…";
    clearInterval(placeOrder._t);

    try {
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
            showFormMsg(checkoutMsg, data.message || "Unable to place order.", "error");
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = "Place Order";
            return;
        }

        document.getElementById("checkoutBody").innerHTML = `
            <div class="success-wrap">
                <div class="success-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <h3>Order Placed!</h3>
                <p class="field-hint" style="color:var(--ink-soft); font-size:13.5px;">
                    ${selectedPaymentMethod === "upi"
                        ? "We'll confirm your UPI payment shortly."
                        : "Pay in cash when your order is delivered."}
                </p>
                <div class="order-id">#AE-${data.order_no}</div>
            </div>
        `;
        document.querySelector('#checkoutDrawer .checkout-foot .drawer-actions').innerHTML =
            '<button type="button" class="btn btn-outline btn-block" id="continueShoppingBtn">Continue Shopping</button>';
        document.getElementById("continueShoppingBtn").addEventListener("click", () => {
            closeCheckout();
            window.location.reload();
        });

        cart = [];
        saveCart();
        renderCart();
        renderProducts();
    } catch (err) {
        showFormMsg(checkoutMsg, "Network error. Please try again.", "error");
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "Place Order";
    }
}
placeOrderBtn.addEventListener("click", placeOrder);

/* ================= INIT ================= */
loadCart();
saveCart();
renderCart();
loadProducts();