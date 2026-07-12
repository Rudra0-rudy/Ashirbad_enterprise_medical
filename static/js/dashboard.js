const statusPillClass = {
    pending: 'pill-amber',
    processing: 'pill-blue',
    shipped: 'pill-violet',
    delivered: 'pill-teal',
    cancelled: 'pill-red'
};

const paymentPillClass = {
    paid: 'pill-teal',
    unpaid: 'pill-amber',
    refunded: 'pill-red'
};

function statusPill(status) {
    const cls = statusPillClass[status] || 'pill-gray';
    return `<span class="pill ${cls}">${escapeHtml(status || 'unknown')}</span>`;
}

function paymentPill(status) {
    const cls = paymentPillClass[status] || 'pill-gray';
    return `<span class="pill ${cls}">${escapeHtml(status || 'unknown')}</span>`;
}

function renderPendingOrders(orders) {
    const body = document.getElementById('pendingOrdersBody');
    if (!orders.length) {
        body.innerHTML = '<tr><td colspan="5" class="cell-muted">No pending orders — you\'re all caught up.</td></tr>';
        return;
    }
    body.innerHTML = orders.map(o => `
        <tr class="row-clickable" onclick="openOrderDetail('${o._id}')">
            <td class="cell-mono" data-label="Order">#${o.order_no ?? '—'}</td>
            <td class="cell-strong" data-label="Customer">${escapeHtml(o.customer_name)}</td>
            <td class="cell-mono" data-label="Total">${formatCurrency(o.total)}</td>
            <td data-label="Payment">${paymentPill(o.payment_status)}</td>
            <td class="cell-muted" data-label="Placed">${formatDate(o.created_at)}</td>
        </tr>
    `).join('');
}

function renderUpcomingOrders(orders) {
    const body = document.getElementById('upcomingOrdersBody');
    if (!orders.length) {
        body.innerHTML = '<tr><td colspan="5" class="cell-muted">Nothing in progress right now.</td></tr>';
        return;
    }
    body.innerHTML = orders.map(o => `
        <tr class="row-clickable" onclick="openOrderDetail('${o._id}')">
            <td class="cell-mono" data-label="Order">#${o.order_no ?? '—'}</td>
            <td class="cell-strong" data-label="Customer">${escapeHtml(o.customer_name)}</td>
            <td class="cell-mono" data-label="Total">${formatCurrency(o.total)}</td>
            <td data-label="Status">${statusPill(o.status)}</td>
            <td class="cell-muted" data-label="Placed">${formatDate(o.created_at)}</td>
        </tr>
    `).join('');
}

function renderLowStock(products) {
    const body = document.getElementById('lowStockBody');
    if (!products.length) {
        body.innerHTML = '<tr><td colspan="5" class="cell-muted">Everything is well stocked.</td></tr>';
        return;
    }
    body.innerHTML = products.map(p => `
        <tr>
            <td class="cell-strong" data-label="Product">${escapeHtml(p.name)}</td>
            <td class="cell-muted" data-label="Brand">${escapeHtml(p.brand || '-')}</td>
            <td data-label="Stock"><span class="pill ${p.stock <= 5 ? 'pill-red' : 'pill-amber'}">${p.stock ?? 0} units</span></td>
            <td class="cell-mono" data-label="Batch">${escapeHtml(p.batch || '-')}</td>
            <td class="cell-muted" data-label="Expiry">${formatDate(p.expiry)}</td>
        </tr>
    `).join('');
}

async function loadDashboard() {
    try {
        const stats = await apiRequest('/api/dashboard/stats');

        document.getElementById('statTodayOrders').textContent = stats.today_orders_count;
        document.getElementById('statPendingPayment').textContent = formatCurrency(stats.pending_payment_amount);
        document.getElementById('statPendingPaymentFoot').textContent = `${stats.pending_payment_count} unpaid order${stats.pending_payment_count === 1 ? '' : 's'}`;
        document.getElementById('statPendingOrders').textContent = stats.pending_orders_count;
        document.getElementById('statUpcomingOrders').textContent = stats.upcoming_orders_count;

        document.getElementById('statRevenue').textContent = formatCurrency(stats.total_revenue);
        document.getElementById('statProducts').textContent = stats.total_products;
        document.getElementById('statCustomers').textContent = stats.total_customers;
        document.getElementById('statLowStock').textContent = stats.low_stock_count;

        renderPendingOrders(stats.pending_orders || []);
        renderUpcomingOrders(stats.upcoming_orders || []);
        renderLowStock(stats.low_stock_products || []);
    } catch (err) {
        showToast('Unable to load dashboard data.', 'error');
    }
}

/* ================= ORDER DETAIL MODAL ================= */
const orderDetailOverlay = document.getElementById('orderDetailOverlay');
let currentDetailOrderId = null;

async function openOrderDetail(orderId) {
    try {
        const order = await apiRequest(`/api/orders/${orderId}`);
        currentDetailOrderId = orderId;

        document.getElementById('detailOrderTitle').textContent = `Order #${order.order_no ?? ''}`;
        document.getElementById('detailCustomerName').textContent = order.customer_name || '-';
        document.getElementById('detailPhone').textContent = order.phone || '-';
        document.getElementById('detailAddress').textContent = order.address || '-';

        const items = order.items || [];
        document.getElementById('detailItemsBody').innerHTML = items.length
            ? items.map(i => `
                <tr>
                    <td>${escapeHtml(i.name || '')}</td>
                    <td>${i.qty ?? 0}</td>
                    <td>${formatCurrency(i.price)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" class="cell-muted">No items on this order.</td></tr>';
        document.getElementById('detailTotal').textContent = formatCurrency(order.total);

        document.getElementById('detailStatusSelect').value = order.status || 'pending';
        document.getElementById('detailPaymentSelect').value = order.payment_status || 'unpaid';
        document.getElementById('detailPaymentMethod').textContent = (order.payment_method || 'cod').toUpperCase();
        document.getElementById('detailSource').textContent = order.source === 'storefront' ? 'Storefront' : 'Admin (manual entry)';
        document.getElementById('detailCreatedAt').textContent = formatDate(order.created_at);

        const notesSection = document.getElementById('detailNotesSection');
        if (order.notes) {
            notesSection.classList.remove('hidden');
            document.getElementById('detailNotes').textContent = order.notes;
        } else {
            notesSection.classList.add('hidden');
        }

        document.getElementById('detailInvoiceLink').href = `/orders/${orderId}/invoice`;

        orderDetailOverlay.classList.add('open');
    } catch (err) {
        showToast('Unable to load order details.', 'error');
    }
}

function closeOrderDetail() {
    orderDetailOverlay.classList.remove('open');
    currentDetailOrderId = null;
}

document.getElementById('detailCloseBtn').addEventListener('click', closeOrderDetail);
orderDetailOverlay.addEventListener('click', (e) => {
    if (e.target === orderDetailOverlay) closeOrderDetail();
});

document.getElementById('detailSaveBtn').addEventListener('click', async () => {
    if (!currentDetailOrderId) return;
    const status = document.getElementById('detailStatusSelect').value;
    const paymentStatus = document.getElementById('detailPaymentSelect').value;

    try {
        await apiRequest(`/api/orders/${currentDetailOrderId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, payment_status: paymentStatus })
        });
        showToast('Order updated successfully.');
        closeOrderDetail();
        loadDashboard();
    } catch (err) {
        showToast(err.message || 'Unable to update order.', 'error');
    }
});

loadDashboard();