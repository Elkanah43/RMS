// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- STATE MANAGEMENT ---
    // This is our application's "database". We'll use localStorage to persist data.
    // REFACTORED: State is now managed by the Python backend.
    // This 'state' object will be populated by an API call.
    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let state = {
        tenants: [],
        properties: [],
        payments: [],
    };

    // --- DOM ELEMENT SELECTORS ---
    // Getting references to all the HTML elements we'll need to interact with.
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');
    
    // Dashboard elements
    const totalTenantsEl = document.getElementById('total-tenants');
    const availableUnitsEl = document.getElementById('available-units');
    const rentPaidEl = document.getElementById('rent-paid');
    const rentUnpaidEl = document.getElementById('rent-unpaid');

    // Tenant elements
    const tenantListEl = document.getElementById('tenant-list');
    const addTenantBtn = document.getElementById('add-tenant-btn');
    const tenantModal = document.getElementById('tenant-modal');
    const tenantForm = document.getElementById('tenant-form');
    const cancelTenantBtn = document.getElementById('cancel-tenant-btn');
    const tenantUnitSelect = document.getElementById('tenant-unit');

    // Property elements
    const propertyListEl = document.getElementById('property-list');
    const addPropertyBtn = document.getElementById('add-property-btn');
    const propertyModal = document.getElementById('property-modal');
    const propertyForm = document.getElementById('property-form');
    const cancelPropertyBtn = document.getElementById('cancel-property-btn');

    // Rent Modal elements
    const rentModal = document.getElementById('rent-modal');
    const rentModalTitle = document.getElementById('rent-modal-title');
    const rentStatusContainer = document.getElementById('rent-status-container');
    const closeRentBtn = document.getElementById('close-rent-btn');

    // --- DATA FETCHING FUNCTIONS ---
    // Functions to get data from our Python backend.

    const loadData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/data`);
            state = await response.json();
        } catch (error) {
            console.error('Failed to load data from backend:', error);
            alert('Could not connect to the backend. Please make sure it is running.');
        }
    };

    // --- RENDER FUNCTIONS ---
    // These functions take data from our 'state' and display it on the page.

    const renderDashboard = () => {
        const totalTenants = state.tenants.length;
        const occupiedUnits = state.tenants.length;
        const totalUnits = state.properties.length;
        const availableUnits = totalUnits - occupiedUnits;

        // Calculate rent for the current month
        const currentMonth = new Date().getMonth(); // 0-11
        const currentYear = new Date().getFullYear();

        let paidCount = 0;
        state.payments.forEach(p => {
            if (p.year === currentYear && p.month === currentMonth && p.status === 'paid') {
                paidCount++;
            }
        });
        
        const unpaidCount = totalTenants - paidCount;

        totalTenantsEl.textContent = totalTenants;
        availableUnitsEl.textContent = availableUnits > 0 ? availableUnits : 0;
        rentPaidEl.textContent = paidCount;
        rentUnpaidEl.textContent = unpaidCount > 0 ? unpaidCount : 0;
    };

    const renderTenants = () => {
        tenantListEl.innerHTML = ''; // Clear existing list
        state.tenants.forEach(tenant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tenant.name}</td>
                <td>${tenant.contact}</td>
                <td>${state.properties.find(p => p.id === tenant.unitId)?.name || 'N/A'}</td>
                <td>
                    <button class="action-btn rent-btn" data-id="${tenant.id}">Rent</button>
                    <button class="action-btn edit-btn" data-id="${tenant.id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${tenant.id}">Delete</button>
                </td>
            `;
            tenantListEl.appendChild(row);
        });
    };

    const renderProperties = () => {
        propertyListEl.innerHTML = ''; // Clear existing list
        state.properties.forEach(property => {
            const isOccupied = state.tenants.some(t => t.unitId === property.id);
            const status = isOccupied ? 'Occupied' : 'Vacant';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${property.name}</td>
                <td>${status}</td>
                <td>
                     <button class="action-btn delete-btn" data-id="${property.id}">Delete</button>
                </td>
            `;
            propertyListEl.appendChild(row);
        });
    };
    
    const populateAvailableUnits = () => {
        tenantUnitSelect.innerHTML = '<option value="" disabled selected>Select a unit</option>';
        const occupiedUnitIds = state.tenants.map(t => t.unitId);
        const availableUnits = state.properties.filter(p => !occupiedUnitIds.includes(p.id));
        
        availableUnits.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.name;
            tenantUnitSelect.appendChild(option);
        });
    };

    // --- NAVIGATION ---
    const switchView = (viewId) => {
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewId}-view`).classList.add('active');

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewId) {
                link.classList.add('active');
            }
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(e.target.dataset.view);
        });
    });

    // --- MODAL & FORM HANDLING ---

    // Tenant Modal
    addTenantBtn.addEventListener('click', () => {
        tenantForm.reset();
        document.getElementById('tenant-id').value = '';
        document.getElementById('tenant-modal-title').textContent = 'Add New Tenant';
        populateAvailableUnits();
        tenantModal.showModal();
    });

    cancelTenantBtn.addEventListener('click', () => tenantModal.close());

    tenantForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('tenant-id').value;
        const tenantData = {
            name: document.getElementById('tenant-name').value,
            contact: document.getElementById('tenant-contact').value,
            unitId: parseInt(document.getElementById('tenant-unit').value)
        };

        try {
            let response;
            if (id) { // Editing existing tenant
                response = await fetch(`${API_BASE_URL}/tenants/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tenantData)
                });
            } else { // Adding new tenant
                response = await fetch(`${API_BASE_URL}/tenants`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tenantData)
                });
            }
            if (!response.ok) throw new Error('Failed to save tenant');
            
            await loadData(); // Reload all data from backend
            renderAll();
        } catch (error) {
            console.error('Error saving tenant:', error);
            alert('An error occurred while saving the tenant.');
        }

        tenantModal.close();
    });
    
    // Property Modal
    addPropertyBtn.addEventListener('click', () => {
        propertyForm.reset();
        propertyModal.showModal();
    });

    cancelPropertyBtn.addEventListener('click', () => propertyModal.close());
    
    propertyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const propertyData = {
            name: document.getElementById('property-name').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(propertyData)
            });
            if (!response.ok) throw new Error('Failed to save property');
            await loadData();
            renderAll();
        } catch (error) {
            console.error('Error saving property:', error);
            alert('An error occurred while saving the property.');
        }
        propertyModal.close();
    });

    // --- EVENT DELEGATION FOR DYNAMIC CONTENT (Edit/Delete buttons) ---
    
    // Tenant actions
    tenantListEl.addEventListener('click', (e) => {
        const handleTenantAction = async () => {
        const target = e.target;
            const id = parseInt(target.dataset.id);

        if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this tenant?')) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/tenants/${id}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Failed to delete tenant');
                        await loadData();
                        renderAll();
                    } catch (error) {
                        console.error('Error deleting tenant:', error);
                        alert('An error occurred while deleting the tenant.');
                    }
            }
        }
        
        if (target.classList.contains('edit-btn')) {
            const tenant = state.tenants.find(t => t.id == id);
            document.getElementById('tenant-id').value = tenant.id;
            document.getElementById('tenant-name').value = tenant.name;
            document.getElementById('tenant-contact').value = tenant.contact;
            document.getElementById('tenant-modal-title').textContent = 'Edit Tenant';
            
            // Populate units, including the one currently assigned to this tenant
            populateAvailableUnits();
            const currentUnitOption = document.createElement('option');
            const unit = state.properties.find(p => p.id === tenant.unitId);
            if(unit) {
                currentUnitOption.value = unit.id;
                currentUnitOption.textContent = unit.name;
                tenantUnitSelect.appendChild(currentUnitOption);
                tenantUnitSelect.value = tenant.unitId;
            }
            
            tenantModal.showModal();
        }

        if (target.classList.contains('rent-btn')) {
            openRentModal(id);
        }
        };
        handleTenantAction();
    });
    
    // Property actions
    propertyListEl.addEventListener('click', (e) => {
        const handlePropertyAction = async () => {
        const target = e.target;
            const id = parseInt(target.dataset.id);
        
        if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this property?')) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/properties/${id}`, { method: 'DELETE' });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to delete property');
                        }
                        await loadData();
                        renderAll();
                    } catch (error) {
                        console.error('Error deleting property:', error);
                        // The backend provides a user-friendly message here
                        alert(error.message);
                    }
            }
        }
        };
        handlePropertyAction();
    });

    // --- RENT TRACKING LOGIC ---

    const openRentModal = (tenantId) => {
        const tenant = state.tenants.find(t => t.id == tenantId);
        rentModalTitle.textContent = `Rent Status for ${tenant.name}`;
        rentStatusContainer.innerHTML = ''; // Clear previous content
        
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        months.forEach((month, index) => {
            const payment = state.payments.find(p => p.tenantId == tenantId && p.year === currentYear && p.month === index);
            const status = payment ? payment.status : 'unpaid';
            
            const monthDiv = document.createElement('div');
            monthDiv.className = `month-status ${status}`;
            monthDiv.innerHTML = `
                <h4>${month} ${currentYear}</h4>
                <p>${status.toUpperCase()}</p>
                <button data-tenant-id="${tenantId}" data-month="${index}" data-year="${currentYear}">
                    Mark as ${status === 'paid' ? 'Unpaid' : 'Paid'}
                </button>
            `;
            rentStatusContainer.appendChild(monthDiv);
        });
        
        rentModal.showModal();
    };

    closeRentBtn.addEventListener('click', () => rentModal.close());
    
    rentStatusContainer.addEventListener('click', async (e) => {
    if (e.target.tagName !== 'BUTTON') return;

    const { tenantId, month, year } = e.target.dataset;

    try {
        const response = await fetch(`${API_BASE_URL}/payments/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: parseInt(tenantId), month: parseInt(month), year: parseInt(year) }),
        });

        if (!response.ok) {
            throw new Error('Failed to update payment status.');
        }

        // Successfully updated on the server, now refresh the UI
        await loadData(); // Re-fetch all data to get the latest state
        renderAll(); // Re-render everything with the new data
        openRentModal(parseInt(tenantId)); // Re-open the modal to show the change

    } catch (error) {
        console.error('Error updating payment:', error);
        alert('Could not update payment status.');
    }
});

    // --- INITIALIZATION ---
    const renderAll = () => {
        renderDashboard();
        renderTenants();
        renderProperties();
    };

    const init = async () => {
        await loadData();
        renderAll();
        switchView('dashboard'); // Start on the dashboard
    };

    init(); // Let's get the party started!
});