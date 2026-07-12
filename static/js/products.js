const apiBase = '/api/products';
let editId = null;

const formFields = {
    name: document.getElementById('name'),
    brand: document.getElementById('brand'),
    category: document.getElementById('category'),
    price: document.getElementById('price'),
    mrp: document.getElementById('mrp'),
    stock: document.getElementById('stock'),
    expiry: document.getElementById('expiry'),
    batch: document.getElementById('batch'),
    description: document.getElementById('description'),
    image: document.getElementById('image')
};
const productsGrid = document.getElementById('productsGrid');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

function resetForm() {
    editId = null;
    formTitle.textContent = 'Add Product';
    submitBtn.textContent = 'Add Product';
    cancelEditBtn.classList.add('hidden');
    Object.values(formFields).forEach(input => input.value = '');
}

function stockPill(stock) {
    stock = Number(stock) || 0;
    if (stock <= 5) return `<span class="pill pill-red">${stock} in stock</span>`;
    if (stock <= 20) return `<span class="pill pill-amber">${stock} in stock</span>`;
    return `<span class="pill pill-teal">${stock} in stock</span>`;
}

function renderProducts(products) {
    if (!products.length) {
        productsGrid.innerHTML = '<div class="empty-state"><p>&#128203;</p><p>No products found. Add one using the form above.</p></div>';
        return;
    }

    productsGrid.innerHTML = products.map(product => {
        const expired = product.expiry ? new Date(product.expiry) < new Date() : false;
        return `
            <div class="product-card">
                <div class="product-info">
                    <p class="product-title">${escapeHtml(product.name || 'Untitled')}</p>
                    <p class="product-meta">Brand: ${escapeHtml(product.brand || 'N/A')} • Category: ${escapeHtml(product.category || 'N/A')}</p>
                    <div class="product-tags">
                        <span class="pill pill-blue">${formatCurrency(product.price)}</span>
                        <span class="pill pill-gray">MRP ${formatCurrency(product.mrp)}</span>
                        ${stockPill(product.stock)}
                        ${product.expiry ? `<span class="pill pill-gray">Exp ${formatDate(product.expiry)}</span>` : ''}
                        ${expired ? '<span class="pill pill-red">Expired</span>' : ''}
                    </div>
                    <p class="product-meta" style="margin-top:8px;">Batch: ${escapeHtml(product.batch || '-')}${product.description ? `<br>${escapeHtml(product.description)}` : ''}</p>
                </div>
                <div class="actions row-actions" style="align-items:flex-start;">
                    <button class="btn-secondary btn-sm" onclick="editProduct('${product._id}')">Edit</button>
                    <button class="btn-danger btn-sm" onclick="deleteProduct('${product._id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

async function loadProducts(query) {
    try {
        const url = query ? `${apiBase}/search?q=${encodeURIComponent(query)}` : apiBase;
        const products = await apiRequest(url);
        renderProducts(products);
    } catch (error) {
        showToast('Unable to load products. Check server connectivity.', 'error');
    }
}

async function saveProduct() {
    if (!formFields.name.value.trim()) {
        showToast('Product name is required.', 'error');
        return;
    }

    const payload = Object.fromEntries(Object.entries(formFields).map(([key, input]) => [key, input.value]));
    const url = editId ? `${apiBase}/${editId}` : apiBase;
    const method = editId ? 'PUT' : 'POST';

    try {
        await apiRequest(url, { method, body: JSON.stringify(payload) });
        showToast(editId ? 'Product updated successfully.' : 'Product added successfully.');
        resetForm();
        loadProducts();
    } catch (error) {
        showToast(error.message || 'Unable to save product.', 'error');
    }
}

async function editProduct(id) {
    try {
        const product = await apiRequest(`${apiBase}/${id}`);
        editId = id;
        formTitle.textContent = 'Edit Product';
        submitBtn.textContent = 'Update Product';
        cancelEditBtn.classList.remove('hidden');
        Object.entries(formFields).forEach(([key, input]) => {
            input.value = product[key] || '';
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast('Unable to load product for editing.', 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
        await apiRequest(`${apiBase}/${id}`, { method: 'DELETE' });
        showToast('Product deleted successfully.');
        loadProducts();
    } catch (error) {
        showToast(error.message || 'Unable to delete product.', 'error');
    }
}

submitBtn.addEventListener('click', saveProduct);
cancelEditBtn.addEventListener('click', (event) => {
    event.preventDefault();
    resetForm();
});
searchBtn.addEventListener('click', () => loadProducts(searchInput.value.trim()));
searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadProducts(searchInput.value.trim());
});

loadProducts();
