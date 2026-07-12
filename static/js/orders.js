const apiBase = '/api/orders';
let editId = null;
let itemCounter = 0;

const itemsList = document.getElementById('itemsList');
const addItemBtn = document.getElementById('addItemBtn');
const ordersBody = document.getElementById('ordersBody');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const statusFilter = document.getElementById('statusFilter');
const orderTotalPreview = document.getElementById('orderTotalPreview');

const customerFields = {
    customer_name: document.getElementById('customerName'),
    phone: document.getElementById('phone'),
    address: document.getElementById('address'),
};
const orderStatus = document.getElementById('orderStatus');
const paymentStatus = document.getElementById('paymentStatus');
const notes = document.getElementById('notes');

const statusPillClass = {
    pending: 'pill-amber', processing: 'pill-blue', shipped: 'pill-violet',
    delivered: 'pill-teal', cancelled: 'pill-red'
};
const paymentPillClass = { paid: 'pill-teal', unpaid: 'pill-amber', refunded: 'pill-red' };

function addItemRow(item = {}) {
    itemCounter += 1;
    const rowId = `item-${itemCounter}`;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = rowId;
    row.innerHTML = `
        <input type="text" class="item-name" placeholder="Item name" value="${escapeHtml(item.name || '')}" />
        <input type="number" class="item-qty" min="1" placeholder="Qty" value="${item.qty || 1}" />
        <input type="number" class="item-price" min="0" step="0.01" placeholder="Unit price" value="${item.price || ''}" />
        <button type="button" class="item-row-remove">✕</button>
    `;
    row.querySelector('.item-row-remove').addEventListener('click', () => {
        row.remove();
        updateTotalPreview();
    });
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateTotalPreview));
    itemsList.appendChild(row);
    updateTotalPreview();
}

function collectItems() {
    return Array.from(itemsList.querySelectorAll('.item-row')).map(row => ({
        name: row.querySelector('.item-name').value.trim(),
        qty: Number(row.querySelector('.item-qty').value) || 0,
        price: Number(row.querySelector('.item-price').value) || 0,
    })).filter(item => item.name);
}

function updateTotalPreview() {
    const items = collectItems();
    const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    orderTotalPreview.textContent = `Total: ${formatCurrency(total)}`;
}

function resetForm() {
    editId = null;
    formTitle.textContent = 'Create Order';
    submitBtn.textContent = 'Create Order';
    cancelEditBtn.classList.add('hidden');
    Object.values(customerFields).forEach(input => input.value = '');
    orderStatus.value = 'pending';
    paymentStatus.value = 'unpaid';
    notes.value = '';
    itemsList.innerHTML = '';
    addItemRow();
}

function statusPill(status) {
    return `<span class="pill ${statusPillClass[status] || 'pill-gray'}">${escapeHtml(status || 'unknown')}</span>`;
}

function renderOrders(orders) {
    if (!orders.length) {
        ordersBody.innerHTML = '<tr><td colspan="9" class="cell-muted">No orders found.</td></tr>';
        return;
    }

    ordersBody.innerHTML = orders.map(o => `
        <tr>
            <td class="cell-mono" data-label="Order">#${o.order_no ?? '—'}</td>
            <td class="cell-strong" data-label="Customer">${escapeHtml(o.customer_name)}</td>
            <td data-label="Channel">
                <span class="pill ${o.source === 'storefront' ? 'pill-teal' : 'pill-gray'}">${o.source === 'storefront' ? 'Storefront' : 'Admin'}</span>
                <span class="pill pill-gray" style="margin-left:4px;">${(o.payment_method || 'cod').toUpperCase()}</span>
            </td>
            <td class="cell-muted" data-label="Items">${(o.items || []).length} item${(o.items || []).length === 1 ? '' : 's'}</td>
            <td class="cell-mono" data-label="Total">${formatCurrency(o.total)}</td>
            <td data-label="Payment">
                <select class="status-select" data-kind="payment" data-id="${o._id}" style="width:auto; padding:6px 10px; font-size:0.78rem;">
                    ${['unpaid', 'paid', 'refunded'].map(s => `<option value="${s}" ${o.payment_status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td data-label="Status">
                <select class="status-select" data-kind="status" data-id="${o._id}" style="width:auto; padding:6px 10px; font-size:0.78rem;">
                    ${['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td class="cell-muted" data-label="Placed">${formatDate(o.created_at)}</td>
            <td class="row-actions" data-label="Actions">
                <a class="btn-secondary btn-sm" href="/orders/${o._id}/invoice" target="_blank" style="text-decoration:none;">Invoice</a>
                <button class="btn-secondary btn-sm" onclick="editOrder('${o._id}')">Edit</button>
                <button class="btn-danger btn-sm" onclick="deleteOrder('${o._id}')">Delete</button>
            </td>
        </tr>
    `).join('');

    ordersBody.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', () => handleInlineStatusChange(select));
    });
}

async function handleInlineStatusChange(select) {
    const id = select.dataset.id;
    const kind = select.dataset.kind;
    const value = select.value;
    try {
        if (kind === 'status') {
            await apiRequest(`${apiBase}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: value }) });
        } else {
            await apiRequest(`${apiBase}/${id}`, { method: 'PUT', body: JSON.stringify({ payment_status: value }) });
        }
        showToast('Order updated successfully.');
    } catch (error) {
        showToast(error.message || 'Unable to update order.', 'error');
    }
}

