const apiBase = '/api/customers';
let editId = null;

const formFields = {
    name: document.getElementById('name'),
    business_name: document.getElementById('businessName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    gst_number: document.getElementById('gstNumber'),
    address: document.getElementById('address'),
};
const statusSelect = document.getElementById('status');
const customersBody = document.getElementById('customersBody');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

function resetForm() {
    editId = null;
    formTitle.textContent = 'Add Customer';
    submitBtn.textContent = 'Add Customer';
    cancelEditBtn.classList.add('hidden');
    Object.values(formFields).forEach(input => input.value = '');
    statusSelect.value = 'active';
}

function renderCustomers(customers) {
    if (!customers.length) {
        customersBody.innerHTML = '<tr><td colspan="7" class="cell-muted">No customers found.</td></tr>';
        return;
    }

    customersBody.innerHTML = customers.map(c => `
        <tr>
            <td class="cell-strong" data-label="Customer">${escapeHtml(c.name)}</td>
            <td class="cell-muted" data-label="Business">${escapeHtml(c.business_name || '-')}</td>
            <td class="cell-mono" data-label="Contact">${escapeHtml(c.phone || c.email || '-')}</td>
            <td class="cell-mono" data-label="Orders">${c.total_orders ?? 0}</td>
            <td class="cell-mono" data-label="Total Spent">${formatCurrency(c.total_spent)}</td>
            <td data-label="Status"><span class="pill ${c.status === 'blocked' ? 'pill-red' : 'pill-teal'}">${escapeHtml(c.status || 'active')}</span></td>
            <td class="row-actions" data-label="Actions">
                <button class="btn-secondary btn-sm" onclick="editCustomer('${c._id}')">Edit</button>
                <button class="btn-danger btn-sm" onclick="deleteCustomer('${c._id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function loadCustomers(query) {
    try {
        const url = query ? `${apiBase}?q=${encodeURIComponent(query)}` : apiBase;
        const customers = await apiRequest(url);
        renderCustomers(customers);
    } catch (error) {
        showToast('Unable to load customers. Check server connectivity.', 'error');
    }
}

async function saveCustomer() {
    if (!formFields.name.value.trim()) {
        showToast('Customer name is required.', 'error');
        return;
    }

    const payload = Object.fromEntries(Object.entries(formFields).map(([key, input]) => [key, input.value]));
    payload.status = statusSelect.value;

    const url = editId ? `${apiBase}/${editId}` : apiBase;
    const method = editId ? 'PUT' : 'POST';

    try {
        await apiRequest(url, { method, body: JSON.stringify(payload) });
        showToast(editId ? 'Customer updated successfully.' : 'Customer added successfully.');
        resetForm();
        loadCustomers();
    } catch (error) {
        showToast(error.message || 'Unable to save customer.', 'error');
    }
}

async function editCustomer(id) {
    try {
        const customer = await apiRequest(`${apiBase}/${id}`);
        editId = id;
        formTitle.textContent = 'Edit Customer';
        submitBtn.textContent = 'Update Customer';
        cancelEditBtn.classList.remove('hidden');
        Object.entries(formFields).forEach(([key, input]) => {
            input.value = customer[key] || '';
        });
        statusSelect.value = customer.status || 'active';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast('Unable to load customer for editing.', 'error');
    }
}

async function deleteCustomer(id) {
    if (!confirm('Delete this customer?')) return;
    try {
        await apiRequest(`${apiBase}/${id}`, { method: 'DELETE' });
        showToast('Customer deleted successfully.');
        loadCustomers();
    } catch (error) {
        showToast(error.message || 'Unable to delete customer.', 'error');
    }
}

submitBtn.addEventListener('click', saveCustomer);
cancelEditBtn.addEventListener('click', (event) => {
    event.preventDefault();
    resetForm();
});
searchBtn.addEventListener('click', () => loadCustomers(searchInput.value.trim()));
searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadCustomers(searchInput.value.trim());
});

loadCustomers();