let currentView = 'active';

async function loadOrders() {
    try {
        const params = new URLSearchParams();
        params.set('view', currentView);
        if (statusFilter.value !== 'all') params.set('status', statusFilter.value);
        if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
        const orders = await apiRequest(`${apiBase}?${params.toString()}`);
        renderOrders(orders);
    } catch (error) {
        showToast('Unable to load orders. Check server connectivity.', 'error');
    }
}

function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });
    const title = document.getElementById('ordersCardTitle');
    const sub = document.getElementById('ordersCardSub');
    if (view === 'history') {
        title.textContent = 'Order History';
        sub.textContent = 'Orders placed more than 7 days ago.';
    } else {
        title.textContent = 'Active Orders';
        sub.textContent = 'Orders placed in the last 7 days.';
    }
    loadOrders();
}

document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
});

async function saveOrder() {
    const items = collectItems();
    if (!customerFields.customer_name.value.trim()) {
        showToast('Customer name is required.', 'error');
        return;
    }
    if (!items.length) {
        showToast('Add at least one item to the order.', 'error');
        return;
    }

    const payload = {
        customer_name: customerFields.customer_name.value.trim(),
        phone: customerFields.phone.value.trim(),
        address: customerFields.address.value.trim(),
        items,
        status: orderStatus.value,
        payment_status: paymentStatus.value,
        notes: notes.value.trim(),
    };

    const url = editId ? `${apiBase}/${editId}` : apiBase;
    const method = editId ? 'PUT' : 'POST';

    try {
        await apiRequest(url, { method, body: JSON.stringify(payload) });
        showToast(editId ? 'Order updated successfully.' : 'Order created successfully.');
        resetForm();
        loadOrders();
    } catch (error) {
        showToast(error.message || 'Unable to save order.', 'error');
    }
}

async function editOrder(id) {
    try {
        const order = await apiRequest(`${apiBase}/${id}`);
        editId = id;
        formTitle.textContent = `Edit Order #${order.order_no}`;
        submitBtn.textContent = 'Update Order';
        cancelEditBtn.classList.remove('hidden');

        customerFields.customer_name.value = order.customer_name || '';
        customerFields.phone.value = order.phone || '';
        customerFields.address.value = order.address || '';
        orderStatus.value = order.status || 'pending';
        paymentStatus.value = order.payment_status || 'unpaid';
        notes.value = order.notes || '';

        itemsList.innerHTML = '';
        (order.items || []).forEach(item => addItemRow(item));
        if (!order.items || !order.items.length) addItemRow();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast('Unable to load order for editing.', 'error');
    }
}

async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    try {
        await apiRequest(`${apiBase}/${id}`, { method: 'DELETE' });
        showToast('Order deleted successfully.');
        loadOrders();
    } catch (error) {
        showToast(error.message || 'Unable to delete order.', 'error');
    }
}

submitBtn.addEventListener('click', saveOrder);
addItemBtn.addEventListener('click', () => addItemRow());
cancelEditBtn.addEventListener('click', (event) => {
    event.preventDefault();
    resetForm();
});
searchBtn.addEventListener('click', loadOrders);
searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadOrders();
});
statusFilter.addEventListener('change', loadOrders);

resetForm();
loadOrders();