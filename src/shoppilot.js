/**
 * shoPPilot IMS - Main Controller
 * Preserved from original index.html with Supabase Compatibility
 */

const SCRIPT_URL = window.location.pathname;
let CURRENT_USER = (window.BackendService && window.BackendService.getCurrentUser()) || {
    User_ID: 'U0001',
    Name: 'Admin Operator',
    Role: 'Admin'
};

let activePage = 'dashboard';
let salesChart = null, categoryChart = null;
let recentSalesData = [];
let allExpenses = [];
let multiPurchItems = []; 
let customConfirmCallback = null;
let currentReturnInvoiceData = null;
let qsHoldTimer = null;
let qsHoldInterval = null;
let filteredCustomers = [];

let whMergedChartInstances = [];
let whCategoryBarChartInstance = null;
let allWhTotalChartInstance = null;
let currentCashInHand = 0;
let masterBankList = [];
let masterExpenseCategoryList = [];
let allDepositsList = [];
let depPage = 1;
const depRowsPerPage = 10;
let currentQpMatches = [];

// DATA CACHES & MAPS
let productMap = {}, categoryMap = {}, brandMap = {}, customerMap = {}, supplierMap = {}, latestCostMap = {};
let allProducts = [], filteredProducts = [], allPurchases = [], allLedger = [], filteredLedger = [];
let allCustomers = [], allSuppliers = [], warehouseList = [], whStockData = [];
let quickCart = [], quickProducts = [], lastQsSaleSnapshot = null;
let qp_cart = [], qp_master_products = [], qp_lastData = null;
let posCart = [], posAvailableBatches = [];
let trf_availableBatches = [];
let inboundPurchaseItems = [];
let purchasesHistoryFilter = '';

// PAGINATION STATES
const rowsPerPage = 10;
let prodPage = 1, purchPage = 1, invPage = 1, custPage = 1;

// COMPANY BRANDING DYNAMIC SYNC
window.applyCompanyNameUI = function(name) {
    const companyName = (name && String(name).trim()) || 'shoPPilot';

    // 1. Sidebar header
    const sidebarLogo = document.getElementById('sidebarLogoText');
    if (sidebarLogo) {
        sidebarLogo.textContent = companyName;
        sidebarLogo.title = companyName;
    }

    // 2. Login page name
    const authTitle = document.getElementById('authCompanyTitle');
    if (authTitle) {
        authTitle.textContent = companyName;
    }

    // 3. Settings form input (if not actively being typed by user)
    const compInput = document.querySelector('#systemSettingsForm input[name="COMPANY_NAME"]');
    if (compInput && document.activeElement !== compInput) {
        compInput.value = companyName;
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('SP_COMPANY_NAME', companyName);
        }
    } catch (e) {}
};

window.loadSystemConfig = function() {
    google.script.run
        .withSuccessHandler(settings => {
            if (!settings) return;
            const companyName = settings.COMPANY_NAME || 'shoPPilot';
            window.applyCompanyNameUI(companyName);

            const form = document.getElementById('systemSettingsForm');
            if (form) {
                if (form.elements['COMPANY_NAME'] && document.activeElement !== form.elements['COMPANY_NAME']) {
                    form.elements['COMPANY_NAME'].value = companyName;
                }
                if (form.elements['CURRENCY_SYMBOL'] && settings.CURRENCY_SYMBOL && document.activeElement !== form.elements['CURRENCY_SYMBOL']) {
                    form.elements['CURRENCY_SYMBOL'].value = settings.CURRENCY_SYMBOL;
                }
                if (form.elements['OPENING_CASH_BALANCE'] && settings.OPENING_CASH_BALANCE !== undefined && document.activeElement !== form.elements['OPENING_CASH_BALANCE']) {
                    form.elements['OPENING_CASH_BALANCE'].value = settings.OPENING_CASH_BALANCE;
                }
            }
        })
        .getSettings();
};

// Live preview when typing Company Name in settings
document.addEventListener('input', (e) => {
    if (e.target && e.target.name === 'COMPANY_NAME' && e.target.closest('#systemSettingsForm')) {
        const val = e.target.value.trim();
        const sidebarLogo = document.getElementById('sidebarLogoText');
        if (sidebarLogo) {
            sidebarLogo.textContent = val || 'shoPPilot';
        }
        const authTitle = document.getElementById('authCompanyTitle');
        if (authTitle) {
            authTitle.textContent = val || 'shoPPilot';
        }
    }
});

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        const cachedName = localStorage.getItem('SP_COMPANY_NAME');
        if (cachedName) window.applyCompanyNameUI(cachedName);
    } catch (e) {}
    window.loadSystemConfig();

    CURRENT_USER = (window.BackendService && window.BackendService.getCurrentUser()) || { User_ID: '', Name: '', Role: '' };
    if (!CURRENT_USER.User_ID) {
        if (window.checkAppAuthState) window.checkAppAuthState();
        return;
    }
    if (window.checkAppAuthState) window.checkAppAuthState();
    initCharts();
    loadGlobalMetadata();
    switchAppView(activePage);

    document.addEventListener('click', (e) => {
        const dd = document.getElementById('purch_search_dropdown');
        const inp = document.getElementById('purch_search_input');
        if (dd && dd.style.display !== 'none') {
            if (!dd.contains(e.target) && e.target !== inp) {
                dd.style.display = 'none';
            }
        }
    });
});

// VIEW SWITCHING
window.switchAppView = function(viewName) {
    activePage = viewName;
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active-view'));
    document.querySelectorAll('.nav-link').forEach(lnk => lnk.classList.remove('active'));

    const targetSection = document.getElementById('view_' + viewName);
    if (targetSection) targetSection.classList.add('active-view');

    document.querySelectorAll(`.nav-link`).forEach(lnk => {
        if (lnk.getAttribute('onclick')?.includes(`'${viewName}'`)) lnk.classList.add('active');
    });

    if (window.innerWidth <= 992) {
        const sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('mobile-open')) toggleMobileMenu();
    }

    if (viewName === 'dashboard') loadDashboardData();
    else if (viewName === 'warehouse_info') loadWarehouseInfoData();
    else if (viewName === 'inventory') loadInventoryData();
    else if (viewName === 'products') loadProductsData();
    else if (viewName === 'sales') initPosView();
    else if (viewName === 'returns') initSalesReturnsView();
    else if (viewName === 'purchases') loadPurchasesData();
    else if (viewName === 'purchase_returns') initPurchaseReturnsView();
    else if (viewName === 'customers') loadCustomerData();
    else if (viewName === 'suppliers') loadSupplierData();
    else if (viewName === 'reports') initReportsView();
    else if (viewName === 'settings') {
        refreshMasterLists();
        window.loadSystemConfig();
    }
    else if (viewName === 'data_management') {
        if (window.initDataManagementView) window.initDataManagementView();
    }
    else if (viewName === 'users') loadUsersData();
    else if (viewName === 'deposits') loadDepositsView();
};

window.loadGlobalMetadata = function() {
    if (typeof window.loadSystemConfig === 'function') window.loadSystemConfig();
    google.script.run.withSuccessHandler(data => {
        warehouseList = data || [];
        const qpSel = document.getElementById('qp_warehouse_select');
        const qsSel = document.getElementById('qs_warehouse');
        const pWhSel = document.getElementById('p_warehouse');
        const pPurchWhSel = document.getElementById('p_purch_warehouse');

        const opts = (data || []).map(w => {
            const isInactive = w.Status === 'Inactive' || w.status === 'Inactive';
            const name = w.Warehouse_Name || w.warehouse_name;
            const id = w.Warehouse_ID || w.warehouse_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
        if (qpSel) qpSel.innerHTML = opts;
        if (qsSel) qsSel.innerHTML = opts;
        if (pWhSel) pWhSel.innerHTML = opts;
        if (pPurchWhSel) pPurchWhSel.innerHTML = opts;
    }).getWarehouses();

    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(c => categoryMap[c.Category_ID || c.category_id] = c.Category_Name || c.category_name);
        const pCat = document.getElementById('p_category');
        if (pCat) pCat.innerHTML = '<option value="">Select Category</option>' + (data || []).map(c => {
            const isInactive = c.Status === 'Inactive' || c.status === 'Inactive';
            const name = c.Category_Name || c.category_name;
            const id = c.Category_ID || c.category_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
        const invCat = document.getElementById('invFilterCategory');
        if (invCat) invCat.innerHTML = '<option value="">All Categories</option>' + (data || []).map(c => {
            const isInactive = c.Status === 'Inactive' || c.status === 'Inactive';
            const name = c.Category_Name || c.category_name;
            const id = c.Category_ID || c.category_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
        const prodCat = document.getElementById('productFilterCategory');
        if (prodCat) prodCat.innerHTML = '<option value="">All Categories</option>' + (data || []).map(c => {
            const isInactive = c.Status === 'Inactive' || c.status === 'Inactive';
            const name = c.Category_Name || c.category_name;
            const id = c.Category_ID || c.category_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
        const payCat = document.getElementById('pay_category');
        if (payCat) payCat.innerHTML = '<option value="">All / General</option>' + (data || []).map(c => {
            const name = c.Category_Name || c.category_name;
            return `<option value="${name}">${name}</option>`;
        }).join('');
    }).getData('Categories');

    google.script.run.withSuccessHandler(data => {
        const payBank = document.getElementById('pay_bank_name');
        if (payBank) {
            payBank.innerHTML = '<option value="">-- Select Bank (Optional) --</option>' + 
                (data || []).map(b => {
                    const isInactive = b.Status === 'Inactive' || b.status === 'Inactive';
                    const name = b.Bank_Name || b.bank_name;
                    return `<option value="${name}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
                }).join('');
        }
    }).getData('Settings_Banks');

    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(b => brandMap[b.Brand_ID || b.brand_id] = b.Brand_Name || b.brand_name);
        const pBrand = document.getElementById('p_brand');
        if (pBrand) pBrand.innerHTML = '<option value="">Select Brand</option>' + (data || []).map(b => {
            const isInactive = b.Status === 'Inactive' || b.status === 'Inactive';
            const name = b.Brand_Name || b.brand_name;
            const id = b.Brand_ID || b.brand_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
        const invBrand = document.getElementById('invFilterBrand');
        if (invBrand) invBrand.innerHTML = '<option value="">All Brands</option>' + (data || []).map(b => {
            const isInactive = b.Status === 'Inactive' || b.status === 'Inactive';
            const name = b.Brand_Name || b.brand_name;
            const id = b.Brand_ID || b.brand_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
        const prodBrand = document.getElementById('productFilterBrand');
        if (prodBrand) prodBrand.innerHTML = '<option value="">All Brands</option>' + (data || []).map(b => {
            const isInactive = b.Status === 'Inactive' || b.status === 'Inactive';
            const name = b.Brand_Name || b.brand_name;
            const id = b.Brand_ID || b.brand_id;
            return `<option value="${id}">${name}${isInactive ? ' (Inactive)' : ''}</option>`;
        }).join('');
    }).getData('Brands');

    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(p => productMap[p.Product_ID] = p);
    }).getData('Products');

    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(c => customerMap[c.Customer_ID] = c.Customer_Name);
    }).getData('Customers');

    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(s => supplierMap[s.Supplier_ID] = s.Supplier_Name);
        const pPurchSupp = document.getElementById('p_purch_supplier');
        if (pPurchSupp) {
            pPurchSupp.innerHTML = '<option value="">Select Supplier</option>' + 
                (data || []).map(s => `<option value="${s.Supplier_ID}">${s.Supplier_Name}</option>`).join('');
        }
        const qpSupp = document.getElementById('qp_supplier_select');
        if (qpSupp) {
            qpSupp.innerHTML = '<option value="">Select Supplier</option>' + 
                (data || []).map(s => `<option value="${s.Supplier_ID}">${s.Supplier_Name}</option>`).join('');
        }
    }).getData('Suppliers');
};

// Formatting helpers
window.formatBD = function(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(Number(num))) return '0';
    const n = Number(num);
    if (decimals > 0) {
        return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return Math.round(n).toLocaleString('en-IN');
};

window.numberToWordsCroreLakh = function(num) {
    num = Math.round(parseFloat(num) || 0);
    if (num <= 0) return "Zero";
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function twoDigits(n) {
        if (n < 20) return ones[n];
        const t = Math.floor(n / 10);
        const o = n % 10;
        return tens[t] + (o > 0 ? " " + ones[o] : "");
    }
    const crore = Math.floor(num / 10000000);
    const rem = num % 10000000;
    const lakh = Math.floor(rem / 100000);
    let parts = [];
    if (crore > 0) parts.push(twoDigits(crore) + " Crore");
    if (lakh > 0) parts.push(twoDigits(lakh) + " Lakh");
    if (parts.length === 0) {
        if (num >= 1000) parts.push(twoDigits(Math.floor(num / 1000)) + " Thousand");
        else parts.push(twoDigits(num));
    }
    return parts.join(" ");
};

window.formatCtnPcs = function(totalPcs, packSize) {
    totalPcs = parseFloat(totalPcs) || 0;
    packSize = parseInt(packSize) || 1;
    if (packSize <= 1) return `${totalPcs} pcs`;
    const ctn = Math.floor(totalPcs / packSize);
    const pcs = Math.round(totalPcs % packSize);
    if (ctn > 0 && pcs > 0) return `${ctn} CTN + ${pcs} pcs (${totalPcs})`;
    if (ctn > 0) return `${ctn} CTN (${totalPcs} pcs)`;
    return `${pcs} pcs`;
};

// UI helpers
window.openModal = function(idOrEl) {
    if (!idOrEl) return;
    const m = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (m && m.style) m.style.display = 'flex';
};

window.closeModal = function(idOrEl) {
    if (!idOrEl) return;
    const m = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (m && m.style) m.style.display = 'none';
};

window.showAlertModal = function(title, msg) {
    const t = document.getElementById('generalAlertTitle');
    if (t) t.textContent = title || '';
    const m = document.getElementById('generalAlertMsg');
    if (m) m.textContent = msg || '';
    const modal = document.getElementById('generalAlertModal');
    if (modal && modal.style) modal.style.display = 'flex';
};

window.toggleSidebar = function() {
    const sb = document.getElementById('sidebar');
    const icon = document.getElementById('toggleIcon');
    if (sb) sb.classList.toggle('collapsed');
    if (icon && sb) {
        icon.classList.toggle('fa-chevron-right', sb.classList.contains('collapsed'));
        icon.classList.toggle('fa-chevron-left', !sb.classList.contains('collapsed'));
    }
};

window.toggleMobileMenu = function() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('mobile-open');
};

window.openLogoutModal = function() {
    const modal = document.getElementById('logoutConfirmModal');
    if (modal && modal.style) modal.style.display = 'flex';
};

window.executeLogout = function() {
    const uInp = document.getElementById('authUserId');
    if (uInp) uInp.value = '';
    const pInp = document.getElementById('authPassword');
    if (pInp) {
        pInp.value = '';
        pInp.type = 'password';
    }
    const eyeIcon = document.getElementById('toggleAuthEyeIcon');
    if (eyeIcon) eyeIcon.className = 'far fa-eye';

    if (window.BackendService && typeof window.BackendService.logout === 'function') {
        window.BackendService.logout();
    } else {
        localStorage.removeItem('shoppilot_active_user');
        sessionStorage.removeItem('shoppilot_active_user');
    }
    window.location.reload();
};

window.handleLoginSubmit = function() {
    const uInp = document.getElementById('authUserId');
    const pInp = document.getElementById('authPassword');
    const u = uInp?.value?.trim() || '';
    const p = pInp?.value?.trim() || '';
    const btn = document.getElementById('btnSignIn');
    const err = document.getElementById('loginErrorMsg');

    if (!u || !p) return showAlertModal("Validation", "Please enter User ID and Password.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    err.style.display = 'none';

    google.script.run
        .withSuccessHandler(isValid => {
            if (isValid) {
                if (pInp) pInp.value = '';
                window.location.reload();
            } else {
                btn.disabled = false;
                btn.innerHTML = 'Sign In';
                if (pInp) pInp.value = '';
                err.textContent = "Invalid User ID or Password";
                err.style.display = 'block';
            }
        })
        .withFailureHandler(e => {
            btn.disabled = false;
            btn.innerHTML = 'Sign In';
            if (pInp) pInp.value = '';
            showAlertModal("System Error", e.message);
        })
        .validateLogin(u, p);
};

// CHARTS
window.initCharts = function() {
    const salesCtx = document.getElementById('salesChart')?.getContext('2d');
    if (salesCtx) {
        salesChart = new Chart(salesCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Sales', data: [], borderColor: '#4cc9f0', fill: true, tension: 0.4 }, { label: 'Purchases', data: [], borderColor: '#4361ee', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const catCtx = document.getElementById('categoryChart')?.getContext('2d');
    if (catCtx) {
        categoryChart = new Chart(catCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Sales', data: [], backgroundColor: ['#4361ee', '#7209b7', '#4cc9f0', '#f72585', '#f8961e', '#38b000'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
};

window.loadDashboardData = function() {
    google.script.run.withSuccessHandler(res => {
        if (!res.success) return;
        const d = res.data;
        const f = n => '৳ ' + formatBD(Math.abs(Math.floor(n || 0)));

        document.getElementById('todaySales').textContent = f(d.today?.sales);
        document.getElementById('todayPurchases').textContent = f(d.today?.purchases);
        document.getElementById('todayProfit').textContent = f(d.today?.profit);
        document.getElementById('todayTransactions').textContent = d.today?.transactions || 0;
        document.getElementById('monthSales').textContent = f(d.month?.sales);
        document.getElementById('monthPurchases').textContent = f(d.month?.purchases);
        document.getElementById('monthProfit').textContent = f(d.month?.profit);
        document.getElementById('monthTransactions').textContent = d.month?.transactions || 0;
        document.getElementById('totalDues').textContent = f(d.customer?.totalDues);
        document.getElementById('creditedCount').textContent = d.customer?.creditedCount || 0;

        const lBox = document.getElementById('lowStockListContainer');
        if (d.lowStock?.length) {
            lBox.innerHTML = d.lowStock.map(p => `
                <div class="alert-item-custom">
                    <div class="alert-item-custom-info">
                        <h4>${escapeHtml(p.Product_Name || p.product_name || '')}</h4>
                        <p>Qty: ${p.Stock !== undefined ? p.Stock : p.stock}</p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="switchAppView('purchases')">Order</button>
                </div>`).join('');
        } else {
            lBox.innerHTML = '<div class="alert-item-custom" style="grid-column: 1 / -1; background:#f0fdf4; border-left-color:#22c55e;"><div class="alert-item-custom-info"><h4 style="color:#166534;">✅ Healthy Inventory</h4><p style="color:#15803d; margin:2px 0 0;">All items are adequately stocked</p></div></div>';
        }

        loadChartsData();
        loadTopProducts();
    }).getDashboardData();
};

window.loadChartsData = function() {
    const days = document.getElementById('chartPeriod')?.value || 7;
    google.script.run.withSuccessHandler(r => {
        if (r.success && salesChart) {
            salesChart.data.labels = r.data.dates;
            salesChart.data.datasets[0].data = r.data.sales;
            salesChart.data.datasets[1].data = r.data.purchases;
            salesChart.update();
        }
    }).getSalesTrend(parseInt(days));

    google.script.run.withSuccessHandler(r => {
        if (r.success && categoryChart) {
            categoryChart.data.labels = r.data.map(i => i.category);
            categoryChart.data.datasets[0].data = r.data.map(i => i.total);
            categoryChart.update();
        }
    }).getCategoryWiseSales();
};

window.loadTopProducts = function() {
    google.script.run.withSuccessHandler(prods => {
        const box = document.getElementById('topProducts');
        if (!prods?.length) return box.innerHTML = '<p style="grid-column:span 2; text-align:center;">No sales recorded</p>';
        box.innerHTML = prods.map(p => `
            <div style="background:#f8fafc; padding:10px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
                <div style="font-weight:700; font-size:0.85rem;">${p.name}</div>
                <div style="color:var(--primary); font-size:1.2rem; font-weight:800;">${p.totalSold}</div>
                <div style="font-size:0.7rem; color:#64748b;">UNITS SOLD</div>
            </div>`).join('');
    }).getTopSellingProducts();
};

// PRODUCTS
window.loadProductsData = function() {
    const tbody = document.getElementById('productTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
    google.script.run.withSuccessHandler(prods => {
        const unique = [];
        const seen = new Set();
        (prods || []).slice().reverse().forEach(p => {
            const pid = String(p.Product_ID || p.product_id || '').trim();
            if (pid && !seen.has(pid)) {
                seen.add(pid);
                unique.push(p);
            } else if (!pid) {
                unique.push(p);
            }
        });
        allProducts = unique;
        populateProductFilterDropdowns();
        handleProductSearch();
    }).getData('Products');
};

function populateProductFilterDropdowns() {
    const catSel = document.getElementById('productFilterCategory');
    const brandSel = document.getElementById('productFilterBrand');

    if (catSel && catSel.children.length <= 1) {
        const uniqueCatIds = Array.from(new Set(allProducts.map(p => p.Category_ID || p.category_id).filter(Boolean)));
        catSel.innerHTML = '<option value="">All Categories</option>' + uniqueCatIds.map(cId => {
            const name = categoryMap[cId] || cId;
            return `<option value="${escapeHtml(cId)}">${escapeHtml(name)}</option>`;
        }).join('');
    }

    if (brandSel && brandSel.children.length <= 1) {
        const uniqueBrandIds = Array.from(new Set(allProducts.map(p => p.Brand_ID || p.brand_id).filter(Boolean)));
        brandSel.innerHTML = '<option value="">All Brands</option>' + uniqueBrandIds.map(bId => {
            const name = brandMap[bId] || bId;
            return `<option value="${escapeHtml(bId)}">${escapeHtml(name)}</option>`;
        }).join('');
    }
}

window.handleProductSearch = function() {
    const q = (document.getElementById('productSearchInput')?.value || '').toLowerCase().trim();
    const cat = (document.getElementById('productFilterCategory')?.value || '').trim();
    const brand = (document.getElementById('productFilterBrand')?.value || '').trim();

    filteredProducts = allProducts.filter(p => {
        const pName = (p.Product_Name || p.product_name || '').toLowerCase();
        const pId = (p.Product_ID || p.product_id || '').toLowerCase();
        const pCat = String(p.Category_ID || p.category_id || '').trim();
        const pCatName = (categoryMap[pCat] || pCat).toLowerCase();
        const pBrand = String(p.Brand_ID || p.brand_id || '').trim();
        const pBrandName = (brandMap[pBrand] || pBrand).toLowerCase();

        const matchesQ = !q || pName.includes(q) || pId.includes(q);
        const matchesCat = !cat || pCat === cat || pCatName === cat.toLowerCase();
        const matchesBrand = !brand || pBrand === brand || pBrandName === brand.toLowerCase();

        return matchesQ && matchesCat && matchesBrand;
    });

    prodPage = 1;
    renderProductTable();
};

window.resetProductFilters = function() {
    const inp = document.getElementById('productSearchInput');
    if (inp) inp.value = '';
    const cat = document.getElementById('productFilterCategory');
    if (cat) cat.value = '';
    const brand = document.getElementById('productFilterBrand');
    if (brand) brand.value = '';
    handleProductSearch();
};

window.renderProductTable = function() {
    const tbody = document.getElementById('productTableBody');
    if (!filteredProducts.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center" style="padding: 24px; color: #64748b;">No products found matching filters.</td></tr>';
        updateProdPagination(0);
        return;
    }
    const start = (prodPage - 1) * rowsPerPage;
    const items = filteredProducts.slice(start, start + rowsPerPage);
    tbody.innerHTML = items.map(p => {
        const pid = p.Product_ID || p.product_id || '';
        const pname = p.Product_Name || p.product_name || '';
        const catId = p.Category_ID || p.category_id || '';
        const brandId = p.Brand_ID || p.brand_id || '';
        const upc = p.UPC || p.upc || '1';
        const stock = parseFloat(p.Stock !== undefined ? p.Stock : p.stock) || 0;
        const uPrice = parseFloat(p.Unit_Price !== undefined ? p.Unit_Price : p.unit_price) || 0;
        const sPrice = parseFloat(p.Sale_Price !== undefined ? p.Sale_Price : p.sale_price) || 0;
        const mPrice = parseFloat(p.MRP_Price !== undefined ? p.MRP_Price : p.mrp_price) || 0;
        const status = p.Status || p.status || 'Active';

        return `
        <tr>
            <td><strong>${escapeHtml(pid)}</strong></td>
            <td><strong>${escapeHtml(pname)}</strong></td>
            <td>${escapeHtml(categoryMap[catId] || catId || '-')}</td>
            <td>${escapeHtml(brandMap[brandId] || brandId || '-')}</td>
            <td>${escapeHtml(upc)}</td>
            <td style="font-weight:700; color:var(--primary);">${stock}</td>
            <td>৳${uPrice.toFixed(0)}</td>
            <td style="font-weight:700;">৳${sPrice.toFixed(0)}</td>
            <td>৳${mPrice.toFixed(0)}</td>
            <td><span class="badge ${stock <= 10 ? 'badge-low' : 'badge-ok'}">${stock <= 10 ? 'Low Stock' : status}</span></td>
            <td>
                ${CURRENT_USER.Role === 'Admin' ? `
                    <div style="display:inline-flex; gap:6px;">
                        <button type="button" class="btn-icon btn-edit" onclick="editProduct('${escapeHtml(pid)}')" title="Edit Product"><i class="fas fa-edit"></i></button>
                    </div>
                ` : ''}
            </td>
        </tr>`;
    }).join('');
    updateProdPagination(filteredProducts.length);
};

window.updateProdPagination = function(total) {
    const start = total === 0 ? 0 : (prodPage - 1) * rowsPerPage + 1;
    const end = Math.min(prodPage * rowsPerPage, total);
    document.getElementById('prodStartRange').textContent = start;
    document.getElementById('prodEndRange').textContent = end;
    document.getElementById('prodTotalItems').textContent = total;
    document.getElementById('prodPrevBtn').disabled = prodPage === 1;
    document.getElementById('prodNextBtn').disabled = end >= total;
};

window.changeProdPage = function(dir) { prodPage += dir; renderProductTable(); };

window.toggleAuthPassword = function() {
    const inp = document.getElementById('authPassword');
    const icon = document.getElementById('toggleAuthEyeIcon');
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        inp.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

window.openProductModal = function() {
    const form = document.getElementById('productForm');
    if (form) form.reset();
    const editIdEl = document.getElementById('edit_product_id');
    if (editIdEl) editIdEl.value = '';

    // Auto-generate next suggested Product Code
    const pIdEl = document.getElementById('p_id');
    if (pIdEl) {
        pIdEl.disabled = false;
        const existingNums = (allProducts || [])
            .map(p => {
                const id = String(p.Product_ID || p.product_id || '');
                const m = id.match(/P(\d+)/i);
                return m ? parseInt(m[1], 10) : 0;
            })
            .filter(n => !isNaN(n));
        const maxNum = existingNums.length ? Math.max(...existingNums) : 0;
        const nextId = `P${String(Math.max(maxNum + 1, (allProducts || []).length + 1)).padStart(4, '0')}`;
        pIdEl.value = nextId;
    }

    const pStockEl = document.getElementById('p_stock');
    if (pStockEl) {
        pStockEl.disabled = false;
        pStockEl.value = '0';
    }

    const pUpcEl = document.getElementById('p_upc');
    if (pUpcEl) pUpcEl.value = '1';
    const pUnitEl = document.getElementById('p_unit_price');
    if (pUnitEl) pUnitEl.value = '0';
    const pSaleEl = document.getElementById('p_sale_price');
    if (pSaleEl) pSaleEl.value = '0';
    const pMrpEl = document.getElementById('p_mrp_price');
    if (pMrpEl) pMrpEl.value = '0';
    const pExpEl = document.getElementById('p_expiry');
    if (pExpEl) pExpEl.value = '';

    // Ensure category dropdown is populated
    const pCat = document.getElementById('p_category');
    if (pCat && pCat.options.length <= 1 && Object.keys(categoryMap).length > 0) {
        pCat.innerHTML = '<option value="">Select Category</option>' + 
            Object.entries(categoryMap).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
    }

    // Ensure brand dropdown is populated
    const pBrand = document.getElementById('p_brand');
    if (pBrand && pBrand.options.length <= 1 && Object.keys(brandMap).length > 0) {
        pBrand.innerHTML = '<option value="">Select Brand</option>' + 
            Object.entries(brandMap).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
    }

    // Ensure warehouse dropdown is populated
    const pWh = document.getElementById('p_warehouse');
    if (pWh && pWh.options.length === 0 && warehouseList && warehouseList.length > 0) {
        pWh.innerHTML = warehouseList.map(w => `<option value="${w.Warehouse_ID || w.warehouse_id}">${w.Warehouse_Name || w.warehouse_name}</option>`).join('');
    }

    const btnSave = document.getElementById('btnProductSubmit');
    if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Save Product';
    }

    const titleEl = document.getElementById('productModalTitle');
    if (titleEl) titleEl.textContent = 'Add New Product';
    const modalEl = document.getElementById('productModal');
    if (modalEl) modalEl.style.display = 'flex';
};

window.editProduct = function(id) {
    const p = allProducts.find(x => (x.Product_ID || x.product_id) === id);
    if (!p) return;
    const setVal = (fieldId, val) => {
        const el = document.getElementById(fieldId);
        if (el) el.value = (val !== null && val !== undefined) ? val : '';
    };
    const prodId = p.Product_ID || p.product_id;
    setVal('edit_product_id', prodId);
    setVal('p_id', prodId);
    const pIdEl = document.getElementById('p_id');
    if (pIdEl) pIdEl.disabled = true;
    setVal('p_name', p.Product_Name || p.product_name || '');
    setVal('p_category', p.Category_ID || p.category_id || '');
    setVal('p_brand', p.Brand_ID || p.brand_id || '');
    setVal('p_upc', p.UPC || p.upc || '1');
    setVal('p_stock', p.Stock !== undefined ? p.Stock : p.stock || 0);
    const pStockEl = document.getElementById('p_stock');
    if (pStockEl) pStockEl.disabled = true;
    setVal('p_unit_price', p.Unit_Price !== undefined ? p.Unit_Price : p.unit_price || 0);
    setVal('p_sale_price', p.Sale_Price !== undefined ? p.Sale_Price : p.sale_price || 0);
    setVal('p_mrp_price', p.MRP_Price !== undefined ? p.MRP_Price : p.mrp_price || 0);
    setVal('p_expiry', p.Expiry_Date || p.expiry_date || '');

    const btnSave = document.getElementById('btnProductSubmit');
    if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Update Product';
    }

    const titleEl = document.getElementById('productModalTitle');
    if (titleEl) titleEl.textContent = 'Edit Product';
    const modalEl = document.getElementById('productModal');
    if (modalEl) modalEl.style.display = 'flex';
};

window.deleteProduct = function(id) {
    const p = allProducts.find(x => (x.Product_ID || x.product_id) === id);
    const pName = p ? (p.Product_Name || p.product_name) : id;
    if (!confirm(`Are you sure you want to delete product "${pName}" (${id})?`)) return;

    google.script.run.withSuccessHandler(res => {
        if (res && res.success === false) {
            return showAlertModal("Error", res.error || "Could not delete product.");
        }
        loadProductsData();
        showAlertModal("Success", `Product "${pName}" deleted successfully.`);
    }).withFailureHandler(err => {
        showAlertModal("Error", "Failed to delete: " + (err.message || err));
    }).deleteProduct(id);
};

window.handleProductSubmit = function() {
    const editId = document.getElementById('edit_product_id')?.value?.trim() || '';
    let code = document.getElementById('p_id')?.value?.trim() || '';
    const name = document.getElementById('p_name')?.value?.trim() || '';
    
    if (!name) {
        return showAlertModal("Validation", "Product Name is required.");
    }

    if (!code && !editId) {
        const existingNums = (allProducts || [])
            .map(p => {
                const id = String(p.Product_ID || p.product_id || '');
                const m = id.match(/P(\d+)/i);
                return m ? parseInt(m[1], 10) : 0;
            })
            .filter(n => !isNaN(n));
        const maxNum = existingNums.length ? Math.max(...existingNums) : 0;
        code = `P${String(Math.max(maxNum + 1, (allProducts || []).length + 1)).padStart(4, '0')}`;
    }

    const catVal = document.getElementById('p_category')?.value?.trim() || null;
    const brandVal = document.getElementById('p_brand')?.value?.trim() || null;
    const whVal = document.getElementById('p_warehouse')?.value?.trim() || '';
    const expiryVal = document.getElementById('p_expiry')?.value?.trim() || null;
    const stockVal = parseFloat(document.getElementById('p_stock')?.value) || 0;
    const upcVal = document.getElementById('p_upc')?.value?.trim() || '1';
    const unitPrice = parseFloat(document.getElementById('p_unit_price')?.value) || 0;
    const salePrice = parseFloat(document.getElementById('p_sale_price')?.value) || 0;
    const mrpPrice = parseFloat(document.getElementById('p_mrp_price')?.value) || 0;

    const data = {
        Product_ID: editId || code,
        Product_Name: name,
        Category_ID: catVal ? catVal : null,
        Brand_ID: brandVal ? brandVal : null,
        UPC: upcVal,
        Stock: stockVal,
        Warehouse_ID: whVal,
        Unit_Price: unitPrice,
        Sale_Price: salePrice,
        MRP_Price: mrpPrice,
        Expiry_Date: expiryVal ? expiryVal : null,
        Status: 'Active'
    };

    const btnSave = document.getElementById('btnProductSubmit');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    google.script.run
        .withSuccessHandler(res => {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = editId ? '<i class="fas fa-save"></i> Update Product' : '<i class="fas fa-save"></i> Save Product';
            }
            if (res && res.success === false) {
                return showAlertModal("Error", res.error || "Could not save product.");
            }
            closeModal('productModal');
            loadProductsData();
            showAlertModal("Success", editId ? "Product updated successfully!" : "Product created successfully!");
        })
        .withFailureHandler(err => {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = editId ? '<i class="fas fa-save"></i> Update Product' : '<i class="fas fa-save"></i> Save Product';
            }
            showAlertModal("Error", "Failed to save product: " + (err.message || err));
        })
        .saveProduct(data);
};

// Helper to escape HTML strings safely
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let posActiveDdIndex = -1;
let posSelectedCategory = 'ALL';

// POS VIEW - CLEAN DYNAMIC INITIALIZATION
window.initPosView = function() {
    const memoInput = document.getElementById('posMemoNo');
    if (memoInput) {
        memoInput.value = '';
    }
    const dateInput = document.getElementById('posSaleDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    const custInput = document.getElementById('posCustomerInput');
    if (custInput) {
        custInput.value = 'WALK-IN';
    }
    const discInput = document.getElementById('posInpDisc');
    if (discInput) {
        discInput.value = '0';
    }
    const discType = document.getElementById('posTypDisc');
    if (discType) {
        discType.value = 'val';
    }
    const payMode = document.getElementById('posPayMode');
    if (payMode) {
        payMode.value = 'Credit (Due)';
    }
    const searchInput = document.getElementById('posProductSearch');
    if (searchInput) {
        searchInput.value = '';
    }

    // Always start with a fresh empty cart on entering the Sales page
    posCart = [];

    renderPosCart();
    loadPosBatches();
    loadCustomersList();
    loadPosRecentSales();
};

window.loadPosBatches = function(whId) {
    google.script.run.withSuccessHandler(batches => {
        posAvailableBatches = batches || [];
        
        // If dropdown is open, re-render it
        const dd = document.getElementById('posProductDropdown');
        if (dd && dd.style.display === 'block') {
            const val = document.getElementById('posProductSearch')?.value || '';
            filterPosProductDropdown(val);
        }
    }).getBatchesForSale(null);
};

window.openPosProductDropdown = function() {
    const dd = document.getElementById('posProductDropdown');
    if (!dd) return;
    const val = document.getElementById('posProductSearch')?.value || '';
    filterPosProductDropdown(val);
    dd.style.display = 'block';
};

window.closePosProductDropdown = function() {
    const dd = document.getElementById('posProductDropdown');
    if (dd) dd.style.display = 'none';
    posActiveDdIndex = -1;
};

window.togglePosProductDropdown = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const dd = document.getElementById('posProductDropdown');
    if (!dd) return;
    if (dd.style.display === 'block') {
        closePosProductDropdown();
    } else {
        openPosProductDropdown();
        document.getElementById('posProductSearch')?.focus();
    }
};

// Dark floating product dropdown matching Image 1
window.filterPosProductDropdown = function(val) {
    const dd = document.getElementById('posProductDropdown');
    if (!dd) return;
    const q = (val || '').toLowerCase().trim();
    
    let matches = posAvailableBatches || [];
    if (q) {
        matches = matches.filter(b => {
            const name = (b.name || '').toLowerCase();
            const id = (b.id || '').toLowerCase();
            const batch = (b.batch || '').toLowerCase();
            const cat = (b.category || '').toLowerCase();
            const brand = (b.brand || '').toLowerCase();
            const barcode = String(b.barcode || '').toLowerCase();
            const wh = (b.warehouseName || b.warehouseId || '').toLowerCase();
            return name.includes(q) || id.includes(q) || batch.includes(q) || 
                   cat.includes(q) || brand.includes(q) || barcode.includes(q) || wh.includes(q);
        });
    }

    if (!matches.length) {
        dd.innerHTML = `
            <div style="padding: 18px 14px; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                No matching products found
            </div>`;
        dd.style.display = 'block';
        return;
    }

    posActiveDdIndex = -1;
    dd.innerHTML = matches.map((b, idx) => {
        const safeBatchKey = `${b.id}|${b.batch}|${b.warehouseId}`;
        const whName = b.warehouseName || b.warehouseId || 'MouloviBazar';
        const roundedPrice = Math.round(b.price || 0);
        return `
        <div class="pos-dark-item" data-index="${idx}" onclick="selectPosProductByKey('${safeBatchKey}')">
            <div class="pos-dark-title">${escapeHtml(b.name)} [${escapeHtml(whName)}] - ৳${roundedPrice}</div>
            <div class="pos-dark-sub">${escapeHtml(b.batch)} | ${escapeHtml(whName)} | Stock: ${b.stock}</div>
        </div>`;
    }).join('');
    dd.style.display = 'block';
};

window.selectPosProductByKey = function(key) {
    const match = (posAvailableBatches || []).find(b => `${b.id}|${b.batch}|${b.warehouseId}` === key);
    if (match) addBatchToPosCart(match);
};

window.handlePosProductKeydown = function(e) {
    const dd = document.getElementById('posProductDropdown');
    const items = dd ? dd.querySelectorAll('.pos-dark-item') : [];
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!dd || dd.style.display !== 'block') {
            openPosProductDropdown();
            return;
        }
        if (items.length > 0) {
            posActiveDdIndex = (posActiveDdIndex + 1) % items.length;
            items.forEach((it, i) => it.classList.toggle('active', i === posActiveDdIndex));
            items[posActiveDdIndex]?.scrollIntoView({ block: 'nearest' });
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
            posActiveDdIndex = (posActiveDdIndex - 1 + items.length) % items.length;
            items.forEach((it, i) => it.classList.toggle('active', i === posActiveDdIndex));
            items[posActiveDdIndex]?.scrollIntoView({ block: 'nearest' });
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (posActiveDdIndex >= 0 && items[posActiveDdIndex]) {
            items[posActiveDdIndex].click();
        } else {
            const val = e.target.value?.trim().toLowerCase();
            if (val) {
                const exact = posAvailableBatches.find(b => 
                    (b.barcode && String(b.barcode).toLowerCase() === val) ||
                    (b.id && b.id.toLowerCase() === val) ||
                    (b.name && b.name.toLowerCase() === val)
                ) || posAvailableBatches.find(b => (b.name || '').toLowerCase().includes(val));
                if (exact) {
                    addBatchToPosCart(exact);
                } else if (items.length > 0) {
                    items[0].click();
                }
            }
        }
    } else if (e.key === 'Escape') {
        closePosProductDropdown();
    }
};

// Global click-away listener for POS product dropdown
document.addEventListener('click', function(e) {
    const searchWrapper = document.querySelector('.pos-search-wrap');
    if (searchWrapper && !searchWrapper.contains(e.target)) {
        closePosProductDropdown();
    }
});

window.loadCustomersList = function() {
    google.script.run.withSuccessHandler(custs => {
        allCustomers = custs || [];
        const dl = document.getElementById('customerListOptions');
        if (dl) {
            dl.innerHTML = custs.map(c => `<option value="${c.Customer_Name}">Due: ৳${parseFloat(c.Current_Due || 0).toFixed(0)}</option>`).join('') + '<option value="WALK-IN">Walk-in Customer</option>';
        }
    }).getData('Customers');
};

window.addBatchToPosCart = function(match) {
    if (!match) return;
    const targetWh = match.warehouseId || 'W001';
    const ex = posCart.find(i => i.id === match.id && i.batchNo === match.batch && i.warehouseId === targetWh);
    if (ex) {
        ex.ctnQty = (ex.ctnQty || 0) + 1;
    } else {
        posCart.push({
            id: match.id,
            name: match.name,
            batchNo: match.batch,
            warehouseId: targetWh,
            warehouseName: match.warehouseName || targetWh,
            price: parseFloat(match.price) || 0,
            stock: parseFloat(match.stock) || 0,
            upc: parseInt(match.upc) || 1,
            ctnQty: 1,
            pcsQty: 0,
            freeQty: 0
        });
    }
    const searchInp = document.getElementById('posProductSearch');
    if (searchInp) searchInp.value = '';
    closePosProductDropdown();
    renderPosCart();
};

function refreshPosItemRow(idx) {
    const item = posCart[idx];
    if (!item) return;
    const upc = Math.max(1, parseInt(item.upc) || 1);
    const ctnQty = parseInt(item.ctnQty) || 0;
    const pcsQty = parseInt(item.pcsQty) || 0;
    const freeQty = parseInt(item.freeQty) || 0;
    const paidPcs = (ctnQty * upc) + pcsQty;
    const totalDeductPcs = paidPcs + freeQty;
    const deductCtn = Math.floor(totalDeductPcs / upc);
    const deductPcs = totalDeductPcs % upc;
    const price = parseFloat(item.price) || 0;
    const rowTotal = Math.round(paidPcs * price);

    const deductEl = document.getElementById(`posItemDeduct_${idx}`);
    if (deductEl) {
        deductEl.textContent = `Deducts: ${deductCtn} CTN + ${deductPcs} pcs (${totalDeductPcs})`;
    }
    const badgeEl = document.getElementById(`posItemPaidBadge_${idx}`);
    if (badgeEl) {
        badgeEl.textContent = `CTN = ${paidPcs} pcs`;
    }
    const totalEl = document.getElementById(`posItemTotal_${idx}`);
    if (totalEl) {
        totalEl.textContent = `৳${rowTotal}`;
    }
    recalculatePos();
}

window.stepCtn = function(idx, delta) {
    if (!posCart[idx]) return;
    const cur = parseInt(posCart[idx].ctnQty) || 0;
    posCart[idx].ctnQty = Math.max(0, cur + delta);
    renderPosCart();
};

window.updateCtnQty = function(idx, val, isTyping = false) {
    if (!posCart[idx]) return;
    posCart[idx].ctnQty = Math.max(0, parseInt(val) || 0);
    if (isTyping) {
        refreshPosItemRow(idx);
    } else {
        renderPosCart();
    }
};

window.stepPcs = function(idx, delta) {
    if (!posCart[idx]) return;
    const cur = parseInt(posCart[idx].pcsQty) || 0;
    posCart[idx].pcsQty = Math.max(0, cur + delta);
    renderPosCart();
};

window.updatePcsQty = function(idx, val, isTyping = false) {
    if (!posCart[idx]) return;
    posCart[idx].pcsQty = Math.max(0, parseInt(val) || 0);
    if (isTyping) {
        refreshPosItemRow(idx);
    } else {
        renderPosCart();
    }
};

window.stepFree = function(idx, delta) {
    if (!posCart[idx]) return;
    const cur = parseInt(posCart[idx].freeQty) || 0;
    posCart[idx].freeQty = Math.max(0, cur + delta);
    renderPosCart();
};

window.updateFreeQty = function(idx, val, isTyping = false) {
    if (!posCart[idx]) return;
    posCart[idx].freeQty = Math.max(0, parseInt(val) || 0);
    if (isTyping) {
        refreshPosItemRow(idx);
    } else {
        renderPosCart();
    }
};

window.changeCartItemWarehouse = function(idx, newWhId) {
    if (!posCart[idx]) return;
    posCart[idx].warehouseId = newWhId;
    const whObj = (warehouseList || []).find(w => w.Warehouse_ID === newWhId);
    if (whObj) posCart[idx].warehouseName = whObj.Warehouse_Name;
    renderPosCart();
};

// Render cart table matching Image 2
window.renderPosCart = function() {
    const tbody = document.getElementById('posCartTableBody');
    if (!tbody) return;
    if (!posCart || !posCart.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px 20px; color: #94a3b8;">
            <i class="fas fa-shopping-cart fa-2x" style="opacity: 0.3; margin-bottom: 8px; display: block;"></i>
            <div style="font-weight: 700; color: #475569;">Cart is Empty</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">Click the product search box above to add items.</div>
        </td></tr>`;
        recalculatePos();
        return;
    }

    const whOptions = (warehouseList && warehouseList.length ? warehouseList : [
        { Warehouse_ID: 'W001', Warehouse_Name: 'MouloviBazar' },
        { Warehouse_ID: 'W002', Warehouse_Name: 'Begumganj 2' },
        { Warehouse_ID: 'W003', Warehouse_Name: 'Begumganj 3' },
        { Warehouse_ID: 'W004', Warehouse_Name: 'Armanitola' }
    ]);

    tbody.innerHTML = posCart.map((item, idx) => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const ctnQty = parseInt(item.ctnQty) || 0;
        const pcsQty = parseInt(item.pcsQty) || 0;
        const freeQty = parseInt(item.freeQty) || 0;
        const paidPcs = (ctnQty * upc) + pcsQty;
        const totalDeductPcs = paidPcs + freeQty;
        const deductCtn = Math.floor(totalDeductPcs / upc);
        const deductPcs = totalDeductPcs % upc;
        const stkCtn = Math.floor((item.stock || 0) / upc);
        const price = parseFloat(item.price) || 0;
        const ctnPrice = Math.round(price * upc);
        const rowTotal = Math.round(paidPcs * price);

        const whSelectHtml = `
            <select class="pos-item-wh-select" onchange="changeCartItemWarehouse(${idx}, this.value)">
                ${whOptions.map(w => `<option value="${w.Warehouse_ID}" ${w.Warehouse_ID === item.warehouseId ? 'selected' : ''}>${escapeHtml(w.Warehouse_Name)}</option>`).join('')}
            </select>`;

        return `
        <tr>
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    ${whSelectHtml}
                    <div>
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem; line-height: 1.25;">${escapeHtml(item.name)}</div>
                        <div style="color: #2563eb; font-weight: 600; font-size: 0.78rem; margin-top: 2px;">${escapeHtml(item.batchNo)} (1 CTN = ${upc} pcs)</div>
                        <div id="posItemDeduct_${idx}" style="color: #15803d; font-weight: 600; font-size: 0.78rem; margin-top: 1px;">Deducts: ${deductCtn} CTN + ${deductPcs} pcs (${totalDeductPcs})</div>
                    </div>
                </div>
            </td>
            <td style="font-weight: 600; color: #334155; font-size: 0.85rem;">
                ${stkCtn} CTN (${item.stock} pcs)
            </td>
            <td>
                <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">৳${price.toFixed(2)}</div>
                <div style="color: #64748b; font-size: 0.72rem;">(৳${ctnPrice}/CTN)</div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
                    <span id="posItemPaidBadge_${idx}" class="pos-ctn-badge">CTN = ${paidPcs} pcs</span>
                    <div class="stepper-wrap">
                        <button type="button" class="stepper-btn stepper-btn-minus" onclick="stepCtn(${idx}, -1)">-</button>
                        <input type="number" class="stepper-num" value="${ctnQty}" min="0" onchange="updateCtnQty(${idx}, this.value)" oninput="updateCtnQty(${idx}, this.value, true)">
                        <button type="button" class="stepper-btn stepper-btn-plus" onclick="stepCtn(${idx}, 1)">+</button>
                    </div>
                    <div class="stepper-wrap">
                        <button type="button" class="stepper-btn stepper-btn-minus" onclick="stepPcs(${idx}, -1)">-</button>
                        <input type="number" class="stepper-num" value="${pcsQty}" min="0" onchange="updatePcsQty(${idx}, this.value)" oninput="updatePcsQty(${idx}, this.value, true)">
                        <button type="button" class="stepper-btn stepper-btn-plus" onclick="stepPcs(${idx}, 1)">+</button>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">PCS</span>
                </div>
            </td>
            <td style="text-align: center;">
                <div class="stepper-wrap stepper-green">
                    <button type="button" class="stepper-btn stepper-btn-minus" onclick="stepFree(${idx}, -1)">-</button>
                    <input type="number" class="stepper-num" value="${item.freeQty || 0}" min="0" onchange="updateFreeQty(${idx}, this.value)" oninput="updateFreeQty(${idx}, this.value, true)">
                    <button type="button" class="stepper-btn stepper-btn-plus" onclick="stepFree(${idx}, 1)">+</button>
                </div>
            </td>
            <td style="text-align: right;">
                <strong id="posItemTotal_${idx}" style="font-size: 0.95rem; color: #0f172a;">৳${rowTotal}</strong>
            </td>
            <td style="text-align: center;">
                <span style="color: #ef4444; font-size: 1.15rem; cursor: pointer; padding: 2px 6px; display: inline-block; font-weight: 700;" onclick="posCart.splice(${idx}, 1); renderPosCart();" title="Remove Item">&times;</span>
            </td>
        </tr>`;
    }).join('');

    recalculatePos();
};

window.recalculatePos = function() {
    let sub = 0;
    posCart.forEach(item => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const totalPcs = ((parseInt(item.ctnQty) || 0) * upc) + (parseInt(item.pcsQty) || 0);
        sub += Math.round(totalPcs * (parseFloat(item.price) || 0));
    });

    const dVal = parseFloat(document.getElementById('posInpDisc')?.value) || 0;
    const dType = document.getElementById('posTypDisc')?.value || 'val';
    const discAmount = dType === 'per' ? (sub * dVal / 100) : dVal;
    const grand = Math.max(0, sub - discAmount);

    const subEl = document.getElementById('posTxtSubtotal');
    if (subEl) subEl.textContent = '৳ ' + formatBD(sub);
    const grandEl = document.getElementById('posTxtGrandTotal');
    if (grandEl) grandEl.textContent = formatBD(grand);
};

let isPosSaleProcessing = false;

window.submitPosSale = function() {
    if (isPosSaleProcessing) {
        console.warn("Sale is currently being processed. Ignoring multiple clicks.");
        return;
    }

    if (!posCart.length) return showAlertModal("Empty Cart", "Add products to sale cart.");
    const custName = document.getElementById('posCustomerInput')?.value.trim() || 'WALK-IN';
    const foundCust = (allCustomers || []).find(c => c.Customer_Name === custName);
    const custId = foundCust ? foundCust.Customer_ID : 'WALK-IN';
    const mode = document.getElementById('posPayMode')?.value || 'Credit (Due)';

    const payBtn = document.getElementById('posBtnPay');
    const origBtnHtml = payBtn ? payBtn.innerHTML : '';

    const unlockPayBtn = () => {
        isPosSaleProcessing = false;
        if (payBtn) {
            payBtn.disabled = false;
            payBtn.style.pointerEvents = 'auto';
            payBtn.style.opacity = '1';
            payBtn.style.cursor = 'pointer';
            payBtn.innerHTML = origBtnHtml || '<i class="fas fa-check-circle"></i> <span>Complete Sale</span>';
        }
    };

    // Lock button immediately to block multiple clicks
    isPosSaleProcessing = true;
    if (payBtn) {
        payBtn.disabled = true;
        payBtn.style.pointerEvents = 'none';
        payBtn.style.opacity = '0.65';
        payBtn.style.cursor = 'not-allowed';
        payBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing Sale...</span>';
    }

    let sub = 0;
    const itemsPayload = posCart.map(item => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const ctnQty = parseInt(item.ctnQty) || 0;
        const pcsQty = parseInt(item.pcsQty) || 0;
        const freeQty = parseInt(item.freeQty) || 0;
        const paidPcs = (ctnQty * upc) + pcsQty;
        const totalDeductPcs = paidPcs + freeQty;
        const itemTotal = Math.round(paidPcs * (parseFloat(item.price) || 0));
        sub += itemTotal;
        return {
            id: item.id,
            name: item.name,
            batchNo: item.batchNo,
            warehouseId: item.warehouseId,
            price: item.price,
            qty: paidPcs,
            freeQty: freeQty,
            deductQty: totalDeductPcs
        };
    });

    const dVal = parseFloat(document.getElementById('posInpDisc')?.value) || 0;
    const dType = document.getElementById('posTypDisc')?.value || 'val';
    const discAmount = dType === 'per' ? (sub * dVal / 100) : dVal;
    const grand = Math.max(0, sub - discAmount);
    const memoNo = document.getElementById('posMemoNo')?.value.trim() || '';

    const payload = {
        memoNo,
        customerId: custId,
        date: document.getElementById('posSaleDate')?.value || new Date().toISOString().split('T')[0],
        items: itemsPayload,
        subtotal: sub,
        grandTotal: grand,
        discount: discAmount,
        paymentMode: mode,
        paidAmount: mode.includes('Credit') ? 0 : grand,
        dueAmount: mode.includes('Credit') ? grand : 0,
        clientToken: `POS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };

    google.script.run
        .withSuccessHandler(res => {
            unlockPayBtn();
            if (res && res.success) {
                showAlertModal("Sale Complete", `Invoice ${res.invoiceNo || 'INV-SUCCESS'} created successfully.`);
                posCart = [];

                // Reset discount section to 0 on completion
                const discInp = document.getElementById('posInpDisc');
                if (discInp) discInp.value = '0';
                const discTyp = document.getElementById('posTypDisc');
                if (discTyp) discTyp.value = 'val';
                const memoInp = document.getElementById('posMemoNo');
                if (memoInp) memoInp.value = '';

                renderPosCart();
                loadPosRecentSales();
                loadPosBatches();
                if (window.loadDashboardData) loadDashboardData();
            } else {
                showAlertModal("Sale Error", (res && res.error) || "Could not complete sale.");
            }
        })
        .withFailureHandler(err => {
            unlockPayBtn();
            showAlertModal("Connection Error", (err && err.message) ? err.message : "Failed to process sale. Please try again.");
        })
        .createBulkSale(payload);
};

window.loadPosRecentSales = function() {
    google.script.run
        .withSuccessHandler(sales => {
            recentSalesData = sales || [];
            const tbody = document.getElementById('posRecentSalesBody');
            if (!tbody) return;
            if (!recentSalesData.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 24px; color: #94a3b8;">No sales recorded yet.</td></tr>';
                return;
            }
            tbody.innerHTML = recentSalesData.map(s => {
                const dateStr = s.Date ? (() => {
                    const d = new Date(s.Date);
                    return isNaN(d.getTime()) ? String(s.Date).split('T')[0] : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                })() : '9/21/2026';
                const memoText = s.Memo_No ? `<div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">Memo: ${escapeHtml(s.Memo_No)}</div>` : '';
                const custName = customerMap[s.Customer_ID] || s.Customer_Name || s.Customer_ID || 'WALK-IN';
                const returnAmt = parseFloat(s.Return_Amt || 0);
                const returnDisplay = returnAmt > 0 
                    ? `<span style="color: #ef4444; font-weight: 700;">৳ ${formatBD(returnAmt)}</span>` 
                    : `<span style="color: #94a3b8;">৳ 0</span>`;
                return `
                    <tr>
                        <td>
                            <strong style="color: #0f172a;">${escapeHtml(s.Invoice_No)}</strong>
                            ${memoText}
                        </td>
                        <td>${dateStr}</td>
                        <td>${escapeHtml(custName)}</td>
                        <td>${returnDisplay}</td>
                        <td style="font-weight: 700; color: #0f172a;">৳ ${formatBD(s.Net_Total || 0)}</td>
                        <td><span class="badge-credit-pill">${escapeHtml(s.Payment_Type || 'Credit')}</span></td>
                        <td style="text-align: center;">
                            <button type="button" class="btn-print-pill" onclick="printPosInvoice('${s.Invoice_No}')">
                                <i class="fas fa-print"></i> Print
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        })
        .withFailureHandler(err => {
            console.error("Error loading recent sales:", err);
        })
        .getPosRecentSales();
};

window.printPosInvoice = function(invNo) {
    const existingModal = document.getElementById('invoicePrintModal');
    if (existingModal) existingModal.remove();

    const saleFallback = (recentSalesData || []).find(s => s.Invoice_No === invNo);
    const modal = document.createElement('div');
    modal.id = 'invoicePrintModal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 1000000; display: flex; align-items: center; justify-content: center; padding: 15px;';

    modal.innerHTML = `
        <div class="invoice-modal-card" style="background: white; border-radius: 12px; width: 680px; max-width: 96vw; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.35); overflow: hidden; font-family: system-ui, -apple-system, sans-serif;">
            <div class="invoice-modal-header no-print" style="background: #0f172a; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div style="font-weight: 700; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-invoice" style="color: #60a5fa;"></i> Invoice ${escapeHtml(invNo)}
                </div>
                <button type="button" onclick="document.getElementById('invoicePrintModal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.4rem; cursor: pointer; line-height: 1;">&times;</button>
            </div>

            <div id="invoiceModalScrollBody" style="padding: 22px 24px; overflow-y: auto; flex: 1;">
                <div id="invoiceLoadingSpinner" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-spinner fa-spin fa-2x" style="color: #4361ee; margin-bottom: 12px;"></i>
                    <div style="font-weight: 600; color: #64748b;">Loading invoice details...</div>
                </div>
                <div id="invoicePrintContent" class="invoice-printable-content" style="display: none;"></div>
            </div>

            <div class="invoice-modal-footer no-print" style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <span style="font-size: 0.8rem; color: #64748b;"><i class="fas fa-info-circle"></i> Complete itemized sales receipt</span>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('invoicePrintModal').remove()">Close</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.print()" style="display: flex; align-items: center; gap: 6px; font-weight: 600;">
                        <i class="fas fa-print"></i> Print Invoice
                    </button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    // Fetch complete invoice data from backend
    google.script.run
        .withSuccessHandler(inv => {
            if (inv && inv.success) {
                renderInvoiceDetailsView(inv);
            } else {
                renderInvoiceFallbackView(saleFallback, invNo);
            }
        })
        .withFailureHandler(err => {
            console.error("Error fetching full invoice:", err);
            renderInvoiceFallbackView(saleFallback, invNo);
        })
        .getFullInvoice(invNo);
};

function renderInvoiceDetailsView(inv) {
    const loadingEl = document.getElementById('invoiceLoadingSpinner');
    const contentEl = document.getElementById('invoicePrintContent');
    if (!contentEl) return;
    if (loadingEl) loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    const dateStr = inv.date ? (() => {
        const d = new Date(inv.date);
        return isNaN(d.getTime()) ? String(inv.date).split('T')[0] : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    })() : new Date().toLocaleDateString();

    const items = inv.items || [];
    const itemsHtml = items.map((item, idx) => {
        const freeBadge = item.freeQty > 0 
            ? `<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.72rem; padding: 1px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px;">+${item.freeQty} Free</span>`
            : '';
        const packInfo = item.ctnQty > 0 
            ? `<span style="font-size: 0.75rem; color: #64748b;">(${item.ctnQty} CTN${item.looseQty > 0 ? ` + ${item.looseQty} pcs` : ''})</span>`
            : '';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 0.85rem;">${idx + 1}</td>
                <td style="padding: 10px 8px;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 0.88rem; line-height: 1.3;">${escapeHtml(item.productName)}</div>
                    <div style="font-size: 0.76rem; color: #64748b; margin-top: 2px;">
                        <span>Batch: <strong>${escapeHtml(item.batchNo)}</strong></span>
                        ${freeBadge}
                    </div>
                </td>
                <td style="padding: 10px 8px; color: #475569; font-size: 0.82rem;">${escapeHtml(item.warehouseName)}</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 0.88rem;">
                    <strong>${item.quantity}</strong> <span style="font-size: 0.78rem; color: #64748b;">${escapeHtml(item.unit || 'pcs')}</span>
                    ${packInfo ? `<div style="margin-top: 1px;">${packInfo}</div>` : ''}
                </td>
                <td style="padding: 10px 8px; text-align: right; color: #334155; font-size: 0.88rem;">৳ ${formatBD(item.unitPrice, 2)}</td>
                <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: #0f172a; font-size: 0.9rem;">৳ ${formatBD(item.grossTotal, 2)}</td>
            </tr>`;
    }).join('');

    contentEl.innerHTML = `
        <!-- Receipt Top Header -->
        <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 14px; margin-bottom: 16px;">
            <h2 style="margin: 0; font-weight: 800; font-size: 1.45rem; color: #0f172a; letter-spacing: -0.5px;">${escapeHtml(inv.store?.name || 'shoPPilot Store')}</h2>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 3px;">${escapeHtml(inv.store?.address || 'Habiganj, Bangladesh')} • Tel: ${escapeHtml(inv.store?.phone || '+880 1700-000000')}</div>
            <div style="display: inline-block; background: #e0e7ff; color: #3730a3; font-size: 0.72rem; font-weight: 800; padding: 2px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 6px;">Official Sales Receipt & Invoice</div>
        </div>

        <!-- Metadata 2-Column Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border-radius: 8px; padding: 12px 16px; border: 1px solid #e2e8f0; margin-bottom: 18px; font-size: 0.83rem;">
            <div>
                <div style="display: flex; margin-bottom: 5px;">
                    <span style="color: #64748b; width: 85px;">Invoice No:</span>
                    <strong style="color: #0f172a;">${escapeHtml(inv.invoiceNo)}</strong>
                </div>
                ${inv.memoNo ? `
                <div style="display: flex; margin-bottom: 5px;">
                    <span style="color: #64748b; width: 85px;">Memo No:</span>
                    <strong style="color: #0f172a;">${escapeHtml(inv.memoNo)}</strong>
                </div>` : ''}
                <div style="display: flex; margin-bottom: 5px;">
                    <span style="color: #64748b; width: 85px;">Date:</span>
                    <span style="color: #334155;">${dateStr}</span>
                </div>
                <div style="display: flex;">
                    <span style="color: #64748b; width: 85px;">Billed By:</span>
                    <span style="color: #334155;">${escapeHtml(inv.createdBy || 'Staff')}</span>
                </div>
            </div>
            <div>
                <div style="display: flex; margin-bottom: 5px;">
                    <span style="color: #64748b; width: 85px;">Customer:</span>
                    <strong style="color: #0f172a;">${escapeHtml(inv.customer?.name || 'WALK-IN')}</strong>
                </div>
                ${inv.customer?.phone ? `
                <div style="display: flex; margin-bottom: 5px;">
                    <span style="color: #64748b; width: 85px;">Phone:</span>
                    <span style="color: #334155;">${escapeHtml(inv.customer.phone)}</span>
                </div>` : ''}
                ${inv.customer?.address ? `
                <div style="display: flex; margin-bottom: 5px;">
                    <span style="color: #64748b; width: 85px;">Address:</span>
                    <span style="color: #334155;">${escapeHtml(inv.customer.address)}</span>
                </div>` : ''}
                <div style="display: flex; align-items: center;">
                    <span style="color: #64748b; width: 85px;">Payment:</span>
                    <span class="badge-credit-pill">${escapeHtml(inv.paymentType)}</span>
                </div>
            </div>
        </div>

        <!-- Product Line Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
            <thead>
                <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;">
                    <th style="padding: 8px; text-align: center; width: 35px;">#</th>
                    <th style="padding: 8px; text-align: left;">Item & Details</th>
                    <th style="padding: 8px; text-align: left; width: 100px;">Warehouse</th>
                    <th style="padding: 8px; text-align: center; width: 90px;">Qty</th>
                    <th style="padding: 8px; text-align: right; width: 90px;">Rate</th>
                    <th style="padding: 8px; text-align: right; width: 100px;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">No items found</td></tr>'}
            </tbody>
        </table>

        <!-- Summary & Totals Breakdown -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 18px;">
            <div style="width: 280px; background: #f8fafc; border-radius: 8px; padding: 12px 16px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; color: #475569;">
                    <span>Gross Subtotal:</span>
                    <span>৳ ${formatBD(inv.summary?.totalGross || 0, 2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px; color: #10b981;">
                    <span>Discount:</span>
                    <span>- ৳ ${formatBD(inv.summary?.totalDiscount || 0, 2)}</span>
                </div>
                ${(inv.summary?.totalReturnAmt || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 8px; color: #ef4444; font-weight: 600;">
                    <span>Sales Return / Refund:</span>
                    <span>- ৳ ${formatBD(inv.summary.totalReturnAmt, 2)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; color: #0f172a; padding: 8px 0; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
                    <span>Net Total:</span>
                    <span style="color: #1d4ed8;">৳ ${formatBD(inv.summary?.netTotal || 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 8px; color: #475569;">
                    <span>Paid Amount:</span>
                    <span>৳ ${formatBD(inv.summary?.paidAmount || 0, 2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 700; margin-top: 6px; color: ${(inv.summary?.dueAmount || 0) > 0 ? '#ef4444' : '#10b981'};">
                    <span>Due Amount:</span>
                    <span>৳ ${formatBD(inv.summary?.dueAmount || 0)}</span>
                </div>
            </div>
        </div>

        <!-- Receipt Footer Note -->
        <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 0.78rem; color: #64748b;">
            Thank you for shopping with us! Please keep this receipt for warranty and returns.
        </div>`;
}

function renderInvoiceFallbackView(sale, invNo) {
    const loadingEl = document.getElementById('invoiceLoadingSpinner');
    const contentEl = document.getElementById('invoicePrintContent');
    if (!contentEl) return;
    if (loadingEl) loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    const memo = sale ? (sale.Memo_No || '') : '';
    const date = sale ? (() => {
        const d = new Date(sale.Date);
        return isNaN(d.getTime()) ? String(sale.Date).split('T')[0] : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    })() : new Date().toLocaleDateString();
    const cust = sale ? (customerMap[sale.Customer_ID] || sale.Customer_Name || sale.Customer_ID) : 'WALK-IN';
    const net = sale ? formatBD(sale.Net_Total || 0) : '0';
    const pay = sale ? (sale.Payment_Type || 'Credit') : 'Credit';

    contentEl.innerHTML = `
        <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 14px;">
            <h3 style="margin: 0; font-weight: 800; font-size: 1.25rem; color: #0f172a;">shoPPilot Store</h3>
            <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Official Sales Receipt</div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px;">
            <span style="color: #64748b;">Invoice No:</span>
            <strong style="color: #0f172a;">${escapeHtml(invNo)}</strong>
        </div>
        ${memo ? `<div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px;">
            <span style="color: #64748b;">Memo No:</span>
            <strong style="color: #0f172a;">${escapeHtml(memo)}</strong>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px;">
            <span style="color: #64748b;">Date:</span>
            <span>${date}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 14px;">
            <span style="color: #64748b;">Customer:</span>
            <strong style="color: #0f172a;">${escapeHtml(cust)}</strong>
        </div>
        <div style="background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
                <span>Payment Mode:</span>
                <span class="badge-credit-pill">${escapeHtml(pay)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; color: #0f172a; padding-top: 6px; border-top: 1px solid #cbd5e1;">
                <span>Net Total:</span>
                <span style="color: #1d4ed8;">৳ ${net}</span>
            </div>
        </div>`;
}

// QUICK SALE & PURCHASE MODALS (MOBILE APP INTERFACE)
window.openQuickSale = function() {
    const modal = document.getElementById('quickSaleModal');
    if (modal) modal.style.display = 'flex';
    const saleDate = document.getElementById('qs_sale_date');
    if (saleDate && !saleDate.value) {
        saleDate.value = new Date().toISOString().split('T')[0];
    }
    const memoInput = document.getElementById('qs_memo_no');
    if (memoInput) {
        memoInput.value = '';
    }

    // Populate customer dropdown if options are needed
    const custSelect = document.getElementById('qs_customer');
    if (custSelect && allCustomers && allCustomers.length) {
        const currentVal = custSelect.value || 'Nasim Store-HBL';
        custSelect.innerHTML = allCustomers.map(c => 
            `<option value="${escapeHtml(c.Customer_Name)}" ${c.Customer_Name === currentVal ? 'selected' : ''}>${escapeHtml(c.Customer_Name)}</option>`
        ).join('') + `<option value="WALK-IN" ${currentVal === 'WALK-IN' ? 'selected' : ''}>Walk-in Customer</option>`;
    }

    // Always start with empty quickCart
    quickCart = [];

    const wh = document.getElementById('qs_warehouse')?.value || 'W001';
    google.script.run.withSuccessHandler(data => { 
        quickProducts = data || []; 
    }).getBatchesForSale(wh);

    renderQuickCart();
};

window.onQuickSaleWarehouseChange = function(whId) {
    google.script.run.withSuccessHandler(data => { 
        quickProducts = data || []; 
    }).getBatchesForSale(whId);
};

window.filterQuickProducts = function(val) {
    const results = document.getElementById('qs_search_results');
    if (!results) return;
    if (!val || !val.trim()) { 
        // When focused with empty text, show top 6 products
        if (quickProducts && quickProducts.length) {
            results.innerHTML = quickProducts.slice(0, 8).map(p => `
                <div class="qs-dropdown-item" onclick="addQuickCartItem('${p.id}', '${escapeHtml(p.name)}', '${escapeHtml(p.batch || 'BT-20260830-001')}', ${p.price}, ${p.upc || 96}, ${p.stock})">
                    <div>
                        <strong style="color:#0f172a;">${escapeHtml(p.name)}</strong>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${escapeHtml(p.batch || '')} | 1 CTN = ${p.upc || 96} | Stk: ${p.stock}</div>
                    </div>
                    <strong style="color:#2563eb; font-size:0.9rem;">৳${formatBD(p.price)}</strong>
                </div>`).join('');
            results.style.display = 'block';
        } else {
            results.style.display = 'none';
        }
        return; 
    }
    const q = val.toLowerCase().trim();
    const matches = (quickProducts || []).filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.batch && p.batch.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
    if (matches.length) {
        results.innerHTML = matches.slice(0, 10).map(p => `
            <div class="qs-dropdown-item" onclick="addQuickCartItem('${p.id}', '${escapeHtml(p.name)}', '${escapeHtml(p.batch || 'BT-20260830-001')}', ${p.price}, ${p.upc || 96}, ${p.stock})">
                <div>
                    <strong style="color:#0f172a;">${escapeHtml(p.name)}</strong>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${escapeHtml(p.batch || '')} | 1 CTN = ${p.upc || 96} | Stk: ${p.stock}</div>
                </div>
                <strong style="color:#2563eb; font-size:0.9rem;">৳${formatBD(p.price)}</strong>
            </div>`).join('');
        results.style.display = 'block';
    } else {
        results.innerHTML = '<div style="padding:12px; color:#94a3b8; text-align:center; font-size:0.85rem;">No matching products found</div>';
        results.style.display = 'block';
    }
};

window.addQuickCartItem = function(id, name, batchNo, price, upc, stock) {
    const existing = quickCart.find(i => i.id === id && i.batchNo === batchNo);
    if (existing) {
        existing.ctnQty = (parseInt(existing.ctnQty) || 0) + 1;
    } else {
        quickCart.push({
            id,
            name,
            batchNo: batchNo || 'BT-20260830-001',
            price: parseFloat(price) || 0,
            upc: parseInt(upc) || 1,
            ctnQty: 1,
            pcsQty: 0,
            freeQty: 0,
            stock: stock || 100
        });
    }
    const results = document.getElementById('qs_search_results');
    if (results) results.style.display = 'none';
    const sInput = document.getElementById('qs_prod_search');
    if (sInput) sInput.value = '';
    renderQuickCart();
};

window.stepQsCtn = function(idx, delta) {
    if (!quickCart[idx]) return;
    const cur = parseInt(quickCart[idx].ctnQty) || 0;
    quickCart[idx].ctnQty = Math.max(0, cur + delta);
    renderQuickCart();
};

window.updateQsCtnQty = function(idx, val, isTyping = false) {
    if (!quickCart[idx]) return;
    quickCart[idx].ctnQty = Math.max(0, parseInt(val) || 0);
    if (isTyping) calculateQuickTotal();
    else renderQuickCart();
};

window.stepQsPcs = function(idx, delta) {
    if (!quickCart[idx]) return;
    const cur = parseInt(quickCart[idx].pcsQty) || 0;
    quickCart[idx].pcsQty = Math.max(0, cur + delta);
    renderQuickCart();
};

window.updateQsPcsQty = function(idx, val, isTyping = false) {
    if (!quickCart[idx]) return;
    quickCart[idx].pcsQty = Math.max(0, parseInt(val) || 0);
    if (isTyping) calculateQuickTotal();
    else renderQuickCart();
};

window.stepQsFree = function(idx, delta) {
    if (!quickCart[idx]) return;
    const cur = parseInt(quickCart[idx].freeQty) || 0;
    quickCart[idx].freeQty = Math.max(0, cur + delta);
    renderQuickCart();
};

window.updateQsFreeQty = function(idx, val, isTyping = false) {
    if (!quickCart[idx]) return;
    quickCart[idx].freeQty = Math.max(0, parseInt(val) || 0);
    if (isTyping) calculateQuickTotal();
    else renderQuickCart();
};

window.removeQuickCartItem = function(idx) {
    quickCart.splice(idx, 1);
    renderQuickCart();
};

window.renderQuickCart = function() {
    const container = document.getElementById('quickCartItems');
    if (!container) return;
    if (!quickCart.length) {
        container.innerHTML = `
            <div style="background:#ffffff; border:1px dashed #cbd5e1; border-radius:12px; padding:24px 16px; text-align:center; color:#94a3b8; margin-bottom:10px;">
                <i class="fas fa-shopping-basket fa-2x" style="opacity:0.35; margin-bottom:8px; display:block;"></i>
                <div style="font-weight:700; color:#475569;">Quick Cart is Empty</div>
                <div style="font-size:0.78rem; margin-top:2px;">Search and add products above.</div>
            </div>`;
        calculateQuickTotal();
        return;
    }

    container.innerHTML = quickCart.map((item, idx) => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const ctnQty = parseInt(item.ctnQty) || 0;
        const pcsQty = parseInt(item.pcsQty) || 0;
        const freeQty = parseInt(item.freeQty) || 0;
        const paidPcs = (ctnQty * upc) + pcsQty;
        const price = parseFloat(item.price) || 0;
        const itemTotal = Math.round(paidPcs * price);

        return `
        <div class="qs-item-card">
            <div class="qs-card-top-row">
                <div class="qs-card-title">${escapeHtml(item.name)}</div>
                <button type="button" class="qs-trash-btn" onclick="removeQuickCartItem(${idx})" title="Remove">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            <div class="qs-card-mid-row">
                <div class="qs-card-mid-left">
                    <span>Batch: <strong>${escapeHtml(item.batchNo || 'BT-20260830-001')}</strong></span>
                    <span style="color:#cbd5e1;">|</span>
                    <span>৳${price.toFixed(2)}</span>
                    <strong style="color: #2563eb;">(1 CTN = ${upc})</strong>
                    <span class="qs-pcs-badge">= ${paidPcs} pcs</span>
                </div>
                <div class="qs-card-price-total">৳ ${itemTotal}</div>
            </div>
            <div class="qs-steppers-row">
                <div class="qs-stepper-group">
                    <span class="qs-stepper-label" style="color:#2563eb;">CTN:</span>
                    <div class="qs-stepper-box">
                        <button type="button" class="qs-btn-sub" onclick="stepQsCtn(${idx}, -1)">-</button>
                        <input type="number" class="qs-step-input" value="${ctnQty}" min="0" oninput="updateQsCtnQty(${idx}, this.value, true)" onchange="renderQuickCart()">
                        <button type="button" class="qs-btn-add" onclick="stepQsCtn(${idx}, 1)">+</button>
                    </div>
                </div>
                <div class="qs-stepper-group">
                    <span class="qs-stepper-label" style="color:#64748b;">PCS:</span>
                    <div class="qs-stepper-box">
                        <button type="button" class="qs-btn-sub" onclick="stepQsPcs(${idx}, -1)">-</button>
                        <input type="number" class="qs-step-input" value="${pcsQty}" min="0" oninput="updateQsPcsQty(${idx}, this.value, true)" onchange="renderQuickCart()">
                        <button type="button" class="qs-btn-add" onclick="stepQsPcs(${idx}, 1)">+</button>
                    </div>
                </div>
                <div class="qs-stepper-group">
                    <span class="qs-stepper-label" style="color:#15803d;">FREE:</span>
                    <div class="qs-stepper-box">
                        <button type="button" class="qs-btn-sub" onclick="stepQsFree(${idx}, -1)">-</button>
                        <input type="number" class="qs-step-input" value="${freeQty}" min="0" oninput="updateQsFreeQty(${idx}, this.value, true)" onchange="renderQuickCart()">
                        <button type="button" class="qs-btn-add" onclick="stepQsFree(${idx}, 1)">+</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    calculateQuickTotal();
};

window.calculateQuickTotal = function() {
    let sub = 0;
    quickCart.forEach(item => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const paidPcs = ((parseInt(item.ctnQty) || 0) * upc) + (parseInt(item.pcsQty) || 0);
        sub += Math.round(paidPcs * (parseFloat(item.price) || 0));
    });

    const disc = parseFloat(document.getElementById('qs_discount')?.value) || 0;
    const tax = parseFloat(document.getElementById('qs_tax')?.value) || 0;
    const grand = Math.max(0, sub - disc + tax);

    const tot = document.getElementById('qs_total_text');
    if (tot) tot.textContent = formatBD(grand);

    const paidInp = document.getElementById('qs_paid');
    const paid = parseFloat(paidInp?.value) || 0;
    const dueEl = document.getElementById('qs_due');
    if (dueEl) dueEl.value = String(Math.max(0, grand - paid));
};

window.clearQuickCart = function() { 
    quickCart = []; 
    renderQuickCart(); 
};

window.qsFullPaid = function() {
    let sub = 0;
    quickCart.forEach(item => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const paidPcs = ((parseInt(item.ctnQty) || 0) * upc) + (parseInt(item.pcsQty) || 0);
        sub += Math.round(paidPcs * (parseFloat(item.price) || 0));
    });
    const disc = parseFloat(document.getElementById('qs_discount')?.value) || 0;
    const tax = parseFloat(document.getElementById('qs_tax')?.value) || 0;
    const grand = Math.max(0, sub - disc + tax);

    const paidEl = document.getElementById('qs_paid');
    if (paidEl) paidEl.value = grand > 0 ? grand.toFixed(2) : '0.00';
    calculateQuickTotal();
};

let isQuickSaleProcessing = false;

window.submitQuickSale = function() {
    if (isQuickSaleProcessing) {
        console.warn("Quick sale is currently being processed. Ignoring multiple clicks.");
        return;
    }
    if (!quickCart.length) return showAlertModal("Validation", "Cart is empty.");

    const qsBtn = document.getElementById('btnQuickSaleSubmit') || document.querySelector('.qs-btn-submit');
    const origBtnHtml = qsBtn ? qsBtn.innerHTML : '';

    const unlockQsBtn = () => {
        isQuickSaleProcessing = false;
        if (qsBtn) {
            qsBtn.disabled = false;
            qsBtn.style.pointerEvents = 'auto';
            qsBtn.style.opacity = '1';
            qsBtn.innerHTML = origBtnHtml || 'SUBMIT';
        }
    };

    isQuickSaleProcessing = true;
    if (qsBtn) {
        qsBtn.disabled = true;
        qsBtn.style.pointerEvents = 'none';
        qsBtn.style.opacity = '0.65';
        qsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    let sub = 0;
    const itemsPayload = quickCart.map(item => {
        const upc = Math.max(1, parseInt(item.upc) || 1);
        const ctnQty = parseInt(item.ctnQty) || 0;
        const pcsQty = parseInt(item.pcsQty) || 0;
        const freeQty = parseInt(item.freeQty) || 0;
        const paidPcs = (ctnQty * upc) + pcsQty;
        const totalDeductPcs = paidPcs + freeQty;
        const itemTotal = Math.round(paidPcs * (parseFloat(item.price) || 0));
        sub += itemTotal;
        return {
            id: item.id,
            name: item.name,
            batchNo: item.batchNo,
            price: item.price,
            qty: paidPcs,
            freeQty: freeQty,
            deductQty: totalDeductPcs
        };
    });

    const disc = parseFloat(document.getElementById('qs_discount')?.value) || 0;
    const tax = parseFloat(document.getElementById('qs_tax')?.value) || 0;
    const grand = Math.max(0, sub - disc + tax);
    const paid = parseFloat(document.getElementById('qs_paid')?.value) || 0;
    const memoNo = document.getElementById('qs_memo_no')?.value.trim() || '23456';
    const custName = document.getElementById('qs_customer')?.value || 'Nasim Store-HBL';
    const foundCust = (allCustomers || []).find(c => c.Customer_Name === custName);
    const custId = foundCust ? foundCust.Customer_ID : 'WALK-IN';

    const payload = {
        warehouseId: document.getElementById('qs_warehouse')?.value || 'W001',
        memoNo: memoNo,
        customerId: custId,
        date: document.getElementById('qs_sale_date')?.value || new Date().toISOString().split('T')[0],
        items: itemsPayload,
        subtotal: sub,
        grandTotal: grand,
        discount: disc,
        paymentMode: paid >= grand ? 'Cash' : 'Credit (Due)',
        paidAmount: paid,
        dueAmount: Math.max(0, grand - paid),
        clientToken: `QS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };

    google.script.run
        .withSuccessHandler(res => {
            unlockQsBtn();
            if (res && res.success) {
                const formContainer = document.getElementById('qs_form_container');
                if (formContainer) formContainer.style.display = 'none';
                const invoiceEl = document.getElementById('qs_success_invoice_no');
                if (invoiceEl) invoiceEl.innerText = res.invoiceNo;
                const successScreen = document.getElementById('qs_success_screen');
                if (successScreen) successScreen.style.display = 'flex';
                if (window.loadPosRecentSales) loadPosRecentSales();
                if (window.loadDashboardData) loadDashboardData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process sale.");
            }
        })
        .withFailureHandler(err => {
            unlockQsBtn();
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to process quick sale.");
        })
        .createBulkSale(payload);
};

window.resetQuickSaleUI = function() {
    quickCart = [];
    const formContainer = document.getElementById('qs_form_container');
    if (formContainer) formContainer.style.display = 'flex';
    const successScreen = document.getElementById('qs_success_screen');
    if (successScreen) successScreen.style.display = 'none';
    closeModal('quickSaleModal');
};

// Global click listener to close Quick Sale & Quick Purchase dropdown when clicked outside
document.addEventListener('click', function(e) {
    const searchBar = document.querySelector('#quickSaleModal .qs-search-bar');
    const dropdown = document.getElementById('qs_search_results');
    if (dropdown && searchBar && !searchBar.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }

    const qpSearchBar = document.querySelector('#quickPurchaseModule .qs-search-bar');
    const qpDropdown = document.getElementById('qp_results');
    if (qpDropdown && qpSearchBar && !qpSearchBar.contains(e.target) && !qpDropdown.contains(e.target)) {
        qpDropdown.style.display = 'none';
    }
});

// QUICK PURCHASE (MOBILE APP INTERFACE)
window.openQuickPurchase = function() {
    const modal = document.getElementById('quickPurchaseModule');
    if (modal) modal.style.display = 'flex';

    // Reset UI to form
    const formCont = document.getElementById('qp_form_container');
    const succScreen = document.getElementById('qp_success_screen');
    if (formCont) formCont.style.display = 'flex';
    if (succScreen) succScreen.style.display = 'none';

    // Set purchase date if empty
    const purchDate = document.getElementById('qp_purchase_date');
    if (purchDate && !purchDate.value) {
        purchDate.value = new Date().toISOString().split('T')[0];
    }

    // Set auto PO invoice number
    const invNoEl = document.getElementById('qp_invoice_no');
    if (invNoEl && !invNoEl.value) {
        invNoEl.value = 'PO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(100 + Math.random()*900);
    }

    // Populate Warehouses
    google.script.run.withSuccessHandler(data => {
        warehouseList = data || [];
        const whSel = document.getElementById('qp_warehouse_select');
        if (whSel) {
            whSel.innerHTML = warehouseList.map(w => `<option value="${w.Warehouse_ID}">${w.Warehouse_Name}</option>`).join('');
            const mb = warehouseList.find(w => (w.Warehouse_Name || '').toLowerCase().includes('moulovi'));
            if (mb) whSel.value = mb.Warehouse_ID;
        }
    }).getWarehouses();

    // Populate Suppliers
    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(s => supplierMap[s.Supplier_ID] = s.Supplier_Name);
        const suppSel = document.getElementById('qp_supplier_select');
        if (suppSel) {
            suppSel.innerHTML = (data || []).map((s, idx) => `<option value="${s.Supplier_ID}" ${idx === 0 ? 'selected' : ''}>${s.Supplier_Name}</option>`).join('');
        }
    }).getData('Suppliers');

    // Populate Products
    google.script.run.withSuccessHandler(prods => {
        allProducts = prods || [];
        qp_master_products = prods || [];
        (prods || []).forEach(p => productMap[p.Product_ID] = p);
    }).getData('Products');

    // Render Cart
    qp_renderCart();
};

window.closeQuickPurchase = function() {
    closeModal('quickPurchaseModule');
    const dd = document.getElementById('qp_results');
    if (dd) dd.style.display = 'none';
};

window.qp_resetUI = function() {
    const formCont = document.getElementById('qp_form_container');
    const succScreen = document.getElementById('qp_success_screen');
    if (formCont) formCont.style.display = 'flex';
    if (succScreen) succScreen.style.display = 'none';
    qp_cart = [];
    qp_renderCart();
};

window.qp_filterProducts = function(val) {
    const dd = document.getElementById('qp_results');
    if (!dd) return;
    if (!val || val.trim().length === 0) {
        dd.style.display = 'none';
        return;
    }
    const q = val.toLowerCase().trim();
    const prods = (qp_master_products && qp_master_products.length) ? qp_master_products : allProducts;
    const matches = prods.filter(p => 
        (p.Product_Name && p.Product_Name.toLowerCase().includes(q)) || 
        (p.Product_ID && p.Product_ID.toLowerCase().includes(q)) ||
        (p.Barcode && String(p.Barcode).toLowerCase().includes(q))
    );

    if (matches.length) {
        dd.innerHTML = matches.slice(0, 15).map(p => `
            <div class="qs-dropdown-item" onclick="qp_selectProduct('${p.Product_ID}')">
                <div>
                    <div style="font-weight:700; color:#0f172a;">${p.Product_Name}</div>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
                        <span>Code: <strong>${p.Product_ID}</strong> | Pack: <strong>${p.UPC || 1} pcs/CTN</strong></span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:#059669;">৳${formatBD(p.Unit_Price || 0)}</div>
                    <div style="font-size:0.72rem; color:#64748b;">Cost/pc</div>
                </div>
            </div>`).join('');
        dd.style.display = 'block';
    } else {
        dd.innerHTML = '<div style="padding:14px; color:#94a3b8; text-align:center; font-size:0.85rem;">No matching products found</div>';
        dd.style.display = 'block';
    }
};

window.qp_selectProduct = function(productId) {
    const prods = (qp_master_products && qp_master_products.length) ? qp_master_products : allProducts;
    const p = prods.find(item => item.Product_ID === productId) || productMap[productId];
    if (!p) return;

    let packSize = parseInt(p.UPC) || 1;
    if (packSize <= 0) packSize = 1;

    const uCost = parseFloat(p.Unit_Price) || 0;
    const sPrice = parseFloat(p.Sale_Price) || 0;
    const mPrice = parseFloat(p.MRP_Price) || (sPrice ? Math.round(sPrice * 1.1) : 0);
    const cCost = uCost * packSize;

    // Check if already in cart
    const existing = qp_cart.find(item => item.id === productId);
    if (existing) {
        existing.ctnQty = (existing.ctnQty || 0) + 1;
        qp_syncItemTotal(qp_cart.indexOf(existing));
    } else {
        const expDate = new Date();
        expDate.setFullYear(expDate.getFullYear() + 1);
        const batchNo = `BT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random()*9000)}`;

        qp_cart.push({
            id: p.Product_ID,
            name: p.Product_Name,
            packSize: packSize,
            batch: batchNo,
            expiry: (p.Expiry_Date ? p.Expiry_Date.split('T')[0] : expDate.toISOString().split('T')[0]),
            ctnQty: 1,
            loosePcs: 0,
            freeQty: 0,
            paidQty: packSize,
            inboundStk: packSize,
            unitCost: uCost,
            ctnCost: cCost,
            salePrice: sPrice,
            mrpPrice: mPrice,
            total: Math.round(packSize * uCost)
        });
    }

    const sInp = document.getElementById('qp_search_input');
    if (sInp) sInp.value = '';
    const dd = document.getElementById('qp_results');
    if (dd) dd.style.display = 'none';

    qp_renderCart();
};

window.stepQpCtn = function(idx, delta) {
    if (!qp_cart[idx]) return;
    const cur = parseInt(qp_cart[idx].ctnQty) || 0;
    qp_cart[idx].ctnQty = Math.max(0, cur + delta);
    qp_syncItemTotal(idx);
    qp_renderCart();
};

window.stepQpLoose = function(idx, delta) {
    if (!qp_cart[idx]) return;
    const cur = parseInt(qp_cart[idx].loosePcs) || 0;
    qp_cart[idx].loosePcs = Math.max(0, cur + delta);
    qp_syncItemTotal(idx);
    qp_renderCart();
};

window.stepQpFree = function(idx, delta) {
    if (!qp_cart[idx]) return;
    const cur = parseInt(qp_cart[idx].freeQty) || 0;
    qp_cart[idx].freeQty = Math.max(0, cur + delta);
    qp_syncItemTotal(idx);
    qp_renderCart();
};

window.updateQpCtnQty = function(idx, val, isTyping = false) {
    if (!qp_cart[idx]) return;
    qp_cart[idx].ctnQty = Math.max(0, parseInt(val) || 0);
    qp_syncItemTotal(idx);
    if (isTyping) qp_calculateTotals();
    else qp_renderCart();
};

window.updateQpLooseQty = function(idx, val, isTyping = false) {
    if (!qp_cart[idx]) return;
    qp_cart[idx].loosePcs = Math.max(0, parseInt(val) || 0);
    qp_syncItemTotal(idx);
    if (isTyping) qp_calculateTotals();
    else qp_renderCart();
};

window.updateQpFreeQty = function(idx, val, isTyping = false) {
    if (!qp_cart[idx]) return;
    qp_cart[idx].freeQty = Math.max(0, parseInt(val) || 0);
    qp_syncItemTotal(idx);
    if (isTyping) qp_calculateTotals();
    else qp_renderCart();
};

window.qp_updateCost = function(idx, val) {
    if (!qp_cart[idx]) return;
    qp_cart[idx].unitCost = Math.max(0, parseFloat(val) || 0);
    qp_syncItemTotal(idx);
    qp_calculateTotals();
};

window.qp_updateBatch = function(idx, val) {
    if (!qp_cart[idx]) return;
    qp_cart[idx].batch = val;
};

window.qp_updateExpiry = function(idx, val) {
    if (!qp_cart[idx]) return;
    qp_cart[idx].expiry = val;
};

function qp_syncItemTotal(idx) {
    const item = qp_cart[idx];
    if (!item) return;
    const upc = Math.max(1, parseInt(item.packSize) || 1);
    item.paidQty = ((parseInt(item.ctnQty) || 0) * upc) + (parseInt(item.loosePcs) || 0);
    item.inboundStk = item.paidQty + (parseInt(item.freeQty) || 0);
    item.total = Math.round(item.paidQty * (parseFloat(item.unitCost) || 0));
}

window.qp_removeItem = function(idx) {
    qp_cart.splice(idx, 1);
    qp_renderCart();
};

window.qp_clearCart = function() {
    qp_cart = [];
    qp_renderCart();
};

window.qp_renderCart = function() {
    const container = document.getElementById('quickPurchCartItems');
    if (!container) return;

    if (!qp_cart.length) {
        container.innerHTML = `
            <div style="background:#ffffff; border:1.5px dashed #cbd5e1; border-radius:12px; padding:26px 16px; text-align:center; color:#94a3b8; margin-bottom:12px;">
                <i class="fas fa-truck-loading fa-2x" style="opacity:0.35; margin-bottom:8px; display:block; color:#10b981;"></i>
                <div style="font-weight:700; color:#475569;">Purchase Cart is Empty</div>
                <div style="font-size:0.78rem; margin-top:2px;">Search and add products above to receive stock.</div>
            </div>`;
        qp_calculateTotals();
        return;
    }

    container.innerHTML = qp_cart.map((item, idx) => {
        const upc = Math.max(1, parseInt(item.packSize) || 1);
        const ctnQty = parseInt(item.ctnQty) || 0;
        const loosePcs = parseInt(item.loosePcs) || 0;
        const freeQty = parseInt(item.freeQty) || 0;
        const paidPcs = (ctnQty * upc) + loosePcs;
        const unitCost = parseFloat(item.unitCost) || 0;
        const lineTotal = Math.round(paidPcs * unitCost);

        return `
        <div class="qs-item-card" style="border-left: 4px solid #10b981;">
            <div class="qs-card-top-row">
                <div class="qs-card-title">${escapeHtml(item.name)}</div>
                <button type="button" class="qs-trash-btn" onclick="qp_removeItem(${idx})" title="Remove">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>

            <!-- Mid Row: Pack Size, Cost, Total -->
            <div class="qs-card-mid-row" style="flex-wrap: wrap; gap: 4px;">
                <div class="qs-card-mid-left" style="flex-wrap: wrap;">
                    <span style="color:#059669; font-weight:700;">1 CTN = ${upc} pcs</span>
                    <span style="color:#cbd5e1;">|</span>
                    <span>Cost: ৳<input type="number" step="0.01" value="${unitCost.toFixed(2)}" oninput="qp_updateCost(${idx}, this.value)" style="width:65px; height:22px; padding:1px 4px; font-size:0.78rem; border:1px solid #cbd5e1; border-radius:4px; font-weight:700; color:#0f172a;"></span>
                    <span class="qs-pcs-badge" style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0;">= ${paidPcs + freeQty} pcs</span>
                </div>
                <div class="qs-card-price-total" style="color: #059669;">৳ ${formatBD(lineTotal)}</div>
            </div>

            <!-- Batch & Expiry Inputs -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div>
                    <label style="display:block; font-size:0.68rem; font-weight:700; color:#64748b; margin-bottom:2px;">BATCH NO</label>
                    <input type="text" value="${escapeHtml(item.batch || '')}" placeholder="Batch..." onchange="qp_updateBatch(${idx}, this.value)" style="width:100%; height:28px; font-size:0.78rem; padding:0 8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                </div>
                <div>
                    <label style="display:block; font-size:0.68rem; font-weight:700; color:#64748b; margin-bottom:2px;">EXPIRY DATE</label>
                    <input type="date" value="${item.expiry || ''}" onchange="qp_updateExpiry(${idx}, this.value)" style="width:100%; height:28px; font-size:0.78rem; padding:0 6px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                </div>
            </div>

            <!-- Steppers Row -->
            <div class="qs-steppers-row">
                <div class="qs-stepper-group">
                    <span class="qs-stepper-label" style="color:#059669;">CTN:</span>
                    <div class="qs-stepper-box">
                        <button type="button" class="qs-btn-sub" onclick="stepQpCtn(${idx}, -1)">-</button>
                        <input type="number" class="qs-step-input" value="${ctnQty}" min="0" oninput="updateQpCtnQty(${idx}, this.value, true)" onchange="qp_renderCart()">
                        <button type="button" class="qs-btn-add" onclick="stepQpCtn(${idx}, 1)">+</button>
                    </div>
                </div>
                <div class="qs-stepper-group">
                    <span class="qs-stepper-label" style="color:#64748b;">PCS:</span>
                    <div class="qs-stepper-box">
                        <button type="button" class="qs-btn-sub" onclick="stepQpLoose(${idx}, -1)">-</button>
                        <input type="number" class="qs-step-input" value="${loosePcs}" min="0" oninput="updateQpLooseQty(${idx}, this.value, true)" onchange="qp_renderCart()">
                        <button type="button" class="qs-btn-add" onclick="stepQpLoose(${idx}, 1)">+</button>
                    </div>
                </div>
                <div class="qs-stepper-group">
                    <span class="qs-stepper-label" style="color:#15803d;">FREE:</span>
                    <div class="qs-stepper-box">
                        <button type="button" class="qs-btn-sub" onclick="stepQpFree(${idx}, -1)">-</button>
                        <input type="number" class="qs-step-input" value="${freeQty}" min="0" oninput="updateQpFreeQty(${idx}, this.value, true)" onchange="qp_renderCart()">
                        <button type="button" class="qs-btn-add" onclick="stepQpFree(${idx}, 1)">+</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    qp_calculateTotals();
};

window.qp_calculateTotals = function() {
    let totalCtn = 0;
    let totalPcs = 0;
    let grandTotal = 0;

    qp_cart.forEach(item => {
        const upc = Math.max(1, parseInt(item.packSize) || 1);
        const paidPcs = ((parseInt(item.ctnQty) || 0) * upc) + (parseInt(item.loosePcs) || 0);
        const freePcs = parseInt(item.freeQty) || 0;
        totalCtn += (parseInt(item.ctnQty) || 0);
        totalPcs += (paidPcs + freePcs);
        grandTotal += Math.round(paidPcs * (parseFloat(item.unitCost) || 0));
    });

    const ctnSummaryEl = document.getElementById('qp_summary_ctn');
    if (ctnSummaryEl) ctnSummaryEl.value = `${formatBD(totalCtn)} CTN`;
    const pcsSummaryEl = document.getElementById('qp_summary_pcs');
    if (pcsSummaryEl) pcsSummaryEl.value = `${formatBD(totalPcs)} pcs`;

    const totalTextEl = document.getElementById('qp_total_text');
    if (totalTextEl) totalTextEl.textContent = formatBD(grandTotal);

    const paidInp = document.getElementById('qp_paid_amount');
    const paidVal = parseFloat(paidInp?.value) || 0;
    const dueEl = document.getElementById('qp_due_amount');
    if (dueEl) dueEl.value = String(Math.max(0, grandTotal - paidVal));
};

window.qp_fullPaid = function() {
    let grandTotal = 0;
    qp_cart.forEach(item => {
        const upc = Math.max(1, parseInt(item.packSize) || 1);
        const paidPcs = ((parseInt(item.ctnQty) || 0) * upc) + (parseInt(item.loosePcs) || 0);
        grandTotal += Math.round(paidPcs * (parseFloat(item.unitCost) || 0));
    });
    const paidInp = document.getElementById('qp_paid_amount');
    if (paidInp) paidInp.value = grandTotal;
    qp_calculateTotals();
};

let isQpProcessing = false;

window.qp_submit = function() {
    if (isQpProcessing) {
        console.warn("Purchase is already being processed. Ignoring multiple clicks.");
        return;
    }
    if (!qp_cart.length) {
        return showAlertModal("Validation", "Please add at least one product to this purchase before saving.");
    }

    const whId = document.getElementById('qp_warehouse_select')?.value;
    if (!whId) {
        return showAlertModal("Validation", "Please select a Destination Warehouse.");
    }

    const suppId = document.getElementById('qp_supplier_select')?.value;
    if (!suppId) {
        return showAlertModal("Validation", "Please select a Supplier for this purchase inbound.");
    }

    const pDate = document.getElementById('qp_purchase_date')?.value || new Date().toISOString().split('T')[0];
    const invoiceNo = document.getElementById('qp_invoice_no')?.value?.trim();

    const submitBtn = document.getElementById('qp_btn_submit');
    const origHtml = submitBtn ? submitBtn.innerHTML : '';

    isQpProcessing = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    const payload = {
        warehouseId: whId,
        supplierId: suppId,
        date: pDate,
        invoiceNo: invoiceNo,
        items: qp_cart.map(i => ({
            id: i.id,
            name: i.name,
            batch: i.batch,
            expiry: i.expiry,
            qty: i.paidQty,
            freeQty: i.freeQty,
            price: i.unitCost,
            salePrice: i.salePrice,
            mrpPrice: i.mrpPrice,
            total: i.total
        }))
    };

    google.script.run
        .withSuccessHandler(res => {
            isQpProcessing = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origHtml || 'CONFIRM & RECEIVE';
            }
            if (res && res.success) {
                const formCont = document.getElementById('qp_form_container');
                const succScreen = document.getElementById('qp_success_screen');
                const poNoEl = document.getElementById('qp_success_po_no');
                if (poNoEl) poNoEl.textContent = res.purchaseId || invoiceNo || 'PO-' + Date.now().toString().slice(-4);
                if (formCont) formCont.style.display = 'none';
                if (succScreen) succScreen.style.display = 'flex';

                loadPurchasesData();
                if (window.loadDashboardData) loadDashboardData();
                if (window.loadWarehouseInfoData) loadWarehouseInfoData();
                if (window.loadInventoryData) loadInventoryData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process purchase entry.");
            }
        })
        .withFailureHandler(err => {
            isQpProcessing = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origHtml || 'CONFIRM & RECEIVE';
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to record purchase.");
        })
        .createBulkPurchase(payload);
};

// PURCHASES & NEW PURCHASE INBOUND SECTION
window.focusNewPurchaseForm = function() {
    const card = document.getElementById('newPurchaseCard');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth' });
    }
    const inp = document.getElementById('purch_search_input');
    if (inp) inp.focus();
};

window.resetInboundPurchaseForm = function() {
    const pInp = document.getElementById('purch_search_input');
    if (pInp) pInp.value = '';
    const pId = document.getElementById('purch_selected_prod_id');
    if (pId) pId.value = '';
    const bInp = document.getElementById('purch_item_batch');
    if (bInp) bInp.value = '';
    const expInp = document.getElementById('purch_item_expiry');
    if (expInp) expInp.value = '';
    const qInp = document.getElementById('purch_item_qty');
    if (qInp) qInp.value = '';
    const fInp = document.getElementById('purch_item_free');
    if (fInp) fInp.value = '0';
    const cInp = document.getElementById('purch_item_cost');
    if (cInp) cInp.value = '';
    const sInp = document.getElementById('purch_item_sale');
    if (sInp) sInp.value = '';
    const mInp = document.getElementById('purch_item_mrp');
    if (mInp) mInp.value = '';
    const tInp = document.getElementById('purch_item_total');
    if (tInp) tInp.value = '';
    const txInp = document.getElementById('purch_item_tax');
    if (txInp) txInp.value = '0';
    const nInp = document.getElementById('purch_item_net');
    if (nInp) nInp.value = '';
    const dd = document.getElementById('purch_search_dropdown');
    if (dd) dd.style.display = 'none';
};

window.filterInboundProducts = function(val) {
    const dd = document.getElementById('purch_search_dropdown');
    if (!dd) return;
    if (!val || val.trim().length === 0) {
        dd.style.display = 'none';
        return;
    }
    const q = val.toLowerCase().trim();
    const prods = (allProducts && allProducts.length) ? allProducts : qp_master_products;
    const matches = prods.filter(p => 
        (p.Product_Name && p.Product_Name.toLowerCase().includes(q)) || 
        (p.Product_ID && p.Product_ID.toLowerCase().includes(q)) ||
        (p.Barcode && String(p.Barcode).toLowerCase().includes(q))
    );

    if (matches.length) {
        dd.innerHTML = matches.map(p => `
            <div class="qp-drop-item" style="padding:10px 14px; border-bottom:1px solid #f1f5f9; cursor:pointer;" onclick="selectInboundProduct('${p.Product_ID}')">
                <div style="font-weight:700; color:#1e293b;">${p.Product_Name}</div>
                <div style="font-size:0.78rem; color:#64748b; display:flex; justify-content:space-between; margin-top:2px;">
                    <span>ID: ${p.Product_ID}</span>
                    <span>Cost: ৳${formatBD(p.Unit_Price || 0)} | Sale: ৳${formatBD(p.Sale_Price || 0)}</span>
                </div>
            </div>`).join('');
        dd.style.display = 'block';
    } else {
        dd.innerHTML = '<div style="padding:12px; color:#94a3b8; text-align:center;">No matching products found</div>';
        dd.style.display = 'block';
    }
};

window.selectInboundProduct = function(productId) {
    const prods = (allProducts && allProducts.length) ? allProducts : qp_master_products;
    const p = prods.find(item => item.Product_ID === productId) || productMap[productId];
    if (!p) return;

    const pInp = document.getElementById('purch_search_input');
    if (pInp) pInp.value = `${p.Product_Name} (${p.Product_ID})`;
    const pId = document.getElementById('purch_selected_prod_id');
    if (pId) pId.value = p.Product_ID;

    const bInp = document.getElementById('purch_item_batch');
    if (bInp && !bInp.value) {
        bInp.value = `BT-${Date.now().toString().slice(-4)}`;
    }

    const cInp = document.getElementById('purch_item_cost');
    if (cInp) cInp.value = p.Unit_Price || 0;
    const sInp = document.getElementById('purch_item_sale');
    if (sInp) sInp.value = p.Sale_Price || 0;
    const mInp = document.getElementById('purch_item_mrp');
    if (mInp) mInp.value = p.MRP_Price || (p.Sale_Price ? Math.round(p.Sale_Price * 1.1) : 0);

    const qInp = document.getElementById('purch_item_qty');
    if (qInp && (!qInp.value || qInp.value === '0')) qInp.value = '1';

    const dd = document.getElementById('purch_search_dropdown');
    if (dd) dd.style.display = 'none';

    calculateInboundLineTotal();
    if (qInp) qInp.focus();
};

window.calculateInboundLineTotal = function() {
    const qty = parseFloat(document.getElementById('purch_item_qty')?.value) || 0;
    const cost = parseFloat(document.getElementById('purch_item_cost')?.value) || 0;
    const tax = parseFloat(document.getElementById('purch_item_tax')?.value) || 0;

    const lineTotal = qty * cost;
    const netTotal = lineTotal + (lineTotal * (tax / 100));

    const totEl = document.getElementById('purch_item_total');
    if (totEl) totEl.value = lineTotal.toFixed(2);
    const netEl = document.getElementById('purch_item_net');
    if (netEl) netEl.value = netTotal.toFixed(2);
};

window.addInboundLineItem = function() {
    const prodId = document.getElementById('purch_selected_prod_id')?.value;
    const prodInput = document.getElementById('purch_search_input')?.value?.trim();
    if (!prodId || !prodInput) {
        return showAlertModal("Validation", "Please select a product from the list.");
    }

    const qty = parseFloat(document.getElementById('purch_item_qty')?.value) || 0;
    if (qty <= 0) {
        return showAlertModal("Validation", "Please enter a valid purchase quantity greater than 0.");
    }

    const freeQty = parseFloat(document.getElementById('purch_item_free')?.value) || 0;
    const cost = parseFloat(document.getElementById('purch_item_cost')?.value) || 0;
    const sale = parseFloat(document.getElementById('purch_item_sale')?.value) || 0;
    const mrp = parseFloat(document.getElementById('purch_item_mrp')?.value) || 0;
    const batch = document.getElementById('purch_item_batch')?.value?.trim() || `BT-${Date.now().toString().slice(-4)}`;
    const expiry = document.getElementById('purch_item_expiry')?.value || null;

    const prods = (allProducts && allProducts.length) ? allProducts : qp_master_products;
    const p = prods.find(item => item.Product_ID === prodId) || productMap[prodId] || { Product_Name: prodInput };

    inboundPurchaseItems.push({
        id: prodId,
        name: p.Product_Name || prodInput,
        batch: batch,
        expiry: expiry,
        qty: qty,
        freeQty: freeQty,
        price: cost,
        salePrice: sale,
        mrpPrice: mrp,
        total: qty * cost
    });

    renderInboundItemsTable();
    resetInboundPurchaseForm();
};

window.renderInboundItemsTable = function() {
    const tbody = document.getElementById('inboundItemsTableBody');
    if (!tbody) return;

    if (!inboundPurchaseItems.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center" style="color:#94a3b8; padding:20px;">
                    <i class="fas fa-shopping-basket" style="margin-right:6px;"></i> No products added to this purchase yet. Select a product above and click "Add".
                </td>
            </tr>`;
        updateInboundTotals();
        return;
    }

    tbody.innerHTML = inboundPurchaseItems.map((item, idx) => `
        <tr>
            <td style="font-weight:700;">${idx + 1}</td>
            <td>
                <strong>${item.name}</strong><br>
                <small style="color:#64748b;">Code: ${item.id}</small>
            </td>
            <td><span class="badge badge-info">${item.batch}</span></td>
            <td>${item.expiry || '-'}</td>
            <td style="text-align:center; font-weight:700;">
                <input type="number" min="1" value="${item.qty}" style="width:65px; text-align:center; padding:3px 6px; border:1px solid #cbd5e1; border-radius:6px;" onchange="updateInboundItemQty(${idx}, this.value)">
            </td>
            <td style="text-align:center; color:#64748b;">${item.freeQty || 0}</td>
            <td style="text-align:right;">৳ ${formatBD(item.price, 2)}</td>
            <td style="text-align:right;">৳ ${formatBD(item.salePrice, 2)}</td>
            <td style="text-align:right;">৳ ${formatBD(item.mrpPrice, 2)}</td>
            <td style="text-align:right; font-weight:800; color:#10b981;">৳ ${formatBD(item.total, 2)}</td>
            <td style="text-align:center;">
                <button type="button" class="btn-icon btn-delete" title="Remove Item" onclick="removeInboundItem(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        </tr>`).join('');

    updateInboundTotals();
};

window.updateInboundItemQty = function(idx, val) {
    const q = parseFloat(val) || 1;
    if (inboundPurchaseItems[idx]) {
        inboundPurchaseItems[idx].qty = Math.max(1, q);
        inboundPurchaseItems[idx].total = inboundPurchaseItems[idx].qty * inboundPurchaseItems[idx].price;
        renderInboundItemsTable();
    }
};

window.removeInboundItem = function(idx) {
    inboundPurchaseItems.splice(idx, 1);
    renderInboundItemsTable();
};

window.clearInboundItems = function() {
    if (inboundPurchaseItems.length && !confirm("Are you sure you want to clear all added purchase items?")) {
        return;
    }
    inboundPurchaseItems = [];
    renderInboundItemsTable();
};

function updateInboundTotals() {
    const totalItems = inboundPurchaseItems.length;
    const totalQty = inboundPurchaseItems.reduce((acc, i) => acc + (parseFloat(i.qty) || 0) + (parseFloat(i.freeQty) || 0), 0);
    const grandTotal = inboundPurchaseItems.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    const itemsEl = document.getElementById('inboundTotalItemsCount');
    if (itemsEl) itemsEl.textContent = totalItems;
    const qtyEl = document.getElementById('inboundTotalQuantityCount');
    if (qtyEl) qtyEl.textContent = totalQty;
    const totalEl = document.getElementById('inboundGrandTotalText');
    if (totalEl) totalEl.textContent = '৳ ' + formatBD(grandTotal, 2);
}

let isInboundPurchaseProcessing = false;

window.submitInboundPurchase = function() {
    if (isInboundPurchaseProcessing) {
        console.warn("Inbound purchase is currently being processed. Ignoring multiple clicks.");
        return;
    }
    if (!inboundPurchaseItems.length) {
        return showAlertModal("Validation", "Cannot submit an empty purchase. Add at least one product item.");
    }

    const whId = document.getElementById('p_purch_warehouse')?.value || 'W001';
    const suppId = document.getElementById('p_purch_supplier')?.value;
    if (!suppId) {
        return showAlertModal("Validation", "Please select a Supplier for this purchase inbound.");
    }

    const dateVal = document.getElementById('p_purch_date')?.value || new Date().toISOString().split('T')[0];

    const payload = {
        warehouseId: whId,
        supplierId: suppId,
        date: dateVal,
        items: inboundPurchaseItems
    };

    const submitBtn = document.getElementById('btnSubmitInboundPurchase');
    const origHtml = submitBtn ? submitBtn.innerHTML : '';

    const unlockInboundBtn = () => {
        isInboundPurchaseProcessing = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml || '<i class="fas fa-check-circle"></i> Complete Purchase & Receive Stock';
        }
    };

    isInboundPurchaseProcessing = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    google.script.run
        .withSuccessHandler(res => {
            unlockInboundBtn();
            if (res && res.success) {
                showAlertModal("Purchase Inbound Saved", `Purchase order ${res.purchaseId} recorded successfully! Stock has been updated in warehouse ${whId}.`);
                inboundPurchaseItems = [];
                renderInboundItemsTable();
                resetInboundPurchaseForm();
                loadPurchasesData();
                if (window.loadDashboardData) loadDashboardData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process purchase entry.");
            }
        })
        .withFailureHandler(err => {
            unlockInboundBtn();
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to record inbound purchase.");
        })
        .createBulkPurchase(payload);
};

window.filterPurchasesHistory = function(val) {
    purchasesHistoryFilter = (val || '').toLowerCase().trim();
    purchPage = 1;
    renderPurchasesTable();
};

// PURCHASES TABLE
window.loadPurchasesData = function() {
    const pDate = document.getElementById('p_purch_date');
    if (pDate && !pDate.value) {
        pDate.value = new Date().toISOString().split('T')[0];
    }

    // Ensure warehouses and suppliers are loaded in the selects
    google.script.run.withSuccessHandler(data => {
        warehouseList = data || [];
        const pPurchWhSel = document.getElementById('p_purch_warehouse');
        if (pPurchWhSel && !pPurchWhSel.children.length) {
            pPurchWhSel.innerHTML = warehouseList.map(w => `<option value="${w.Warehouse_ID}">${w.Warehouse_Name}</option>`).join('');
        }
    }).getWarehouses();

    google.script.run.withSuccessHandler(data => {
        (data || []).forEach(s => supplierMap[s.Supplier_ID] = s.Supplier_Name);
        const pPurchSupp = document.getElementById('p_purch_supplier');
        if (pPurchSupp && (!pPurchSupp.children.length || pPurchSupp.children.length <= 1)) {
            pPurchSupp.innerHTML = '<option value="">Select Supplier</option>' + 
                (data || []).map(s => `<option value="${s.Supplier_ID}">${s.Supplier_Name}</option>`).join('');
        }
    }).getData('Suppliers');

    google.script.run.withSuccessHandler(prods => {
        allProducts = prods || [];
        qp_master_products = prods || [];
        (prods || []).forEach(p => productMap[p.Product_ID] = p);
    }).getData('Products');

    renderInboundItemsTable();

    google.script.run.withSuccessHandler(purchases => {
        allPurchases = purchases || [];
        purchPage = 1;
        renderPurchasesTable();
    }).getData('Transactions_Purchase');
};

window.renderPurchasesTable = function() {
    const tbody = document.getElementById('purchaseTableBody');
    if (!tbody) return;
    if (!allPurchases.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">No purchases recorded.</td></tr>';
        return;
    }

    const filtered = purchasesHistoryFilter ? allPurchases.filter(p => {
        const q = purchasesHistoryFilter;
        const pName = (productMap[p.Product_ID]?.Product_Name || p.Product_ID || '').toLowerCase();
        const sName = (supplierMap[p.Supplier_ID] || p.Supplier_ID || '').toLowerCase();
        const pId = (p.Purchase_ID || '').toLowerCase();
        const bNo = (p.Batch_No || '').toLowerCase();
        return pName.includes(q) || sName.includes(q) || pId.includes(q) || bNo.includes(q);
    }) : allPurchases;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">No matching purchase records found.</td></tr>';
        return;
    }

    const rev = [...filtered].reverse();
    const maxPage = Math.max(1, Math.ceil(rev.length / rowsPerPage));
    if (purchPage > maxPage) purchPage = maxPage;
    if (purchPage < 1) purchPage = 1;

    const items = rev.slice((purchPage - 1) * rowsPerPage, purchPage * rowsPerPage);
    tbody.innerHTML = items.map(p => `
        <tr>
            <td>${p.Date ? String(p.Date).split('T')[0] : ''}</td>
            <td><strong>${p.Purchase_ID}</strong></td>
            <td>${supplierMap[p.Supplier_ID] || p.Supplier_ID || 'N/A'}</td>
            <td><code>${p.Product_ID}</code></td>
            <td><strong>${productMap[p.Product_ID]?.Product_Name || p.Product_ID}</strong></td>
            <td><span class="badge badge-info">${p.Batch_No || '-'}</span></td>
            <td style="text-align:center;">0</td>
            <td style="text-align:center; font-weight:700;">${p.Quantity}</td>
            <td>৳ ${formatBD(p.Unit_Price || 0)}</td>
            <td>৳ ${formatBD(p.Sale_Price || 0)}</td>
            <td>৳ ${formatBD(p.MRP_Price || 0)}</td>
            <td><strong>৳ ${formatBD(p.Total || 0)}</strong></td>
        </tr>`).join('');

    const pageInfo = document.getElementById('purchPaginationInfo');
    if (pageInfo) {
        pageInfo.textContent = `Showing ${(purchPage - 1) * rowsPerPage + 1} - ${Math.min(purchPage * rowsPerPage, rev.length)} of ${rev.length} records (Page ${purchPage} of ${maxPage})`;
    }
};

window.changePurchPage = function(dir) { purchPage += dir; renderPurchasesTable(); };

// INVENTORY STOCK LEVELS & MATRIX
let inventoryWarehouses = [];
let inventoryMatrixData = [];
let filteredInventoryMatrix = [];
let pageTrf_availableBatches = [];

window.switchInvSubTab = function(tabName) {
    const matrixArea = document.getElementById('invSubTabMatrixArea');
    const trfArea = document.getElementById('invSubTabTransfersArea');
    const btnMatrix = document.getElementById('tabBtnInvMatrix');
    const btnTrf = document.getElementById('tabBtnInvTransfers');

    if (tabName === 'transfers') {
        if (matrixArea) matrixArea.style.display = 'none';
        if (trfArea) trfArea.style.display = 'block';
        if (btnMatrix) {
            btnMatrix.classList.remove('btn-primary');
            btnMatrix.classList.add('btn-secondary');
        }
        if (btnTrf) {
            btnTrf.classList.remove('btn-secondary');
            btnTrf.classList.add('btn-primary');
        }
        initPageTransferForm();
        loadRecentTransfersList();
    } else {
        if (matrixArea) matrixArea.style.display = 'block';
        if (trfArea) trfArea.style.display = 'none';
        if (btnMatrix) {
            btnMatrix.classList.remove('btn-secondary');
            btnMatrix.classList.add('btn-primary');
        }
        if (btnTrf) {
            btnTrf.classList.remove('btn-primary');
            btnTrf.classList.add('btn-secondary');
        }
    }
};

window.loadInventoryData = function() {
    const tbody = document.getElementById('inventoryTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading live warehouse stock...</td></tr>';

    google.script.run
        .withSuccessHandler(res => {
            if (res && res.success) {
                inventoryWarehouses = res.warehouses || [];
                warehouseList = inventoryWarehouses;
                inventoryMatrixData = res.matrix || [];
                filteredInventoryMatrix = [...inventoryMatrixData];

                populateInventoryFilterDropdowns();
                renderInventoryMatrixTable();

                if (typeof loadRecentTransfersList === 'function') {
                    loadRecentTransfersList();
                }
            } else {
                if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 20px; color:#ef4444;">Failed to load warehouse stock data.</td></tr>';
            }
        })
        .withFailureHandler(err => {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 20px; color:#ef4444;">Error: ${escapeHtml((err && err.message) || 'Failed to load inventory.')}</td></tr>`;
        })
        .getInventoryMatrix();
};

function populateInventoryFilterDropdowns() {
    const catSel = document.getElementById('invFilterCategory');
    const brandSel = document.getElementById('invFilterBrand');

    if (catSel && (!catSel.children.length || catSel.children.length <= 1)) {
        const uniqueCats = Array.from(new Set(inventoryMatrixData.map(p => p.Category_Name).filter(Boolean)));
        catSel.innerHTML = '<option value="">All Categories</option>' + uniqueCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }

    if (brandSel && (!brandSel.children.length || brandSel.children.length <= 1)) {
        const uniqueBrands = Array.from(new Set(inventoryMatrixData.map(p => p.Brand_Name).filter(Boolean)));
        brandSel.innerHTML = '<option value="">All Brands</option>' + uniqueBrands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    }
}

window.renderStockCtnPcsCell = function(qty, upc, isTotal = false) {
    qty = parseFloat(qty) || 0;
    upc = parseInt(upc) || 1;
    if (qty === 0) {
        return `<span style="color:#94a3b8; font-weight:500;">0</span>`;
    }
    const ctn = Math.floor(qty / upc);
    const remPcs = Math.round(qty % upc);

    let mainLine = '';
    if (upc > 1) {
        if (ctn > 0 && remPcs > 0) {
            mainLine = `<span style="font-weight:800;">${formatBD(ctn)}</span> <span style="font-size:0.74rem; font-weight:700; color:${isTotal ? '#047857' : '#475569'};">CTN</span> <span style="color:#94a3b8;">+</span> <span style="font-weight:800;">${formatBD(remPcs)}</span> <span style="font-size:0.74rem; font-weight:700; color:${isTotal ? '#047857' : '#475569'};">pcs</span>`;
        } else if (ctn > 0) {
            mainLine = `<span style="font-weight:800;">${formatBD(ctn)}</span> <span style="font-size:0.74rem; font-weight:700; color:${isTotal ? '#047857' : '#475569'};">CTN</span>`;
        } else {
            mainLine = `<span style="font-weight:800;">${formatBD(remPcs)}</span> <span style="font-size:0.74rem; font-weight:700; color:${isTotal ? '#047857' : '#475569'};">pcs</span>`;
        }
    } else {
        mainLine = `<span style="font-weight:800;">${formatBD(qty)}</span> <span style="font-size:0.74rem; font-weight:700; color:${isTotal ? '#047857' : '#475569'};">pcs</span>`;
    }

    if (isTotal) {
        return `
            <div style="color:#059669; font-size:0.92rem; line-height:1.25;">${mainLine}</div>
            <div style="font-size:0.73rem; color:#047857; font-weight:700; margin-top:3px;">(${formatBD(qty)} pcs)</div>
        `;
    }

    return `
        <div style="color:#0f172a; font-size:0.86rem; line-height:1.25;">${mainLine}</div>
        <div style="font-size:0.73rem; color:#64748b; font-weight:600; margin-top:3px;">(${formatBD(qty)} pcs)</div>
    `;
};

window.renderInventoryMatrixTable = function() {
    const thead = document.getElementById('inventoryTableHead');
    if (thead) {
        thead.innerHTML = `<tr>
            <th style="width: 80px;">ID</th>
            <th>Product Name</th>
            ${inventoryWarehouses.map(w => `<th style="text-align:center;">${escapeHtml(w.Warehouse_Name)}<div style="font-size:0.68rem; font-weight:600; color:#64748b; text-transform:none; margin-top:2px;">CTN / PCS</div></th>`).join('')}
            <th style="text-align:center;">Total Stock<div style="font-size:0.68rem; font-weight:600; color:#047857; text-transform:none; margin-top:2px;">CTN / PCS</div></th>
            <th style="text-align:center;">Status</th>
            <th style="text-align:center; width: 100px;">Action</th>
        </tr>`;
    }

    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (!filteredInventoryMatrix.length) {
        tbody.innerHTML = `<tr><td colspan="${inventoryWarehouses.length + 5}" class="text-center" style="padding: 25px; color: #64748b;">No products found matching filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredInventoryMatrix.map(p => {
        const total = parseFloat(p.Stock) || 0;
        const upc = parseInt(p.UPC || p.upc) || 1;
        return `
        <tr>
            <td><strong style="color: #4338ca;">${escapeHtml(p.Product_ID)}</strong></td>
            <td>
                <div style="font-weight: 700; color: #0f172a;">${escapeHtml(p.Product_Name)}</div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    ${p.Category_Name ? `<span>${escapeHtml(p.Category_Name)}</span>` : ''}
                    ${p.Brand_Name ? `<span>• ${escapeHtml(p.Brand_Name)}</span>` : ''}
                    <span style="background: #eef2ff; color: #4338ca; padding: 1px 6px; border-radius: 4px; font-weight: 700;">1 CTN = ${upc} pcs</span>
                </div>
            </td>
            ${inventoryWarehouses.map(w => {
                const whStk = (p.Warehouse_Stock && p.Warehouse_Stock[w.Warehouse_ID] !== undefined) ? p.Warehouse_Stock[w.Warehouse_ID] : 0;
                return `<td style="text-align:center; vertical-align:middle; padding: 10px 8px;">
                    ${renderStockCtnPcsCell(whStk, upc, false)}
                </td>`;
            }).join('')}
            <td style="text-align:center; vertical-align:middle; padding: 10px 8px;">
                ${renderStockCtnPcsCell(total, upc, true)}
            </td>
            <td style="text-align:center; vertical-align:middle;"><span class="badge ${total <= 10 ? 'badge-low' : 'badge-ok'}">${total <= 10 ? 'Low' : 'In Stock'}</span></td>
            <td style="text-align:center; vertical-align:middle;">
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="quickTransferForProduct('${p.Product_ID}', '${escapeHtml(p.Product_Name.replace(/'/g, "\\'"))}')" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fas fa-exchange-alt"></i> Transfer
                </button>
            </td>
        </tr>`;
    }).join('');
};

window.handleInventoryFilters = function() {
    const q = (document.getElementById('invSearchName')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('invFilterCategory')?.value || '';
    const brand = document.getElementById('invFilterBrand')?.value || '';

    filteredInventoryMatrix = inventoryMatrixData.filter(p => {
        const matchesQ = !q || p.Product_Name.toLowerCase().includes(q) || p.Product_ID.toLowerCase().includes(q);
        const matchesCat = !cat || p.Category_Name === cat || p.Category_ID === cat;
        const matchesBrand = !brand || p.Brand_Name === brand || p.Brand_ID === brand;
        return matchesQ && matchesCat && matchesBrand;
    });

    renderInventoryMatrixTable();
};

window.resetInvFilters = function() {
    const inp = document.getElementById('invSearchName');
    if (inp) inp.value = '';
    const cat = document.getElementById('invFilterCategory');
    if (cat) cat.value = '';
    const brand = document.getElementById('invFilterBrand');
    if (brand) brand.value = '';
    handleInventoryFilters();
};

// QUICK TRANSFER ACTION FOR TABLE ROWS
window.quickTransferForProduct = function(productId, productName) {
    openTransferModal(productId, productName);
};

// STOCK TRANSFER MODAL LOGIC
window.openTransferModal = function(preselectProdId = null, preselectProdName = null) {
    const s = document.getElementById('trf_source');
    const d = document.getElementById('trf_dest');

    const ensureWarehouses = (cb) => {
        if (inventoryWarehouses && inventoryWarehouses.length) {
            cb(inventoryWarehouses);
        } else {
            google.script.run.withSuccessHandler(wList => {
                inventoryWarehouses = wList || [];
                warehouseList = inventoryWarehouses;
                cb(inventoryWarehouses);
            }).getWarehouses();
        }
    };

    ensureWarehouses(whs => {
        const opts = '<option value="">Select Warehouse</option>' + (whs || []).map(w => `<option value="${w.Warehouse_ID}">${escapeHtml(w.Warehouse_Name)}</option>`).join('');
        if (s) s.innerHTML = opts;
        if (d) d.innerHTML = opts;

        // Reset inputs
        const searchInp = document.getElementById('trf_search_input');
        if (searchInp) {
            searchInp.value = '';
            searchInp.disabled = true;
            searchInp.placeholder = "Select Source warehouse first...";
        }
        const availInp = document.getElementById('trf_available');
        if (availInp) availInp.value = '';
        const qtyInp = document.getElementById('trf_qty');
        if (qtyInp) qtyInp.value = '';
        const noteInp = document.getElementById('trf_note');
        if (noteInp) noteInp.value = '';
        const idInp = document.getElementById('trf_selected_id');
        if (idInp) idInp.value = '';
        const batchInp = document.getElementById('trf_selected_batch');
        if (batchInp) batchInp.value = '';
        const dd = document.getElementById('trf_dropdown');
        if (dd) dd.style.display = 'none';

        // If preselected product is requested, pick warehouse where product has stock
        if (preselectProdId) {
            const prodRow = inventoryMatrixData.find(p => p.Product_ID === preselectProdId);
            if (prodRow && prodRow.Warehouse_Stock) {
                // Find warehouse with highest stock
                let bestWh = '';
                let maxStock = 0;
                for (const [wId, stk] of Object.entries(prodRow.Warehouse_Stock)) {
                    if (stk > maxStock) {
                        maxStock = stk;
                        bestWh = wId;
                    }
                }
                if (bestWh && s) {
                    s.value = bestWh;
                    onTrfSourceChange(() => {
                        trf_selectProductById(preselectProdId);
                    });
                }
            }
        }

        const m = document.getElementById('transferModal');
        if (m) m.style.display = 'flex';
    });
};

window.onTrfSourceChange = function(onLoadedCallback) {
    const src = document.getElementById('trf_source')?.value;
    const inp = document.getElementById('trf_search_input');
    const avail = document.getElementById('trf_available');
    const idInp = document.getElementById('trf_selected_id');
    const batchInp = document.getElementById('trf_selected_batch');
    const dd = document.getElementById('trf_dropdown');

    if (idInp) idInp.value = '';
    if (batchInp) batchInp.value = '';
    if (avail) avail.value = '';
    if (dd) dd.style.display = 'none';

    if (!src) {
        if (inp) {
            inp.value = '';
            inp.disabled = true;
            inp.placeholder = "Select Source warehouse first...";
        }
        return;
    }

    if (inp) {
        inp.disabled = true;
        inp.value = '';
        inp.placeholder = "Loading warehouse inventory...";
    }

    google.script.run
        .withSuccessHandler(data => {
            trf_availableBatches = (data || []).filter(b => (parseFloat(b.stock) || 0) > 0);
            if (inp) {
                inp.disabled = false;
                inp.placeholder = trf_availableBatches.length ? "Click or type to search products..." : "No available stock in this warehouse";
            }
            if (typeof onLoadedCallback === 'function') onLoadedCallback();
        })
        .withFailureHandler(() => {
            if (inp) {
                inp.disabled = false;
                inp.placeholder = "Failed to load products";
            }
        })
        .getBatchesForSale(src);
};

window.trf_showAllProducts = function() {
    trf_filterProducts(document.getElementById('trf_search_input')?.value || '');
};

window.trf_filterProducts = function(val) {
    const dd = document.getElementById('trf_dropdown');
    if (!dd) return;
    const q = (val || '').toLowerCase().trim();
    const matches = (trf_availableBatches || []).filter(b => !q || b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || (b.batch && b.batch.toLowerCase().includes(q)));

    if (matches.length) {
        dd.innerHTML = matches.map(b => `
            <div onclick="trf_selectProductById('${escapeHtml(b.id)}', '${escapeHtml(b.batch || '')}')" style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div>
                    <strong style="color: #0f172a; font-size: 0.85rem;">${escapeHtml(b.name)}</strong>
                    <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(b.id)} ${b.batch ? '| Batch: ' + escapeHtml(b.batch) : ''}</div>
                </div>
                <span style="background: #ecfdf5; color: #059669; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem;">
                    Stock: ${formatBD(b.stock)}
                </span>
            </div>`).join('');
        dd.style.display = 'block';
    } else {
        dd.innerHTML = `<div style="padding: 12px; color: #94a3b8; text-align: center; font-size: 0.82rem;">No stocked products found matching "${escapeHtml(val)}"</div>`;
        dd.style.display = 'block';
    }
};

window.trf_selectProductById = function(productId, batchNo = '') {
    const item = (trf_availableBatches || []).find(b => b.id === productId && (!batchNo || b.batch === batchNo)) || (trf_availableBatches || []).find(b => b.id === productId);
    if (!item) return;

    const inp = document.getElementById('trf_search_input');
    if (inp) inp.value = item.name;
    const idInp = document.getElementById('trf_selected_id');
    if (idInp) idInp.value = item.id;
    const batchInp = document.getElementById('trf_selected_batch');
    if (batchInp) batchInp.value = item.batch || 'BT-STOCK';
    const avail = document.getElementById('trf_available');
    if (avail) avail.value = item.stock;
    const qtyInp = document.getElementById('trf_qty');
    if (qtyInp) {
        qtyInp.max = item.stock;
        qtyInp.value = '';
        qtyInp.focus();
    }
    const dd = document.getElementById('trf_dropdown');
    if (dd) dd.style.display = 'none';
};

let isTransferProcessing = false;

window.executeTransfer = function() {
    if (isTransferProcessing) return;

    const src = document.getElementById('trf_source')?.value;
    const dst = document.getElementById('trf_dest')?.value;
    const productId = document.getElementById('trf_selected_id')?.value;
    const batchNo = document.getElementById('trf_selected_batch')?.value || 'BT-STOCK';
    const qtyVal = parseFloat(document.getElementById('trf_qty')?.value) || 0;
    const available = parseFloat(document.getElementById('trf_available')?.value) || 0;
    const note = document.getElementById('trf_note')?.value || '';

    if (!src) return showAlertModal("Validation", "Please select a Source Warehouse.");
    if (!dst) return showAlertModal("Validation", "Please select a Destination Warehouse.");
    if (src === dst) return showAlertModal("Validation", "Source and Destination warehouse cannot be the same.");
    if (!productId) return showAlertModal("Validation", "Please select a product from the list.");
    if (qtyVal <= 0) return showAlertModal("Validation", "Please enter a valid transfer quantity greater than 0.");
    if (qtyVal > available) return showAlertModal("Insufficient Stock", `You cannot transfer ${formatBD(qtyVal)} pcs. Available stock in source warehouse is only ${formatBD(available)} pcs.`);

    const btn = document.getElementById('btnExecuteTransferModal');
    const origHtml = btn ? btn.innerHTML : '<i class="fas fa-exchange-alt"></i> Complete Transfer';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transferring...';
    }

    const payload = {
        sourceWh: src,
        destWh: dst,
        productId: productId,
        batchNo: batchNo,
        qty: qtyVal,
        note: note
    };

    isTransferProcessing = true;
    google.script.run
        .withSuccessHandler(res => {
            isTransferProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (res && res.success) {
                closeModal('transferModal');
                
                // Immediately refresh both matrix and history
                loadInventoryData();
                loadRecentTransfersList();
                if (typeof loadWarehouseInfoData === 'function') loadWarehouseInfoData();

                showAlertModal("Stock Transfer Completed", 
                    `Successfully transferred ${formatBD(qtyVal)} units!\n\n` +
                    `• Reference: ${res.refId}\n` +
                    `• Route: ${src} → ${dst}\n\n` +
                    `Stock balances across both warehouses have been updated.`
                );
            } else {
                showAlertModal("Error", (res && res.error) || "Stock transfer failed.");
            }
        })
        .withFailureHandler(err => {
            isTransferProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Stock transfer failed.");
        })
        .processStockTransfer(payload);
};

// IN-PAGE TRANSFER FORM LOGIC (FOR THE TRANSFERS TAB)
function initPageTransferForm() {
    const s = document.getElementById('page_trf_source');
    const d = document.getElementById('page_trf_dest');
    if (!s || !d) return;

    const opts = '<option value="">Select Warehouse</option>' + (inventoryWarehouses || []).map(w => `<option value="${w.Warehouse_ID}">${escapeHtml(w.Warehouse_Name)}</option>`).join('');
    if (!s.children.length || s.children.length <= 1) s.innerHTML = opts;
    if (!d.children.length || d.children.length <= 1) d.innerHTML = opts;
}

window.onPageTrfSourceChange = function() {
    const src = document.getElementById('page_trf_source')?.value;
    const inp = document.getElementById('page_trf_search_input');
    const avail = document.getElementById('page_trf_available');
    const idInp = document.getElementById('page_trf_product_id');
    const batchInp = document.getElementById('page_trf_batch_no');
    const dd = document.getElementById('page_trf_dropdown');

    if (idInp) idInp.value = '';
    if (batchInp) batchInp.value = '';
    if (avail) avail.value = '';
    if (dd) dd.style.display = 'none';

    if (!src) {
        if (inp) {
            inp.value = '';
            inp.disabled = true;
            inp.placeholder = "Select source warehouse first...";
        }
        return;
    }

    if (inp) {
        inp.disabled = true;
        inp.value = '';
        inp.placeholder = "Loading inventory...";
    }

    google.script.run
        .withSuccessHandler(data => {
            pageTrf_availableBatches = (data || []).filter(b => (parseFloat(b.stock) || 0) > 0);
            if (inp) {
                inp.disabled = false;
                inp.placeholder = pageTrf_availableBatches.length ? "Click or type to search products..." : "No available stock in this warehouse";
            }
        })
        .withFailureHandler(() => {
            if (inp) {
                inp.disabled = false;
                inp.placeholder = "Failed to load products";
            }
        })
        .getBatchesForSale(src);
};

window.pageTrfShowDropdown = function() {
    pageTrfFilterProducts(document.getElementById('page_trf_search_input')?.value || '');
};

window.pageTrfFilterProducts = function(val) {
    const dd = document.getElementById('page_trf_dropdown');
    if (!dd) return;
    const q = (val || '').toLowerCase().trim();
    const matches = (pageTrf_availableBatches || []).filter(b => !q || b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || (b.batch && b.batch.toLowerCase().includes(q)));

    if (matches.length) {
        dd.innerHTML = matches.map(b => `
            <div onclick="pageTrfSelectProductById('${escapeHtml(b.id)}', '${escapeHtml(b.batch || '')}')" style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div>
                    <strong style="color: #0f172a; font-size: 0.85rem;">${escapeHtml(b.name)}</strong>
                    <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(b.id)} ${b.batch ? '| Batch: ' + escapeHtml(b.batch) : ''}</div>
                </div>
                <span style="background: #ecfdf5; color: #059669; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem;">
                    Stock: ${formatBD(b.stock)}
                </span>
            </div>`).join('');
        dd.style.display = 'block';
    } else {
        dd.innerHTML = `<div style="padding: 12px; color: #94a3b8; text-align: center; font-size: 0.82rem;">No stocked products found matching "${escapeHtml(val)}"</div>`;
        dd.style.display = 'block';
    }
};

window.pageTrfSelectProductById = function(productId, batchNo = '') {
    const item = (pageTrf_availableBatches || []).find(b => b.id === productId && (!batchNo || b.batch === batchNo)) || (pageTrf_availableBatches || []).find(b => b.id === productId);
    if (!item) return;

    const inp = document.getElementById('page_trf_search_input');
    if (inp) inp.value = item.name;
    const idInp = document.getElementById('page_trf_product_id');
    if (idInp) idInp.value = item.id;
    const batchInp = document.getElementById('page_trf_batch_no');
    if (batchInp) batchInp.value = item.batch || 'BT-STOCK';
    const avail = document.getElementById('page_trf_available');
    if (avail) avail.value = item.stock;
    const qtyInp = document.getElementById('page_trf_qty');
    if (qtyInp) {
        qtyInp.max = item.stock;
        qtyInp.value = '';
        qtyInp.focus();
    }
    const dd = document.getElementById('page_trf_dropdown');
    if (dd) dd.style.display = 'none';
};

window.executePageTransfer = function() {
    const src = document.getElementById('page_trf_source')?.value;
    const dst = document.getElementById('page_trf_dest')?.value;
    const productId = document.getElementById('page_trf_product_id')?.value;
    const batchNo = document.getElementById('page_trf_batch_no')?.value || 'BT-STOCK';
    const qtyVal = parseFloat(document.getElementById('page_trf_qty')?.value) || 0;
    const available = parseFloat(document.getElementById('page_trf_available')?.value) || 0;
    const note = document.getElementById('page_trf_note')?.value || '';

    if (!src) return showAlertModal("Validation", "Please select a Source Warehouse.");
    if (!dst) return showAlertModal("Validation", "Please select a Destination Warehouse.");
    if (src === dst) return showAlertModal("Validation", "Source and Destination warehouse cannot be the same.");
    if (!productId) return showAlertModal("Validation", "Please select a product from the dropdown.");
    if (qtyVal <= 0) return showAlertModal("Validation", "Please enter a valid transfer quantity greater than 0.");
    if (qtyVal > available) return showAlertModal("Insufficient Stock", `You cannot transfer ${formatBD(qtyVal)} pcs. Available stock in source warehouse is only ${formatBD(available)} pcs.`);

    const btn = document.getElementById('btnPageExecuteTransfer');
    const origHtml = btn ? btn.innerHTML : '<i class="fas fa-check-circle"></i> Execute Stock Transfer';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Transfer...';
    }

    const payload = {
        sourceWh: src,
        destWh: dst,
        productId: productId,
        batchNo: batchNo,
        qty: qtyVal,
        note: note
    };

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (res && res.success) {
                // Clear input fields
                const searchInp = document.getElementById('page_trf_search_input');
                if (searchInp) searchInp.value = '';
                const idInp = document.getElementById('page_trf_product_id');
                if (idInp) idInp.value = '';
                const availInp = document.getElementById('page_trf_available');
                if (availInp) availInp.value = '';
                const qtyInp = document.getElementById('page_trf_qty');
                if (qtyInp) qtyInp.value = '';
                const noteInp = document.getElementById('page_trf_note');
                if (noteInp) noteInp.value = '';

                // Show success banner
                const banner = document.getElementById('invTrfBannerMsg');
                if (banner) {
                    banner.style.display = 'block';
                    banner.innerHTML = `
                        <div style="background: #ecfdf5; border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px; color: #065f46; font-weight: 600; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; font-size: 0.85rem;">
                                    <i class="fas fa-check"></i>
                                </span>
                                <div>
                                    <div style="font-weight: 800; font-size: 0.95rem; color: #065f46;">Stock Transfer Completed Successfully!</div>
                                    <div style="font-size: 0.82rem; color: #047857; margin-top: 2px;">
                                        Transferred <strong>${formatBD(qtyVal)} units</strong> from <strong>${src}</strong> to <strong>${dst}</strong> (Ref: <strong>${res.refId}</strong>).
                                    </div>
                                </div>
                            </div>
                            <span style="font-size: 0.78rem; background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                                Verified in Ledger
                            </span>
                        </div>`;
                }

                // Immediately refresh both the Matrix data, the History table, and the available batch cache
                loadInventoryData();
                loadRecentTransfersList();
                onPageTrfSourceChange();
                if (typeof loadWarehouseInfoData === 'function') loadWarehouseInfoData();

                showAlertModal("Transfer Completed", `Stock transfer ${res.refId} of ${formatBD(qtyVal)} units completed successfully!`);
            } else {
                showAlertModal("Error", (res && res.error) || "Stock transfer failed.");
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Stock transfer failed.");
        })
        .processStockTransfer(payload);
};

// TRANSFER HISTORY LIST
window.loadRecentTransfersList = function() {
    const tbody = document.getElementById('transferHistoryTableBody');
    if (!tbody) return;

    google.script.run
        .withSuccessHandler(res => {
            const list = (res && res.transfers) || [];
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 24px; color: #64748b;">No stock transfers recorded yet.</td></tr>';
                return;
            }

            tbody.innerHTML = list.map(t => {
                const dt = t.date ? new Date(t.date) : null;
                const formattedDate = (dt && !isNaN(dt.getTime())) ? `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '-';
                return `
                <tr>
                    <td><strong style="color: #4338ca;">${escapeHtml(t.refId)}</strong></td>
                    <td style="font-size: 0.8rem; color: #475569;">${formattedDate}</td>
                    <td><strong>${escapeHtml(t.productName)}</strong></td>
                    <td><span style="font-size: 0.78rem; color: #64748b;">${escapeHtml(t.batchNo || '-')}</span></td>
                    <td style="text-align: center; font-weight: 800; color: #2563eb;">${formatBD(t.quantity)}</td>
                    <td><span style="font-weight: 700; color: #0f172a;">${escapeHtml(t.sourceWhName || t.sourceWhId || '-')}</span></td>
                    <td><span style="font-weight: 700; color: #10b981;">${escapeHtml(t.destWhName || t.destWhId || '-')}</span></td>
                    <td style="font-size: 0.78rem; color: #64748b;">${escapeHtml(t.note || '-')}</td>
                    <td style="text-align: center;">
                        <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-size: 0.75rem;">
                            <i class="fas fa-check"></i> Completed
                        </span>
                    </td>
                </tr>`;
            }).join('');
        })
        .withFailureHandler(() => {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 24px; color: #ef4444;">Failed to load transfer history.</td></tr>';
        })
        .getTransferHistory();
};

// CUSTOMERS
let currentCustomerTypeFilter = '';

window.filterCustomersByType = function(typeName) {
    if (currentCustomerTypeFilter === typeName) {
        currentCustomerTypeFilter = ''; // toggle off
    } else {
        currentCustomerTypeFilter = typeName || '';
    }
    renderCustomerTypeDueCards();
    handleCustomerSearch();
};

window.renderCustomerTypeDueCards = function() {
    const container = document.getElementById('customerTypeDuesCardsContainer');
    if (!container) return;

    const typeDues = {};
    const typeCounts = {};

    allCustomers.forEach(c => {
        const cType = (c.Customer_Type || c.customer_type || 'Retail').trim();
        const due = parseFloat(c.Current_Due !== undefined ? c.Current_Due : c.current_due) || 0;
        typeDues[cType] = (typeDues[cType] || 0) + due;
        typeCounts[cType] = (typeCounts[cType] || 0) + 1;
    });

    const typeConfig = {
        'Retail': { color: '#0284c7', bg: '#f0f9ff', icon: 'fas fa-store' },
        'Wholesale': { color: '#9333ea', bg: '#faf5ff', icon: 'fas fa-boxes' },
        'Corporate': { color: '#d97706', bg: '#fffbeb', icon: 'fas fa-building' },
        'Distributor': { color: '#059669', bg: '#ecfdf5', icon: 'fas fa-truck' },
        'Dealer': { color: '#4f46e5', bg: '#eef2ff', icon: 'fas fa-handshake' }
    };

    const types = Object.keys(typeDues).sort((a, b) => (typeDues[b] || 0) - (typeDues[a] || 0));

    if (!types.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = types.map(t => {
        const conf = typeConfig[t] || { color: '#0d9488', bg: '#f0fdfa', icon: 'fas fa-tag' };
        const due = typeDues[t] || 0;
        const count = typeCounts[t] || 0;
        const isActive = currentCustomerTypeFilter && currentCustomerTypeFilter.toLowerCase() === t.toLowerCase();

        return `
        <div class="stat-card" onclick="filterCustomersByType('${escapeHtml(t)}')" title="Click to filter by ${escapeHtml(t)}" style="border-left: 4px solid ${conf.color}; background: white; padding: 18px 20px; border-radius: 12px; box-shadow: ${isActive ? '0 0 0 2px ' + conf.color : '0 1px 3px rgba(0,0,0,0.05)'}; cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="color:#64748b; font-weight:700; font-size: 0.82rem; display: flex; align-items: center; gap: 6px;">
                    <i class="${conf.icon}" style="color: ${conf.color};"></i> ${escapeHtml(t)} Due
                </div>
                <span style="font-size: 0.72rem; font-weight: 700; background: ${conf.bg}; color: ${conf.color}; padding: 2px 8px; border-radius: 9999px;">
                    ${count} ${count === 1 ? 'client' : 'clients'}
                </span>
            </div>
            <div class="stat-value" style="font-size: 1.55rem; font-weight: 800; color: ${due > 0 ? conf.color : '#10b981'}; margin-top: 6px;">
                ৳ ${formatBD(due)}
            </div>
        </div>`;
    }).join('');
};

window.loadCustomerData = function() {
    google.script.run.withSuccessHandler(custs => {
        allCustomers = custs || [];
        filteredCustomers = [...allCustomers];
        let totalDue = allCustomers.reduce((acc, c) => acc + (parseFloat(c.Current_Due) || 0), 0);
        document.getElementById('totalCustomersCount').textContent = allCustomers.length;
        document.getElementById('totalOutstandingDues').textContent = '৳ ' + formatBD(totalDue);
        renderCustomerTypeDueCards();
        renderCustomerTable();
    }).getData('Customers');
};

window.handleCustomerSearch = function() {
    const q = (document.getElementById('customerSearchInput')?.value || '').toLowerCase().trim();
    filteredCustomers = allCustomers.filter(c => {
        const cType = (c.Customer_Type || c.customer_type || 'Retail').trim();
        const matchesType = !currentCustomerTypeFilter || cType.toLowerCase() === currentCustomerTypeFilter.toLowerCase();
        const matchesQ = !q || 
            (c.Customer_Name || '').toLowerCase().includes(q) || 
            (c.Phone && String(c.Phone).toLowerCase().includes(q)) ||
            (c.Address && String(c.Address).toLowerCase().includes(q)) ||
            (cType.toLowerCase().includes(q));

        return matchesType && matchesQ;
    });
    renderCustomerTable();
};

window.renderCustomerTable = function() {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    if (!filteredCustomers.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 24px; color: #94a3b8;">No customers found.</td></tr>';
        return;
    }
    const typeBadgeStyles = {
        'Retail': 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;',
        'Wholesale': 'background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff;',
        'Corporate': 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;',
        'Distributor': 'background: #d1fae5; color: #047857; border: 1px solid #a7f3d0;',
        'Dealer': 'background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe;'
    };
    tbody.innerHTML = filteredCustomers.map(c => {
        const custType = c.Customer_Type || c.customer_type || 'Retail';
        const badgeStyle = typeBadgeStyles[custType] || 'background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;';
        return `
        <tr>
            <td><strong>${escapeHtml(c.Customer_ID)}</strong></td>
            <td><strong>${escapeHtml(c.Customer_Name)}</strong></td>
            <td><span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; ${badgeStyle}">${escapeHtml(custType)}</span></td>
            <td>${escapeHtml(c.Phone || 'N/A')}</td>
            <td>${escapeHtml(c.Address || 'N/A')}</td>
            <td style="color:${(parseFloat(c.Current_Due) || 0) > 0 ? '#ef4444' : '#10b981'}; font-weight:800;">৳ ${formatBD(c.Current_Due || 0)}</td>
            <td>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="recordCustomerPayment('${c.Customer_ID}', '${escapeHtml(c.Customer_Name)}', ${c.Current_Due || 0})" style="display:inline-flex; align-items:center; gap:4px; padding:5px 12px; font-weight:600;">
                        <i class="fas fa-hand-holding-usd"></i> Pay
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openEditCustomerModal('${c.Customer_ID}')" title="Edit Customer" style="display:inline-flex; align-items:center; gap:4px; padding:5px 10px; font-weight:600; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

window.syncCustomerTypeDropdowns = function(selectedVal) {
    const typeSelect = document.getElementById('c_type');
    if (!typeSelect) return;
    google.script.run.withSuccessHandler(types => {
        const activeTypes = (types || []).filter(t => (t.Status || t.status || 'Active') === 'Active');
        const defaultList = ['Retail', 'Wholesale', 'Corporate', 'Distributor', 'Dealer'];
        const listToUse = activeTypes.length > 0 ? activeTypes.map(t => t.Type_Name || t.type_name) : defaultList;
        
        typeSelect.innerHTML = listToUse.map(t => 
            `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
        ).join('');
        if (selectedVal && listToUse.includes(selectedVal)) {
            typeSelect.value = selectedVal;
        } else if (listToUse.includes('Retail')) {
            typeSelect.value = 'Retail';
        }
    }).getData('Settings_Customer_Types');
};

window.openCustomerModal = function() {
    const form = document.getElementById('customerForm');
    if (form) form.reset();
    const idEl = document.getElementById('c_id');
    if (idEl) idEl.value = '';
    const titleEl = document.getElementById('customerModalTitle');
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-user-plus"></i> Add New Customer';
    const btnTextEl = document.getElementById('btnSaveCustomerText');
    if (btnTextEl) btnTextEl.textContent = 'Save Customer';
    const dueLabel = document.getElementById('c_due_label');
    if (dueLabel) dueLabel.textContent = 'Opening Due (৳)';
    const dueInp = document.getElementById('c_due');
    if (dueInp) {
        dueInp.value = '0';
        dueInp.disabled = false;
    }
    const statusSelect = document.getElementById('c_status');
    if (statusSelect) statusSelect.value = 'Active';
    syncCustomerTypeDropdowns('Retail');
    const modal = document.getElementById('customerModal');
    if (modal) modal.style.display = 'flex';
};

window.openEditCustomerModal = function(custId) {
    const cust = (allCustomers || []).find(c => String(c.Customer_ID).trim() === String(custId).trim());
    if (!cust) return showAlertModal("Not Found", "Customer record not found.");

    const idEl = document.getElementById('c_id');
    if (idEl) idEl.value = cust.Customer_ID;

    const titleEl = document.getElementById('customerModalTitle');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-user-edit"></i> Edit Customer (${escapeHtml(cust.Customer_ID)})`;

    const btnTextEl = document.getElementById('btnSaveCustomerText');
    if (btnTextEl) btnTextEl.textContent = 'Update Customer';

    const nameEl = document.getElementById('c_name');
    if (nameEl) nameEl.value = cust.Customer_Name || '';

    const phoneEl = document.getElementById('c_phone');
    if (phoneEl) phoneEl.value = cust.Phone || '';

    const addrEl = document.getElementById('c_address');
    if (addrEl) addrEl.value = cust.Address || '';

    const dueLabel = document.getElementById('c_due_label');
    if (dueLabel) dueLabel.textContent = 'Current Due (৳)';

    const dueInp = document.getElementById('c_due');
    if (dueInp) {
        dueInp.value = cust.Current_Due !== undefined ? cust.Current_Due : (cust.Opening_Due || 0);
    }

    const statusSelect = document.getElementById('c_status');
    if (statusSelect) statusSelect.value = cust.Status || cust.status || 'Active';

    syncCustomerTypeDropdowns(cust.Customer_Type || cust.customer_type || 'Retail');

    const modal = document.getElementById('customerModal');
    if (modal) modal.style.display = 'flex';
};

window.saveCustomer = function() {
    const custId = document.getElementById('c_id')?.value?.trim();
    const name = document.getElementById('c_name')?.value?.trim();
    if (!name) return showAlertModal("Validation", "Customer Name is required.");
    const customerType = document.getElementById('c_type')?.value || 'Retail';
    const phone = document.getElementById('c_phone')?.value?.trim() || '';
    const address = document.getElementById('c_address')?.value?.trim() || '';
    const due = parseFloat(document.getElementById('c_due')?.value) || 0;
    const status = document.getElementById('c_status')?.value || 'Active';

    const isEdit = Boolean(custId);
    const data = {
        Customer_ID: isEdit ? custId : 'AUTO',
        Customer_Name: name,
        Customer_Type: customerType,
        Phone: phone,
        Address: address,
        Current_Due: due,
        Status: status
    };
    if (!isEdit) {
        data.Opening_Due = due;
    }

    google.script.run
        .withSuccessHandler((res) => {
            closeModal('customerModal');
            loadCustomerData();
            if (res && res.warning) {
                showAlertModal(isEdit ? "Customer Updated" : "Customer Added", res.warning);
            } else {
                showAlertModal("Success", isEdit ? "Customer updated successfully!" : "Customer added successfully!");
            }
        })
        .withFailureHandler((err) => {
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to save customer.");
        })
        .writeData('Customers', data);
};

let currentCustomerInvoices = [];

window.recordCustomerPayment = function(id, name, due) {
    const custIdEl = document.getElementById('pay_cust_id');
    if (custIdEl) custIdEl.value = id;
    const custNameEl = document.getElementById('pay_cust_name');
    if (custNameEl) custNameEl.textContent = name;
    const custDueEl = document.getElementById('pay_cust_due');
    if (custDueEl) custDueEl.textContent = '৳ ' + formatBD(due);

    // Set today's date
    const dateEl = document.getElementById('pay_date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    const memoEl = document.getElementById('pay_memo_no');
    if (memoEl) memoEl.value = '';

    const amtEl = document.getElementById('pay_amount');
    if (amtEl) amtEl.value = '0.00';

    const noteEl = document.getElementById('pay_note');
    if (noteEl) noteEl.value = '';

    const modeEl = document.getElementById('pay_mode');
    if (modeEl) modeEl.value = 'Cash';

    // Populate Categories in Category dropdown
    const catEl = document.getElementById('pay_category');
    if (catEl) {
        catEl.innerHTML = '<option value="All / General">All / General</option>';
        google.script.run.withSuccessHandler(categories => {
            if (categories && categories.length) {
                categories.forEach(c => {
                    const cName = c.Category_Name || c.category_name;
                    if (cName) {
                        const opt = document.createElement('option');
                        opt.value = cName;
                        opt.textContent = cName;
                        catEl.appendChild(opt);
                    }
                });
            }
        }).getData('Categories');
    }

    // Populate Banks in Bank dropdown
    const bankEl = document.getElementById('pay_bank');
    if (bankEl) {
        bankEl.innerHTML = '<option value="">-- Select Bank (Optional) --</option>';
        google.script.run.withSuccessHandler(banks => {
            if (banks && banks.length) {
                banks.forEach(b => {
                    const bName = b.Bank_Name || b.bank_name;
                    if (bName) {
                        const opt = document.createElement('option');
                        opt.value = bName;
                        opt.textContent = bName;
                        bankEl.appendChild(opt);
                    }
                });
            }
        }).getData('Settings_Banks');
    }

    // Populate Specific Invoices for this customer
    const invSelect = document.getElementById('pay_invoice');
    if (invSelect) {
        invSelect.innerHTML = '<option value="">-- Bulk Payment / Advance --</option>';
    }
    currentCustomerInvoices = [];
    google.script.run.withSuccessHandler(invoices => {
        currentCustomerInvoices = invoices || [];
        if (invSelect && currentCustomerInvoices.length > 0) {
            currentCustomerInvoices.forEach(inv => {
                const opt = document.createElement('option');
                opt.value = inv.invoiceNo;
                opt.textContent = `${inv.invoiceNo} (Due: ৳ ${formatBD(inv.due)}${inv.memoNo ? ', Memo: ' + inv.memoNo : ''})`;
                invSelect.appendChild(opt);
            });
        }
    }).getCustomerPendingInvoices(id);

    const modal = document.getElementById('paymentModal');
    if (modal) modal.style.display = 'flex';
};

window.onPaymentInvoiceSelect = function(invNo) {
    const amtEl = document.getElementById('pay_amount');
    const memoEl = document.getElementById('pay_memo_no');
    if (!invNo) {
        if (amtEl) amtEl.value = '0.00';
        return;
    }
    const inv = currentCustomerInvoices.find(i => String(i.invoiceNo).trim() === String(invNo).trim());
    if (inv) {
        if (amtEl) amtEl.value = (parseFloat(inv.due) || 0).toFixed(2);
        if (memoEl && inv.memoNo) memoEl.value = inv.memoNo;
    }
};

window.onPaymentModeSelect = function(mode) {
    const bankSelect = document.getElementById('pay_bank');
    if (mode === 'Bank' || mode === 'Cheque') {
        if (bankSelect && !bankSelect.value) {
            bankSelect.focus();
        }
    }
};

let isPaymentProcessing = false;

window.processPayment = function() {
    if (isPaymentProcessing) {
        console.warn("Payment is already being processed. Ignoring multiple clicks.");
        return;
    }

    const custId = document.getElementById('pay_cust_id')?.value || '';
    const amt = parseFloat(document.getElementById('pay_amount')?.value) || 0;
    if (!custId || amt <= 0) {
        return showAlertModal("Validation", "Please enter a valid payment amount greater than zero.");
    }

    const payBtn = document.getElementById('btnProcessPayment');
    const origHtml = payBtn ? payBtn.innerHTML : '';

    const unlockPayBtn = () => {
        isPaymentProcessing = false;
        if (payBtn) {
            payBtn.disabled = false;
            payBtn.innerHTML = origHtml || '<i class="fas fa-check"></i> Save Payment';
        }
    };

    isPaymentProcessing = true;
    if (payBtn) {
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Payment...';
    }

    const payload = {
        customerId: custId,
        amount: amt,
        paymentMode: document.getElementById('pay_mode')?.value || 'Cash',
        date: document.getElementById('pay_date')?.value || new Date().toISOString().split('T')[0],
        memoNo: document.getElementById('pay_memo_no')?.value?.trim() || '',
        invoiceNo: document.getElementById('pay_invoice')?.value || '',
        category: document.getElementById('pay_category')?.value || 'All / General',
        bankName: document.getElementById('pay_bank')?.value || '',
        narration: document.getElementById('pay_note')?.value?.trim() || ''
    };

    google.script.run
        .withSuccessHandler(res => {
            unlockPayBtn();
            if (res && res.success) {
                closeModal('paymentModal');
                loadCustomerData();
                showAlertModal("Success", "Payment recorded successfully!");
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process payment.");
            }
        })
        .withFailureHandler(err => {
            unlockPayBtn();
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to record payment.");
        })
        .addCustomerPayment(payload);
};

// SUPPLIERS
window.loadSupplierData = function() {
    google.script.run.withSuccessHandler(supps => {
        allSuppliers = supps || [];
        const tbody = document.getElementById('supplierTableBody');
        if (!tbody) return;
        if (!allSuppliers.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 20px; color: #94a3b8;">No suppliers found.</td></tr>';
            return;
        }
        tbody.innerHTML = allSuppliers.map(s => {
            const sid = s.Supplier_ID || s.supplier_id || '';
            const sname = s.Supplier_Name || s.supplier_name || '';
            const contact = s.Contact_Person || s.contact_person || '';
            const phone = s.Phone || s.phone || '';
            return `
            <tr>
                <td><strong style="color: #0f172a;">${escapeHtml(sid)}</strong></td>
                <td><strong style="color: #2563eb;">${escapeHtml(sname)}</strong></td>
                <td>${escapeHtml(contact || 'N/A')}</td>
                <td>${escapeHtml(phone || 'N/A')}</td>
                <td>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openEditSupplierModal('${escapeHtml(sid)}')" style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; font-weight: 600;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            </tr>`;
        }).join('');
    }).getData('Suppliers');
};

window.openSupplierModal = function() {
    const form = document.getElementById('supplierForm');
    if (form) form.reset();
    const idEl = document.getElementById('s_id');
    if (idEl) idEl.value = '';
    const titleEl = document.getElementById('supplierModalTitle');
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-truck-loading"></i> Add Supplier';
    const btnText = document.getElementById('btnSaveSupplierText');
    if (btnText) btnText.textContent = 'Save Supplier';
    const modal = document.getElementById('supplierModal');
    if (modal) modal.style.display = 'flex';
};

window.openEditSupplierModal = function(suppId) {
    if (!suppId) return;
    const supp = (allSuppliers || []).find(s => String(s.Supplier_ID || s.supplier_id).trim() === String(suppId).trim());
    if (!supp) return showAlertModal("Not Found", "Supplier record not found.");

    const idEl = document.getElementById('s_id');
    if (idEl) idEl.value = supp.Supplier_ID || supp.supplier_id || '';

    const nameEl = document.getElementById('s_name');
    if (nameEl) nameEl.value = supp.Supplier_Name || supp.supplier_name || '';

    const contactEl = document.getElementById('s_contact');
    if (contactEl) contactEl.value = supp.Contact_Person || supp.contact_person || '';

    const phoneEl = document.getElementById('s_phone');
    if (phoneEl) phoneEl.value = supp.Phone || supp.phone || '';

    const titleEl = document.getElementById('supplierModalTitle');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-edit"></i> Edit Supplier (${escapeHtml(supp.Supplier_ID || supp.supplier_id)})`;

    const btnText = document.getElementById('btnSaveSupplierText');
    if (btnText) btnText.textContent = 'Update Supplier';

    const modal = document.getElementById('supplierModal');
    if (modal) modal.style.display = 'flex';
};

window.saveSupplier = function() {
    const suppId = document.getElementById('s_id')?.value?.trim();
    const name = document.getElementById('s_name')?.value?.trim();
    if (!name) return showAlertModal("Validation", "Supplier Name is required.");
    const contact = document.getElementById('s_contact')?.value?.trim() || '';
    const phone = document.getElementById('s_phone')?.value?.trim() || '';

    const isEdit = Boolean(suppId);
    const data = {
        Supplier_ID: isEdit ? suppId : 'AUTO',
        Supplier_Name: name,
        Contact_Person: contact,
        Phone: phone
    };

    google.script.run
        .withSuccessHandler((res) => {
            closeModal('supplierModal');
            loadSupplierData();
            refreshMasterLists();
            if (window.loadGlobalMetadata) window.loadGlobalMetadata();
            showAlertModal("Success", isEdit ? "Supplier updated successfully!" : "Supplier added successfully!");
        })
        .withFailureHandler((err) => {
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to save supplier.");
        })
        .writeData('Suppliers', data);
};

// SALES RETURNS
window.initSalesReturnsView = function() {
    const inputEl = document.getElementById('invSearchInput');
    if (inputEl && !inputEl.value.trim()) {
        inputEl.value = 'INV-2026-0001';
    }
};

window.fetchSalesInvoiceForReturn = function() {
    const invInput = document.getElementById('invSearchInput');
    const inv = invInput?.value?.trim();
    if (!inv) return showAlertModal("Validation", "Please enter a Sales Invoice Number (e.g. INV-2026-0001).");

    const btn = document.getElementById('btnSearchSalesReturn');
    const origHtml = btn ? btn.innerHTML : '<i class="fas fa-search"></i> Search';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
    }

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (res && res.success && res.items) {
                currentReturnInvoiceData = res;
                const resultArea = document.getElementById('invoiceReturnResultArea');
                if (resultArea) resultArea.style.display = 'block';

                const custEl = document.getElementById('retDispCust');
                if (custEl) custEl.textContent = res.customerName || 'WALK-IN';

                const dateEl = document.getElementById('retDispDate');
                if (dateEl) dateEl.textContent = res.formattedDate || (res.date ? String(res.date).split('T')[0] : '-');

                const statusEl = document.getElementById('retDispStatus');
                if (statusEl) statusEl.textContent = res.status || res.paymentType || 'Completed';

                const banner = document.getElementById('salesRetBannerMsg');
                if (banner) banner.style.display = 'none';

                renderSalesReturnItems();
            } else {
                showAlertModal("Not Found", (res && res.error) || "Invoice record not found.");
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to fetch sales invoice details.");
        })
        .getInvoiceDetails(inv);
};

window.renderSalesReturnItems = function() {
    const container = document.getElementById('salesReturnItemList');
    if (!container || !currentReturnInvoiceData || !currentReturnInvoiceData.items) return;

    if (!currentReturnInvoiceData.items.length) {
        container.innerHTML = '<div style="background:white; padding:20px; text-align:center; border-radius:12px; color:#64748b;">No items found in this sales invoice.</div>';
        calculateReturnTotalRefund();
        return;
    }

    container.innerHTML = currentReturnInvoiceData.items.map((i, idx) => {
        const isCompleted = i.Remaining_Qty <= 0;
        return `
        <div style="background: #ffffff; border-radius: 12px; padding: 20px 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); gap: 18px; flex-wrap: wrap;">
            <div style="min-width: 0; flex: 1;">
                <h4 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 8px;">${escapeHtml(i.Product_Name)}</h4>
                <div style="font-size: 0.82rem; color: #475569; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    ${i.Batch_No ? `<span>Batch: <strong style="color: #0f172a;">${escapeHtml(i.Batch_No)}</strong></span><span style="color: #cbd5e1;">|</span>` : ''}
                    <span>Unit Price: <strong style="color: #0f172a;">৳${formatBD(i.Sale_Price, 2)}</strong></span>
                    <span style="color: #cbd5e1;">|</span>
                    <span>Sold Qty: <strong style="color: #2563eb; font-weight: 800;">${formatBD(i.Quantity)}</strong></span>
                    ${i.Returned_Qty > 0 ? `
                        <span style="color: #cbd5e1;">|</span>
                        <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-undo"></i> Returned: ${formatBD(i.Returned_Qty)} pcs
                        </span>
                        <span style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-size: 0.76rem;">
                            Remaining: ${formatBD(i.Remaining_Qty)} pcs
                        </span>
                    ` : ''}
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                ${isCompleted ? `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check-circle"></i> All ${formatBD(i.Returned_Qty)} pcs Returned
                        </span>
                    </div>
                ` : `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 0.74rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; white-space: nowrap;">RETURN QTY:</label>
                        <input type="number" id="ret_qty_${idx}" class="form-control" style="width: 85px; text-align: center; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 7px 10px;" value="0" min="0" max="${i.Remaining_Qty}" oninput="calculateReturnTotalRefund()">
                    </div>
                    <button type="button" class="btn btn-primary" id="btn_submit_sale_ret_${idx}" onclick="submitSingleSalesItemReturn(${idx})" style="background: #ef4444; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; color: white; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);">
                        <i class="fas fa-undo-alt"></i> Return
                    </button>
                `}
            </div>
        </div>`;
    }).join('');

    calculateReturnTotalRefund();
};

window.calculateReturnTotalRefund = function() {
    if (!currentReturnInvoiceData || !currentReturnInvoiceData.items) return;
    let tot = 0;
    currentReturnInvoiceData.items.forEach((item, idx) => {
        const q = parseFloat(document.getElementById('ret_qty_' + idx)?.value) || 0;
        tot += (q * (parseFloat(item.Sale_Price) || 0));
    });
    const refEl = document.getElementById('retTotalRefundText');
    if (refEl) refEl.textContent = '৳ ' + formatBD(tot, 2);
};

window.submitSingleSalesItemReturn = function(itemIdx) {
    if (!currentReturnInvoiceData || !currentReturnInvoiceData.items) return;
    const item = currentReturnInvoiceData.items[itemIdx];
    if (!item) return;

    const qtyInp = document.getElementById('ret_qty_' + itemIdx);
    const returnQty = parseFloat(qtyInp?.value) || 0;

    if (returnQty <= 0) {
        return showAlertModal("Validation", "Please enter a return quantity greater than 0.");
    }

    if (returnQty > item.Remaining_Qty) {
        return showAlertModal("Quantity Exceeded", `You can return at most ${formatBD(item.Remaining_Qty)} pcs for this item.`);
    }

    const btn = document.getElementById('btn_submit_sale_ret_' + itemIdx);
    const origHtml = btn ? btn.innerHTML : '<i class="fas fa-undo-alt"></i> Return';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    const payload = {
        invoiceNo: item.Invoice_No || currentReturnInvoiceData.invoiceNo,
        customerId: currentReturnInvoiceData.customerId,
        items: [{
            productId: item.Product_ID,
            productName: item.Product_Name,
            returnQty: returnQty,
            unitPrice: item.Sale_Price,
            warehouseId: item.Warehouse_ID,
            saleId: item.Sale_ID,
            batchNo: item.Batch_No,
            totalSold: item.Quantity
        }]
    };

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (res && res.success) {
                const retInfo = (res.returnedItems && res.returnedItems[0]) || {};
                const totalReturned = retInfo.totalReturnedPcs !== undefined ? retInfo.totalReturnedPcs : ((item.Returned_Qty || 0) + returnQty);
                const remPcs = retInfo.remainingPcs !== undefined ? retInfo.remainingPcs : Math.max(0, item.Quantity - totalReturned);

                item.Returned_Qty = totalReturned;
                item.Remaining_Qty = remPcs;
                item.isFullyReturned = remPcs <= 0;

                renderSalesReturnItems();

                // Show top notification banner
                const banner = document.getElementById('salesRetBannerMsg');
                if (banner) {
                    banner.style.display = 'block';
                    banner.innerHTML = `
                        <div style="background: #ecfdf5; border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; color: #065f46; font-weight: 600; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; font-size: 0.85rem;">
                                    <i class="fas fa-check"></i>
                                </span>
                                <div>
                                    <div style="font-weight: 800; font-size: 0.95rem; color: #065f46;">Sales Return Processed!</div>
                                    <div style="font-size: 0.82rem; color: #047857; margin-top: 2px;">
                                        Returned: <strong>${formatBD(returnQty)} pcs</strong> of ${escapeHtml(item.Product_Name)}. 
                                        Total Returned to Stock: <strong style="color: #065f46;">${formatBD(totalReturned)} pcs</strong> 
                                        (Remaining: <strong>${formatBD(remPcs)} pcs</strong>) | Refund: <strong>৳${formatBD(res.refund || (returnQty * item.Sale_Price), 2)}</strong>.
                                    </div>
                                </div>
                            </div>
                            <span style="font-size: 0.78rem; background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                                Stock Restocked
                            </span>
                        </div>`;
                }

                // Show Modal Alert confirmation
                showAlertModal("Sales Return Completed", 
                    `Successfully processed return of ${formatBD(returnQty)} pcs of ${item.Product_Name}!\n\n` +
                    `• Total Returned to Stock: ${formatBD(totalReturned)} pcs\n` +
                    `• Remaining Sold Qty: ${formatBD(remPcs)} pcs\n` +
                    `• Calculated Refund / Due Credit: ৳${formatBD(res.refund || (returnQty * item.Sale_Price), 2)}\n\n` +
                    `Inventory stock has been restocked and customer ledger updated.`
                );

                if (window.loadPosRecentSales) loadPosRecentSales();
                if (window.loadDashboardData) loadDashboardData();
                if (window.loadInventoryData) loadInventoryData();
                if (window.loadCustomerData) loadCustomerData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process sales return.");
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to process sales return.");
        })
        .processBulkSalesReturn(payload);
};

window.submitInvoiceSalesReturn = function() {
    if (!currentReturnInvoiceData || !currentReturnInvoiceData.items) return;
    const items = [];
    currentReturnInvoiceData.items.forEach((item, idx) => {
        const q = parseFloat(document.getElementById('ret_qty_' + idx)?.value) || 0;
        if (q > 0) {
            items.push({ 
                productId: item.Product_ID, 
                productName: item.Product_Name,
                returnQty: q, 
                unitPrice: item.Sale_Price, 
                warehouseId: item.Warehouse_ID,
                saleId: item.Sale_ID,
                batchNo: item.Batch_No,
                totalSold: item.Quantity
            });
        }
    });

    if (!items.length) {
        return showAlertModal("Validation", "Please enter return quantity for at least one item.");
    }

    const btn = document.getElementById('btnSubmitBulkSalesReturn');
    const origHtml = btn ? btn.innerHTML : '<i class="fas fa-undo-alt"></i> Process All Returns';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (res && res.success) {
                const totalReturnedPcsCount = items.reduce((sum, i) => sum + i.returnQty, 0);

                // Update items state with results
                if (res.returnedItems && res.returnedItems.length) {
                    res.returnedItems.forEach(ret => {
                        const itm = currentReturnInvoiceData.items.find(i => (ret.saleId && i.Sale_ID === ret.saleId) || i.Product_ID === ret.productId);
                        if (itm) {
                            itm.Returned_Qty = ret.totalReturnedPcs;
                            itm.Remaining_Qty = ret.remainingPcs;
                            itm.isFullyReturned = ret.remainingPcs <= 0;
                        }
                    });
                } else {
                    items.forEach(ret => {
                        const itm = currentReturnInvoiceData.items.find(i => (ret.saleId && i.Sale_ID === ret.saleId) || i.Product_ID === ret.productId);
                        if (itm) {
                            itm.Returned_Qty = (itm.Returned_Qty || 0) + ret.returnQty;
                            itm.Remaining_Qty = Math.max(0, itm.Quantity - itm.Returned_Qty);
                            itm.isFullyReturned = itm.Remaining_Qty <= 0;
                        }
                    });
                }

                renderSalesReturnItems();

                // Show top banner
                const banner = document.getElementById('salesRetBannerMsg');
                if (banner) {
                    banner.style.display = 'block';
                    banner.innerHTML = `
                        <div style="background: #ecfdf5; border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; color: #065f46; font-weight: 600; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; font-size: 0.85rem;">
                                    <i class="fas fa-check"></i>
                                </span>
                                <div>
                                    <div style="font-weight: 800; font-size: 0.95rem; color: #065f46;">Sales Return Processed Successfully!</div>
                                    <div style="font-size: 0.82rem; color: #047857; margin-top: 2px;">
                                        Total Returned: <strong>${formatBD(totalReturnedPcsCount)} pcs</strong> across ${items.length} items | Total Refund / Credit: <strong>৳${formatBD(res.refund, 2)}</strong>.
                                    </div>
                                </div>
                            </div>
                            <span style="font-size: 0.78rem; background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                                Stock Restocked
                            </span>
                        </div>`;
                }

                showAlertModal("Return Processed", 
                    `Successfully processed sales return for ${formatBD(totalReturnedPcsCount)} pcs!\n\n` +
                    `• Total Refund / Due Adjustment: ৳${formatBD(res.refund, 2)}\n` +
                    `• Product stocks have been restocked to warehouse inventory.\n` +
                    `• All returned pieces and remaining counts updated.`
                );

                if (window.loadPosRecentSales) loadPosRecentSales();
                if (window.loadDashboardData) loadDashboardData();
                if (window.loadInventoryData) loadInventoryData();
                if (window.loadCustomerData) loadCustomerData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process return.");
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to process return.");
        })
        .processBulkSalesReturn({ 
            invoiceNo: currentReturnInvoiceData.items[0].Invoice_No || currentReturnInvoiceData.invoiceNo, 
            customerId: currentReturnInvoiceData.customerId, 
            items 
        });
};

// PURCHASE RETURNS
let currentPurchaseReturnData = null;

window.initPurchaseReturnsView = function() {
    const inputEl = document.getElementById('purchRetSearchInput');
    if (inputEl && !inputEl.value.trim()) {
        inputEl.value = 'PU0002';
    }
};

window.fetchPurchaseForReturn = function() {
    const inputEl = document.getElementById('purchRetSearchInput');
    const pId = inputEl?.value?.trim();
    if (!pId) return showAlertModal("Validation", "Please enter a Purchase ID (e.g. PU0002).");

    const btn = document.getElementById('btnSearchPurchReturn');
    const origText = btn ? btn.innerHTML : '<i class="fas fa-search"></i> Search';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
    }

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
            if (res && res.success && res.data) {
                currentPurchaseReturnData = res.data;
                const resultArea = document.getElementById('purchaseReturnResultArea');
                if (resultArea) resultArea.style.display = 'block';

                const suppEl = document.getElementById('purchRetDispSupplier');
                if (suppEl) suppEl.textContent = res.data.supplierName || 'Armanitola';

                const dateEl = document.getElementById('purchRetDispDate');
                if (dateEl) dateEl.textContent = res.data.formattedDate || '8/31/2026';

                const statusEl = document.getElementById('purchRetDispStatus');
                if (statusEl) statusEl.textContent = res.data.status || 'In Stock';

                const banner = document.getElementById('purchRetBannerMsg');
                if (banner) banner.style.display = 'none';

                renderPurchaseReturnItems();
            } else {
                showAlertModal("Not Found", (res && res.error) || "Purchase ID not found.");
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to fetch purchase details.");
        })
        .getPurchaseDetailsForReturn(pId);
};

window.renderPurchaseReturnItems = function() {
    const container = document.getElementById('purchaseReturnItemList');
    if (!container || !currentPurchaseReturnData || !currentPurchaseReturnData.items) return;

    if (!currentPurchaseReturnData.items.length) {
        container.innerHTML = '<div style="background:white; padding:20px; text-align:center; border-radius:12px; color:#64748b;">No items found in this purchase order.</div>';
        return;
    }

    container.innerHTML = currentPurchaseReturnData.items.map((item, idx) => {
        const isCompleted = item.remainingQty <= 0;
        return `
        <div style="background: #ffffff; border-radius: 12px; padding: 20px 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); gap: 18px; flex-wrap: wrap;">
            <div style="min-width: 0; flex: 1;">
                <h4 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 8px;">${escapeHtml(item.productName)}</h4>
                <div style="font-size: 0.82rem; color: #475569; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span>Batch: <strong style="color: #0f172a;">${escapeHtml(item.batchNo)}</strong></span>
                    <span style="color: #cbd5e1;">|</span>
                    <span>Unit Cost: <strong style="color: #0f172a;">৳${formatBD(item.unitPrice, 2)}</strong></span>
                    <span style="color: #cbd5e1;">|</span>
                    <span>Purchased Qty: <strong style="color: #2563eb; font-weight: 800;">${formatBD(item.quantity)}</strong></span>
                    ${item.returnedQty > 0 ? `
                        <span style="color: #cbd5e1;">|</span>
                        <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-undo"></i> Returned: ${formatBD(item.returnedQty)} pcs
                        </span>
                        <span style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-size: 0.76rem;">
                            Remaining: ${formatBD(item.remainingQty)} pcs
                        </span>
                    ` : ''}
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                ${isCompleted ? `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check-circle"></i> All ${formatBD(item.returnedQty)} pcs Returned
                        </span>
                    </div>
                ` : `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 0.74rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; white-space: nowrap;">RETURN QTY:</label>
                        <input type="number" id="purch_ret_qty_${idx}" class="form-control" style="width: 85px; text-align: center; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 7px 10px;" value="0" min="0" max="${item.remainingQty}">
                    </div>
                    <button type="button" class="btn btn-primary" id="btn_submit_purch_ret_${idx}" onclick="submitSinglePurchaseItemReturn(${idx})" style="background: #3b82f6; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);">
                        <i class="fas fa-undo-alt"></i> Return
                    </button>
                `}
            </div>
        </div>`;
    }).join('');
};

window.submitSinglePurchaseItemReturn = function(itemIdx) {
    if (!currentPurchaseReturnData || !currentPurchaseReturnData.items) return;
    const item = currentPurchaseReturnData.items[itemIdx];
    if (!item) return;

    const qtyInp = document.getElementById('purch_ret_qty_' + itemIdx);
    const returnQty = parseFloat(qtyInp?.value) || 0;

    if (returnQty <= 0) {
        return showAlertModal("Validation", "Please enter a valid return quantity greater than 0.");
    }

    if (returnQty > item.remainingQty) {
        return showAlertModal("Quantity Exceeded", `You can return at most ${formatBD(item.remainingQty)} pcs for this item.`);
    }

    const btn = document.getElementById('btn_submit_purch_ret_' + itemIdx);
    const origHtml = btn ? btn.innerHTML : '<i class="fas fa-undo-alt"></i> Return';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    const payload = {
        purchaseId: item.purchaseId || currentPurchaseReturnData.purchaseId,
        productId: item.productId,
        productName: item.productName,
        batchNo: item.batchNo,
        warehouseId: item.warehouseId,
        returnQty: returnQty,
        unitPrice: item.unitPrice,
        totalPurchased: item.quantity
    };

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (res && res.success) {
                // Update local state
                item.returnedQty = res.totalReturnedPcs;
                item.remainingQty = res.remainingPcs;
                item.isFullyReturned = res.remainingPcs <= 0;

                // Re-render items to show exact updated counts
                renderPurchaseReturnItems();

                // Show prominent success notification banner
                const banner = document.getElementById('purchRetBannerMsg');
                if (banner) {
                    banner.style.display = 'block';
                    banner.innerHTML = `
                        <div style="background: #ecfdf5; border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; color: #065f46; font-weight: 600; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; font-size: 0.85rem;">
                                    <i class="fas fa-check"></i>
                                </span>
                                <div>
                                    <div style="font-weight: 800; font-size: 0.95rem; color: #065f46;">Purchase Return Successful!</div>
                                    <div style="font-size: 0.82rem; color: #047857; margin-top: 2px;">
                                        Returned: <strong>${formatBD(res.returnedQty)} pcs</strong> of ${escapeHtml(item.productName)}. 
                                        Total Returned to Supplier: <strong style="color: #065f46;">${formatBD(res.totalReturnedPcs)} pcs</strong> 
                                        (Remaining: <strong>${formatBD(res.remainingPcs)} pcs</strong>).
                                    </div>
                                </div>
                            </div>
                            <span style="font-size: 0.78rem; background: #d1fae5; color: #047857; padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                                Stock Deducted
                            </span>
                        </div>`;
                }

                // Show Modal Alert for completion confirmation
                showAlertModal("Purchase Return Completed", 
                    `Successfully returned ${formatBD(res.returnedQty)} pcs of ${item.productName} to supplier!\n\n` +
                    `• Total Returned: ${formatBD(res.totalReturnedPcs)} pcs\n` +
                    `• Remaining Stock: ${formatBD(res.remainingPcs)} pcs\n\n` +
                    `Inventory ledger has been updated and warehouse stock has been deducted.`
                );

                if (window.loadInventoryData) loadInventoryData();
                if (window.loadDashboardData) loadDashboardData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process purchase return.");
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to process purchase return.");
        })
        .processPurchaseReturn(payload);
};

// DEPOSITS & CASH SETTLEMENT
window.updateDepositDestinations = function() {
    const depType = document.getElementById('dep_type')?.value || 'Bank Deposit';
    const depDest = document.getElementById('dep_destination');
    if (!depDest) return;

    if (depType === 'Expense / Other' || depType.includes('Expense')) {
        google.script.run.withSuccessHandler(categories => {
            const activeCats = (categories || []).filter(c => (c.Status || c.status || 'Active') === 'Active');
            if (activeCats.length > 0) {
                depDest.innerHTML = activeCats.map(c => {
                    const name = c.Category_Name || c.category_name;
                    return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
                }).join('');
            } else {
                depDest.innerHTML = `
                    <option value="Shop Rent">Shop Rent</option>
                    <option value="Staff Salary">Staff Salary</option>
                    <option value="Electricity & Utilities">Electricity & Utilities</option>
                    <option value="Transport & Delivery">Transport & Delivery</option>
                    <option value="Office Stationary & Tea">Office Stationary & Tea</option>
                `;
            }
        }).getData('Settings_Expense_Categories');
    } else {
        google.script.run.withSuccessHandler(banks => {
            const activeBanks = (banks || []).filter(b => (b.Status || b.status || 'Active') === 'Active');
            if (activeBanks.length > 0) {
                depDest.innerHTML = activeBanks.map(b => {
                    const name = b.Bank_Name || b.bank_name;
                    return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
                }).join('');
            } else {
                depDest.innerHTML = `<option value="Cash / Other">Cash / Other</option>`;
            }
        }).getData('Settings_Banks');
    }
};

window.loadDepositsView = function() {
    const depDate = document.getElementById('dep_date');
    if (depDate && !depDate.value) {
        depDate.value = new Date().toISOString().split('T')[0];
    }

    google.script.run.withSuccessHandler(res => {
        if (res.success) {
            const d = res.data;
            const openEl = document.getElementById('cash_opening_val');
            if (openEl) openEl.textContent = '৳ ' + formatBD(d.openingCash);
            const handEl = document.getElementById('cash_in_hand_val');
            if (handEl) handEl.textContent = '৳ ' + formatBD(d.cashInHand);
            const collEl = document.getElementById('cash_total_collected_val');
            if (collEl) collEl.textContent = '৳ ' + formatBD(d.totalInflow);
            const bnkEl = document.getElementById('cash_total_banked_val');
            if (bnkEl) bnkEl.textContent = '৳ ' + formatBD(d.bankDeposits);
            const expEl = document.getElementById('cash_total_expenses_val');
            if (expEl) expEl.textContent = '৳ ' + formatBD(d.otherDisbursed);
        }
    }).getCashSummary();

    updateDepositDestinations();

    google.script.run.withSuccessHandler(res => {
        const tbody = document.getElementById('depositsHistoryTableBody');
        if (tbody) {
            tbody.innerHTML = (res.data || []).map(d => `
                <tr>
                    <td>${d.Date ? String(d.Date).split('T')[0] : ''}</td>
                    <td><strong>${d.Deposit_ID}</strong></td>
                    <td><span class="badge ${d.Deposit_Type.includes('Expense') ? 'badge-warning' : 'badge-success'}">${d.Deposit_Type}</span></td>
                    <td><strong>${escapeHtml(d.Destination)}</strong></td>
                    <td>${d.Slip_No || '-'}</td>
                    <td><strong>৳ ${formatBD(d.Amount)}</strong></td>
                    <td>${escapeHtml(d.Note || '')}</td>
                    <td>${d.Created_By || ''}</td>
                    <td style="text-align:center;"><button class="btn-icon btn-delete" onclick="google.script.run.withSuccessHandler(loadDepositsView).deleteDeposit('${d.Deposit_ID}')"><i class="fas fa-trash"></i></button></td>
                </tr>`).join('');
        }
    }).getDepositsData();
};

window.submitDepositEntry = function() {
    const payload = {
        date: document.getElementById('dep_date')?.value || new Date().toISOString().split('T')[0],
        depositType: document.getElementById('dep_type')?.value || 'Bank Deposit',
        destination: document.getElementById('dep_destination')?.value || '',
        slipNo: document.getElementById('dep_slip_no')?.value || '',
        amount: parseFloat(document.getElementById('dep_amount')?.value) || 0,
        note: document.getElementById('dep_note')?.value || ''
    };
    google.script.run.withSuccessHandler(res => {
        if (res.success) {
            showAlertModal("Saved", `Deposit recorded.`);
            loadDepositsView();
        } else showAlertModal("Error", res.error);
    }).saveDeposit(payload);
};

// REPORTS
window.onReportTypeChange = function() {
    const header = document.getElementById('reportHeader');
    const content = document.getElementById('reportContent');
    const countEl = document.getElementById('rpt_count');
    const totalEl = document.getElementById('rpt_total');
    const periodEl = document.getElementById('rpt_period');

    if (header) header.innerHTML = '';
    if (content) {
        content.innerHTML = '<tr><td colspan="12" class="text-center" style="padding: 36px 20px; color: #64748b; font-size: 0.92rem;"><i class="fas fa-filter" style="margin-right: 8px; color: #3b82f6;"></i> Filters changed. Click <strong>Generate</strong> to generate this report.</td></tr>';
    }
    if (countEl) countEl.textContent = '0';
    if (totalEl) totalEl.textContent = '৳ 0.00';
    if (periodEl) periodEl.textContent = '-';
};

window.initReportsView = function() {
    const s = document.getElementById('rptStartDate');
    if (s && !s.value) s.value = '2026-08-31';
    const e = document.getElementById('rptEndDate');
    if (e && !e.value) e.value = '2026-09-30';
    const t = document.getElementById('rptTypeSelect');
    if (t && !t.value) t.value = 'category_brand_sales';
    window.generateAnalyticalReport();
};

window.generateAnalyticalReport = function() {
    const type = document.getElementById('rptTypeSelect')?.value || 'category_brand_sales';
    const start = document.getElementById('rptStartDate')?.value || '2026-08-31';
    const end = document.getElementById('rptEndDate')?.value || '2026-09-30';

    const periodEl = document.getElementById('rpt_period');
    if (periodEl) {
        periodEl.textContent = (start && end) ? `${start} to ${end}` : 'Current Stock';
    }

    if (type === 'category_brand_sales') {
        const customerSearch = document.getElementById('rptCustomerSearch')?.value || '';
        google.script.run.withSuccessHandler(res => {
            const countEl = document.getElementById('rpt_count');
            const totalEl = document.getElementById('rpt_total');

            if (!res || !res.categoriesGroup || Object.keys(res.categoriesGroup).length === 0) {
                document.getElementById('reportHeader').innerHTML = '';
                document.getElementById('reportContent').innerHTML = '<tr><td colspan="7" class="text-center" style="padding:32px; color:#ef4444;">No sales records found for selected filters.</td></tr>';
                if (countEl) countEl.textContent = '0 Items';
                if (totalEl) totalEl.textContent = '৳ 0.00';
                return;
            }

            // Header
            document.getElementById('reportHeader').innerHTML = `
                <tr style="background: #e0f2fe; border-bottom: 2px solid #bae6fd;">
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: left;">CATEGORY</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: left;">BRAND</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: left;">CODE</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: left;">PRODUCT NAME</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">PACK</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">TOTAL SOLD</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">SALES VALUE (৳)</th>
                </tr>
            `;

            let rowsHtml = '';

            Object.values(res.categoriesGroup).forEach(cat => {
                Object.values(cat.brands).forEach(br => {
                    br.items.forEach(item => {
                        const bg = '#ffffff';
                        const ctnPcsDisplay = item.loosePcs > 0 
                            ? `<span style="color: #059669; font-weight: 700;">${item.ctn}c ${item.loosePcs}p</span> <span style="color: #2563eb; font-weight: 700;">(${item.pcs})</span>`
                            : `<span style="color: #059669; font-weight: 700;">${item.ctn}</span> <span style="color: #2563eb; font-weight: 700;">(${item.pcs})</span>`;

                        rowsHtml += `
                            <tr style="background: ${bg}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${bg}'">
                                <td style="padding: 12px 14px; font-size: 0.84rem; color: #475569; text-align: left;">${escapeHtml(item.category)}</td>
                                <td style="padding: 12px 14px; font-size: 0.84rem; color: #475569; text-align: left;">${escapeHtml(item.brand)}</td>
                                <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 600; color: #334155; text-align: left;">${escapeHtml(item.code)}</td>
                                <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 700; color: #0f172a; text-align: left;">${escapeHtml(item.name)}</td>
                                <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 700; color: #1e293b; text-align: center;">${item.pack}</td>
                                <td style="padding: 12px 14px; font-size: 0.85rem; text-align: center; white-space: nowrap;">${ctnPcsDisplay}</td>
                                <td style="padding: 12px 14px; font-size: 0.85rem; font-weight: 800; color: #0f172a; text-align: right; white-space: nowrap;">৳ ${formatBD(item.value, 2)}</td>
                            </tr>
                        `;
                    });

                    // Brand Subtotal Row
                    rowsHtml += `
                        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <td colspan="5" style="padding: 10px 14px; font-size: 0.84rem; font-weight: 700; color: #334155; text-align: right;">${escapeHtml(br.name)} Subtotal:</td>
                            <td style="padding: 10px 14px; font-size: 0.85rem; font-weight: 800; color: #0f172a; text-align: center; white-space: nowrap;">${br.totalCtn} (${br.totalPcs})</td>
                            <td style="padding: 10px 14px; font-size: 0.85rem; font-weight: 800; color: #0f172a; text-align: right; white-space: nowrap;">৳ ${formatBD(br.totalValue, 2)}</td>
                        </tr>
                    `;
                });

                // Category Subtotal Row
                rowsHtml += `
                    <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                        <td colspan="5" style="padding: 11px 14px; font-size: 0.85rem; font-weight: 800; color: #0f172a; text-align: right;">${escapeHtml(cat.name)} Subtotal:</td>
                        <td style="padding: 11px 14px; font-size: 0.86rem; font-weight: 800; color: #0f172a; text-align: center; white-space: nowrap;">${cat.totalCtn} (${cat.totalPcs})</td>
                        <td style="padding: 11px 14px; font-size: 0.86rem; font-weight: 800; color: #0f172a; text-align: right; white-space: nowrap;">৳ ${formatBD(cat.totalValue, 2)}</td>
                    </tr>
                `;
            });

            // Grand Total Row
            rowsHtml += `
                <tr style="background: #e2e8f0; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
                    <td colspan="5" style="padding: 13px 14px; font-size: 0.86rem; font-weight: 900; color: #0f172a; text-align: right; letter-spacing: 0.03em;">GRAND TOTAL:</td>
                    <td style="padding: 13px 14px; font-size: 0.88rem; font-weight: 900; color: #0f172a; text-align: center; white-space: nowrap;">${res.totals.grandCtn} (${res.totals.grandPcs})</td>
                    <td style="padding: 13px 14px; font-size: 0.88rem; font-weight: 900; color: #0f172a; text-align: right; white-space: nowrap;">৳ ${formatBD(res.totals.grandTotal, 2)}</td>
                </tr>
            `;

            document.getElementById('reportContent').innerHTML = rowsHtml;

            if (countEl) countEl.textContent = `${res.totals.count} Items`;
            if (totalEl) totalEl.textContent = '৳ ' + formatBD(res.totals.grandTotal, 2);
            if (periodEl) periodEl.textContent = res.totals.period || `${start} to ${end}`;
        }).getCategoryBrandSalesReport(start, end, customerSearch);
    } else if (type === 'collection') {
        google.script.run.withSuccessHandler(res => {
            document.getElementById('reportHeader').innerHTML = `
                <tr style="background: #e0f2fe; border-bottom: 2px solid #bae6fd;">
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Date</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Customer</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Memo</th>
                    ${(res.categories || []).map(c=>`<th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">${escapeHtml(c)}</th>`).join('')}
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; text-align: right;">Total</th>
                </tr>
            `;
            document.getElementById('reportContent').innerHTML = (res.rows || []).map(r => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 14px;">${escapeHtml(r.date)}</td>
                    <td style="padding: 12px 14px;"><strong>${escapeHtml(r.customerName)}</strong></td>
                    <td style="padding: 12px 14px;">${escapeHtml(r.memoNo)}</td>
                    ${(res.categories || []).map(c=>`<td style="padding: 12px 14px;">${r.categories && r.categories[c] ? '৳ '+formatBD(r.categories[c], 2) : '-'}</td>`).join('')}
                    <td style="padding: 12px 14px; text-align: right;"><strong>৳ ${formatBD(r.totalCollection, 2)}</strong></td>
                </tr>`).join('');
            document.getElementById('rpt_count').textContent = res.rows ? res.rows.length : 0;
            document.getElementById('rpt_total').textContent = '৳ ' + formatBD(res.grandTotal, 2);
        }).getCollectionReport(start, end);
    } else if (type === 'deposit_report') {
        google.script.run.withSuccessHandler(res => {
            document.getElementById('reportHeader').innerHTML = `
                <tr style="background: #e0f2fe; border-bottom: 2px solid #bae6fd;">
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Date</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Slip</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Destination</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Bank</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Expense</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase;">Note</th>
                </tr>
            `;
            document.getElementById('reportContent').innerHTML = (res.rows || []).map(r => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 14px;">${escapeHtml(r.date)}</td>
                    <td style="padding: 12px 14px;">${escapeHtml(r.slipNo)}</td>
                    <td style="padding: 12px 14px;"><strong>${escapeHtml(r.destination)}</strong></td>
                    <td style="padding: 12px 14px;">৳ ${formatBD(r.bankDeposit, 2)}</td>
                    <td style="padding: 12px 14px;">৳ ${formatBD(r.expenseOther, 2)}</td>
                    <td style="padding: 12px 14px;">${escapeHtml(r.note)}</td>
                </tr>`).join('');
            document.getElementById('rpt_count').textContent = res.rows ? res.rows.length : 0;
            document.getElementById('rpt_total').textContent = '৳ ' + formatBD(res.totals && res.totals.grandTotal, 2);
        }).getDepositReport(start, end);
    } else {
        // CURRENT STOCK REPORT - Multi-Warehouse Breakdown (Matches user screenshot)
        google.script.run.withSuccessHandler(res => {
            if (!res || (!res.rows && !res.data)) {
                document.getElementById('reportContent').innerHTML = '<tr><td colspan="10" class="text-center" style="padding:24px; color:#ef4444;">No stock records found.</td></tr>';
                return;
            }

            const rows = res.rows || res.data || [];
            const rawWarehouses = res.warehouses || [
                { id: 'W001', name: 'MouloviBazar' },
                { id: 'W002', name: 'Begumganj 2' },
                { id: 'W003', name: 'Begumganj 3' },
                { id: 'W004', name: 'Armanitola' }
            ];

            // Normalize warehouses list
            const warehouses = rawWarehouses.map(w => ({
                id: String(w.id || w.Warehouse_ID || w.warehouse_id || '').trim(),
                name: String(w.name || w.Warehouse_Name || w.warehouse_name || w.id || '').trim()
            }));

            // Build dynamic header
            const headerHtml = `
                <tr style="background: #e0f2fe; border-bottom: 2px solid #bae6fd;">
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: left;">CODE</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: left;">PRODUCT NAME</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">PACK</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">COST</th>
                    ${warehouses.map(w => `
                        <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">
                            ${escapeHtml(w.name.toUpperCase())}
                        </th>
                    `).join('')}
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">TOTAL STOCK</th>
                    <th style="padding: 12px 14px; font-size: 0.76rem; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">VALUE (৳)</th>
                </tr>
            `;
            document.getElementById('reportHeader').innerHTML = headerHtml;

            // Warehouse cell formatting: e.g. "24 (288)", "131c 56p (12632)", "0c 21p (21)", or "0"
            const formatWhStockCell = (qty, packSize) => {
                const totalPcs = parseFloat(qty) || 0;
                if (totalPcs === 0) return '0';
                const pack = parseInt(packSize) || 1;
                if (pack <= 1) return String(totalPcs);
                const c = Math.floor(totalPcs / pack);
                const p = Math.round(totalPcs % pack);
                if (p === 0) {
                    return `${c} (${totalPcs})`;
                } else {
                    return `${c}c ${p}p (${totalPcs})`;
                }
            };

            let grandTotalStock = 0;
            let grandTotalValue = 0;

            const rowsHtml = rows.map((r, idx) => {
                const code = r.code || r.Product_ID || r['Product ID'] || '';
                const name = r.name || r.Product_Name || r['Product Name'] || '';
                const pack = parseInt(r.pack || r.UPC || r.Pack_Size || r.Carton_Size || 1) || 1;
                const cost = parseFloat(r.cost !== undefined ? r.cost : (r.Unit_Price || r['Purchase Price'] || 0)) || 0;
                const whStockMap = r.warehouseStock || r.WarehouseStock || {};

                let computedTotalStock = 0;
                const whCells = warehouses.map(w => {
                    const wId = w.id;
                    const wName = w.name;
                    const qty = parseFloat(
                        whStockMap[wId] !== undefined ? whStockMap[wId] :
                        (whStockMap[wName] !== undefined ? whStockMap[wName] :
                        (whStockMap[wName.toLowerCase()] !== undefined ? whStockMap[wName.toLowerCase()] : 0))
                    ) || 0;
                    computedTotalStock += qty;
                    const cellFormatted = formatWhStockCell(qty, pack);
                    return `
                        <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 700; color: #059669; text-align: center; white-space: nowrap;">
                            ${cellFormatted}
                        </td>
                    `;
                }).join('');

                const finalTotalStock = (r.totalStock !== undefined && r.totalStock > 0) ? r.totalStock : (computedTotalStock > 0 ? computedTotalStock : (parseFloat(r.Stock) || 0));
                const finalValue = r.value !== undefined ? r.value : (finalTotalStock * cost);
                const totalStockFormatted = formatWhStockCell(finalTotalStock, pack);

                grandTotalStock += finalTotalStock;
                grandTotalValue += finalValue;

                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                return `
                    <tr style="background: ${bg}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${bg}'">
                        <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 700; color: #1e293b; white-space: nowrap; text-align: left;">
                            ${escapeHtml(code)}
                        </td>
                        <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 600; color: #334155; text-align: left;">
                            ${escapeHtml(name)}
                        </td>
                        <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 700; color: #1e293b; text-align: center;">
                            ${pack}
                        </td>
                        <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 600; color: #334155; text-align: right; white-space: nowrap;">
                            ৳${cost.toFixed(2)}
                        </td>
                        ${whCells}
                        <td style="padding: 12px 14px; font-size: 0.86rem; font-weight: 800; color: #2563eb; text-align: center; white-space: nowrap;">
                            ${totalStockFormatted}
                        </td>
                        <td style="padding: 12px 14px; font-size: 0.84rem; font-weight: 700; color: #0f172a; text-align: right; white-space: nowrap;">
                            ৳ ${formatBD(finalValue, 2)}
                        </td>
                    </tr>
                `;
            }).join('');

            document.getElementById('reportContent').innerHTML = rowsHtml;

            // Summary cards
            const countEl = document.getElementById('rpt_count');
            const totalEl = document.getElementById('rpt_total');

            if (countEl) countEl.textContent = rows.length;
            if (totalEl) totalEl.textContent = '৳ ' + formatBD(grandTotalValue, 2);
            if (periodEl) {
                if (start && end) {
                    periodEl.textContent = `${start} to ${end}`;
                } else if (res.totals && res.totals.period) {
                    periodEl.textContent = res.totals.period;
                } else {
                    periodEl.textContent = '2026-08-31 to 2026-09-30';
                }
            }
        }).generateStockReport(start, end);
    }
};

window.exportTableToExcel = function() {
    const table = document.getElementById("reportResultTable");
    if (!table) return;
    const blob = new Blob([table.outerHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Report_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
};

// UNIVERSAL LOOKUP
window.openDocLookupModal = function() {
    const modal = document.getElementById('docLookupModal');
    if (modal && modal.style) {
        modal.style.display = 'flex';
        setTimeout(() => {
            const inp = document.getElementById('docLookupInput');
            if (inp) inp.focus();
        }, 100);
    }
};

window.executeUniversalLookup = function() {
    const q = document.getElementById('docLookupInput')?.value.trim();
    if (!q) return;

    const emptyArea = document.getElementById('docLookupEmptyArea');
    const resultArea = document.getElementById('docLookupResultArea');

    if (emptyArea) {
        emptyArea.style.display = 'block';
        emptyArea.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 1.8rem; color: #3b82f6; margin-bottom: 8px; display: block;"></i> Searching database...';
    }
    if (resultArea) resultArea.style.display = 'none';

    google.script.run.withSuccessHandler(res => {
        if (res && res.success) {
            if (emptyArea) emptyArea.style.display = 'none';
            if (resultArea) {
                resultArea.style.display = 'block';
                resultArea.innerHTML = renderUniversalDocCard(res);
            }
        } else {
            if (emptyArea) {
                emptyArea.style.display = 'block';
                emptyArea.innerHTML = `<i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 8px; display: block;"></i> <span style="color: #ef4444; font-weight: 700;">Not Found:</span> No document found matching "${escapeHtml(q)}"`;
            }
            if (resultArea) resultArea.style.display = 'none';
        }
    }).findUniversalInvoice(q);
};

window.renderUniversalDocCard = function(res) {
    if (!res) return '';

    const formatMoney = (val) => {
        const num = parseFloat(val) || 0;
        return num.toFixed(2);
    };

    const formatDocDate = (d) => {
        if (!d) return 'N/A';
        try {
            const parts = String(d).split('T')[0].split('-');
            if (parts.length === 3) {
                return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
            }
            return String(d);
        } catch(e) {
            return String(d);
        }
    };

    const isSales = res.type === 'Sales';
    const isPurchase = res.type === 'Purchase';
    const isExpense = res.type === 'Expense';

    let badgeIcon = 'fas fa-shopping-cart';
    let badgeBg = '#dcfce7';
    let badgeColor = '#15803d';
    let badgeText = res.title || 'Sales Invoice';

    if (isPurchase) {
        badgeIcon = 'fas fa-truck-loading';
        badgeBg = '#e0e7ff';
        badgeColor = '#4338ca';
        badgeText = 'Purchase Procurement';
    } else if (isExpense) {
        badgeIcon = 'fas fa-file-invoice-dollar';
        badgeBg = '#fef3c7';
        badgeColor = '#b45309';
        badgeText = 'Operating Expense';
    }

    const items = res.items || [];
    const itemsHtml = items.map(i => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">
            <td style="padding: 10px 12px; font-weight: 600; color: #1e293b; max-width: 200px; word-break: break-word;">${escapeHtml(i.name || '')}</td>
            <td style="padding: 10px 10px; color: #64748b; font-size: 0.8rem;">${escapeHtml(i.batch || 'N/A')}</td>
            <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #0f172a;">${i.qty}</td>
            <td style="padding: 10px 10px; text-align: right; color: #334155;">৳${formatMoney(i.price || i.cost || 0)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 800; color: #0f172a;">৳${formatMoney(i.total || 0)}</td>
        </tr>
    `).join('');

    const subtotal = res.subtotal !== undefined ? res.subtotal : res.grandTotal;
    const discount = parseFloat(res.discount) || 0;
    const grandTotal = parseFloat(res.grandTotal) || 0;
    const paidAmount = parseFloat(res.paidAmount) || 0;
    const dueAmount = res.dueAmount !== undefined ? parseFloat(res.dueAmount) : (grandTotal - paidAmount);

    return `
    <div style="background: white; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.03);">
        <!-- Top Title & Date/Mode Row -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div>
                <span style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; font-size: 0.78rem; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="${badgeIcon}"></i> ${escapeHtml(badgeText)}
                </span>
                <div style="font-size: 1.45rem; font-weight: 800; color: #0f172a; margin-top: 6px; letter-spacing: -0.01em;">
                    ${escapeHtml(res.id || '')}
                </div>
                ${res.memoNo ? `<div style="color: #4361ee; font-weight: 700; font-size: 0.88rem; margin-top: 2px;">Memo No: ${escapeHtml(String(res.memoNo))}</div>` : ''}
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.72rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">DATE</div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
                    ${formatDocDate(res.date)}
                </div>
                ${res.paymentType ? `
                    <span style="background: #e0f2fe; color: #0284c7; font-weight: 700; font-size: 0.75rem; padding: 2px 10px; border-radius: 12px; display: inline-block;">
                        ${escapeHtml(res.paymentType)}
                    </span>
                ` : ''}
            </div>
        </div>

        <!-- 2-Column Info Grid -->
        <div style="background: #f8fafc; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.86rem; border: 1px solid #f1f5f9;">
            <div>
                <div><strong style="color: #0f172a;">${isPurchase ? 'Supplier:' : (isExpense ? 'Category:' : 'Customer:')}</strong> <span style="color: #334155;">${escapeHtml(res.customerName || res.supplierName || res.category || 'N/A')}</span></div>
                <div style="margin-top: 4px;"><strong style="color: #0f172a;">${isExpense ? 'Note:' : 'Phone:'}</strong> <span style="color: #334155;">${escapeHtml(isExpense ? (res.note || 'N/A') : (res.customerPhone || res.supplierPhone || 'N/A'))}</span></div>
            </div>
            <div>
                <div><strong style="color: #0f172a;">Warehouse:</strong> <span style="color: #334155;">${escapeHtml(res.warehouse || 'Begumganj 2')}</span></div>
                <div style="margin-top: 4px;"><strong style="color: #0f172a;">Billed By:</strong> <span style="color: #334155;">${escapeHtml(res.createdBy || 'U0001')}</span></div>
            </div>
        </div>

        ${items.length > 0 ? `
        <!-- Items Table -->
        <div class="table-responsive" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; min-width: 480px;">
                <thead>
                    <tr style="background: #e0f2fe; color: #0284c7; font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">
                        <th style="padding: 10px 12px; text-align: left; width: 34%;">Item / Product</th>
                        <th style="padding: 10px 10px; text-align: left; width: 26%;">Batch</th>
                        <th style="padding: 10px 8px; text-align: center; width: 12%;">Qty</th>
                        <th style="padding: 10px 10px; text-align: right; width: 14%;">Price</th>
                        <th style="padding: 10px 12px; text-align: right; width: 14%;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Totals Summary Box -->
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px 18px; border: 1px solid #f1f5f9;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.9rem;">
                <span style="color: #334155; font-weight: 600;">Subtotal:</span>
                <span style="color: #0f172a; font-weight: 800;">৳ ${formatMoney(subtotal)}</span>
            </div>
            ${discount > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.9rem;">
                <span style="color: #ea580c; font-weight: 700;">Discount:</span>
                <span style="color: #ea580c; font-weight: 800;">- ৳ ${formatMoney(discount)}</span>
            </div>
            ` : ''}
            <div style="border-top: 1px solid #e2e8f0; margin: 10px 0;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #4361ee; font-size: 1.15rem; font-weight: 800;">Grand Total:</span>
                <span style="color: #4361ee; font-size: 1.35rem; font-weight: 800;">৳ ${formatMoney(grandTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding-top: 4px;">
                <span style="color: #64748b; font-weight: 600;">Paid: ৳ ${formatMoney(paidAmount)}</span>
                <span style="color: ${dueAmount > 0 ? '#ef4444' : '#10b981'}; font-weight: 800;">Due: ৳ ${formatMoney(dueAmount)}</span>
            </div>
        </div>
    </div>
    `;
};

// SETTINGS & MASTER DATA
window.refreshMasterLists = function() {
    google.script.run.withSuccessHandler(data => renderMasterList('categoryListContainer', data, 'Category_Name', 'Category_ID', 'Categories')).getData('Categories');
    google.script.run.withSuccessHandler(data => renderMasterList('brandListContainer', data, 'Brand_Name', 'Brand_ID', 'Brands')).getData('Brands');
    google.script.run.withSuccessHandler(data => renderMasterList('warehouseListContainer', data, 'Warehouse_Name', 'Warehouse_ID', 'Warehouses')).getData('Warehouses');
    google.script.run.withSuccessHandler(data => renderMasterList('bankListContainer', data, 'Bank_Name', 'Bank_ID', 'Settings_Banks')).getData('Settings_Banks');
    google.script.run.withSuccessHandler(data => renderMasterList('expenseCategoryListContainer', data, 'Category_Name', 'EC_ID', 'Settings_Expense_Categories')).getData('Settings_Expense_Categories');
    google.script.run.withSuccessHandler(data => renderMasterList('customerTypeListContainer', data, 'Type_Name', 'CT_ID', 'Settings_Customer_Types')).getData('Settings_Customer_Types');
};

function renderMasterList(containerId, data, nameKey, idKey, sheetName) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const lowerName = nameKey.toLowerCase();
    const lowerId = idKey.toLowerCase();

    box.innerHTML = (data || []).map(item => {
        const valName = item[nameKey] !== undefined ? item[nameKey] : (item[lowerName] !== undefined ? item[lowerName] : '');
        const valId = item[idKey] !== undefined ? item[idKey] : (item[lowerId] !== undefined ? item[lowerId] : '');
        const status = item.Status || item.status || 'Active';
        const isActive = status === 'Active';
        const safeName = escapeHtml(String(valName));
        const safeId = escapeHtml(String(valId));
        const safeStatus = escapeHtml(String(status));
        const encName = encodeURIComponent(String(valName));
        const encId = encodeURIComponent(String(valId));
        const encStatus = encodeURIComponent(String(status));

        return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #f1f5f9; background:${isActive ? '#ffffff' : '#fafafa'}; border-radius:6px; margin-bottom:4px; box-shadow:0 1px 2px rgba(0,0,0,0.02); opacity:${isActive ? '1' : '0.8'};">
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden; min-width:0; flex:1; margin-right:8px;">
                <span class="badge badge-info" style="font-size:0.68rem; padding:1px 5px; font-weight:700; flex-shrink:0; border-radius:4px;">${safeId}</span>
                <span style="font-weight:600; font-size:0.8rem; color:${isActive ? '#1e293b' : '#64748b'}; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; ${isActive ? '' : 'text-decoration:line-through;'}" title="${safeName}">${safeName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
                <button type="button" class="badge ${isActive ? 'badge-success' : 'badge-danger'}" 
                    style="border:none; cursor:pointer; width:24px; height:24px; border-radius:5px; padding:0; display:inline-flex; align-items:center; justify-content:center; transition:0.2s;" 
                    onclick="toggleMasterStatus('${sheetName}', decodeURIComponent('${encId}'))" 
                    title="${safeStatus} - Click to toggle">
                    <i class="fas ${isActive ? 'fa-check-circle' : 'fa-ban'}" style="font-size:11px;"></i>
                </button>
                <button type="button" class="btn-icon btn-edit" style="width:24px; height:24px; border-radius:5px; padding:0; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;" 
                    onclick="openEditMasterModal('${sheetName}', decodeURIComponent('${encId}'), decodeURIComponent('${encName}'), decodeURIComponent('${encStatus}'))" 
                    title="Edit ${safeName}">
                    <i class="fas fa-edit" style="font-size:11px;"></i>
                </button>
            </div>
        </div>`;
    }).join('') || '<p style="padding:14px; color:#94a3b8; text-align:center; font-size:0.9rem;">No items recorded yet</p>';
}

window.toggleMasterStatus = function(sheetName, itemId) {
    if (!sheetName || !itemId) return;
    google.script.run
        .withSuccessHandler(res => {
            refreshMasterLists();
            if (window.loadGlobalMetadata) window.loadGlobalMetadata();
        })
        .withFailureHandler(err => {
            showAlertModal("Update Failed", (err && err.message) ? err.message : "Failed to toggle status.");
        })
        .toggleMasterStatus(sheetName, itemId);
};

window.openEditMasterModal = function(sheetName, itemId, currentName, currentStatus) {
    const titles = {
        'Categories': 'Edit Category',
        'Brands': 'Edit Brand',
        'Warehouses': 'Edit Warehouse',
        'Settings_Banks': 'Edit Bank Account',
        'Settings_Expense_Categories': 'Edit Operating Expense Category',
        'Settings_Customer_Types': 'Edit Customer Type'
    };
    const labels = {
        'Categories': 'Category Name',
        'Brands': 'Brand Name',
        'Warehouses': 'Warehouse Name',
        'Settings_Banks': 'Bank Account Name',
        'Settings_Expense_Categories': 'Expense Category Name',
        'Settings_Customer_Types': 'Customer Type Name'
    };
    const idKeys = {
        'Categories': 'Category_ID',
        'Brands': 'Brand_ID',
        'Warehouses': 'Warehouse_ID',
        'Settings_Banks': 'Bank_ID',
        'Settings_Expense_Categories': 'EC_ID',
        'Settings_Customer_Types': 'CT_ID'
    };
    const nameKeys = {
        'Categories': 'Category_Name',
        'Brands': 'Brand_Name',
        'Warehouses': 'Warehouse_Name',
        'Settings_Banks': 'Bank_Name',
        'Settings_Expense_Categories': 'Category_Name',
        'Settings_Customer_Types': 'Type_Name'
    };

    const titleEl = document.getElementById('editMasterModalTitle');
    const nameLabelEl = document.getElementById('editMasterNameLabel');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-edit" style="color:#4361ee;"></i> ${titles[sheetName] || 'Edit Item'}`;
    if (nameLabelEl) nameLabelEl.innerText = labels[sheetName] || 'Name';

    const sheetInp = document.getElementById('editMasterSheet');
    const idInp = document.getElementById('editMasterId');
    const idDisplay = document.getElementById('editMasterIdDisplay');
    const idKeyInp = document.getElementById('editMasterIdKey');
    const nameKeyInp = document.getElementById('editMasterNameKey');
    const nameInp = document.getElementById('editMasterInput');
    const statusInp = document.getElementById('editMasterStatus');

    if (sheetInp) sheetInp.value = sheetName;
    if (idInp) idInp.value = itemId;
    if (idDisplay) idDisplay.value = itemId;
    if (idKeyInp) idKeyInp.value = idKeys[sheetName] || 'ID';
    if (nameKeyInp) nameKeyInp.value = nameKeys[sheetName] || 'Name';
    if (nameInp) nameInp.value = currentName || '';
    if (statusInp) statusInp.value = (currentStatus === 'Inactive') ? 'Inactive' : 'Active';

    const modal = document.getElementById('editMasterModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            if (nameInp) {
                nameInp.focus();
                nameInp.select();
            }
        }, 50);
    }
};

window.saveMasterItemEdit = function() {
    const sheetName = document.getElementById('editMasterSheet')?.value;
    const itemId = document.getElementById('editMasterId')?.value;
    const idKey = document.getElementById('editMasterIdKey')?.value;
    const nameKey = document.getElementById('editMasterNameKey')?.value;
    const inp = document.getElementById('editMasterInput');
    const newName = inp?.value?.trim();
    const newStatus = document.getElementById('editMasterStatus')?.value || 'Active';

    if (!sheetName || !itemId) return;
    if (!newName) {
        showAlertModal("Validation Error", "Name cannot be empty.");
        return;
    }

    const btn = document.getElementById('btnSaveMasterEdit');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    google.script.run
        .withSuccessHandler(res => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            closeModal('editMasterModal');
            refreshMasterLists();
            if (window.loadGlobalMetadata) window.loadGlobalMetadata();

            // Synchronize in-memory maps for real-time consistency
            if (sheetName === 'Categories' && typeof categoryMap !== 'undefined') {
                categoryMap[itemId] = newName;
                if (typeof renderProductTable === 'function' && typeof filteredProducts !== 'undefined' && filteredProducts.length > 0) {
                    renderProductTable();
                }
            } else if (sheetName === 'Brands' && typeof brandMap !== 'undefined') {
                brandMap[itemId] = newName;
                if (typeof renderProductTable === 'function' && typeof filteredProducts !== 'undefined' && filteredProducts.length > 0) {
                    renderProductTable();
                }
            } else if (sheetName === 'Warehouses' && typeof warehouseList !== 'undefined') {
                const wh = warehouseList.find(w => (w.Warehouse_ID || w.warehouse_id) === itemId);
                if (wh) {
                    wh.Warehouse_Name = newName;
                    wh.warehouse_name = newName;
                    wh.Status = newStatus;
                    wh.status = newStatus;
                }
            }

            showAlertModal("Updated", `${sheetName.replace('Settings_', '').replace('_', ' ')} item updated successfully.`);
            if (sheetName === 'Settings_Expense_Categories' && window.loadDepositsView) {
                if (typeof updateDepositDestinations === 'function') updateDepositDestinations();
            }
            if (sheetName === 'Settings_Customer_Types') {
                if (typeof syncCustomerTypeDropdowns === 'function') syncCustomerTypeDropdowns();
                if (typeof loadCustomerData === 'function') loadCustomerData();
            }
        })
        .withFailureHandler(err => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            showAlertModal("Update Failed", (err && err.message) ? err.message : "Failed to update item.");
        })
        .updateMasterData(sheetName, itemId, newName, newStatus);
};

window.addMasterItem = function(sheetName, inputId) {
    const inp = document.getElementById(inputId);
    const val = inp?.value?.trim();
    if (!val) return;
    const nameField = sheetName === 'Categories' ? 'Category_Name' : 
                      sheetName === 'Brands' ? 'Brand_Name' : 
                      sheetName === 'Settings_Banks' ? 'Bank_Name' : 
                      sheetName === 'Settings_Expense_Categories' ? 'Category_Name' :
                      sheetName === 'Settings_Customer_Types' ? 'Type_Name' : 'Warehouse_Name';
    google.script.run
        .withSuccessHandler(() => {
            if (inp) inp.value = '';
            refreshMasterLists();
            if (window.loadGlobalMetadata) window.loadGlobalMetadata();
            if (sheetName === 'Settings_Expense_Categories' && window.loadDepositsView) {
                if (typeof updateDepositDestinations === 'function') updateDepositDestinations();
            }
            if (sheetName === 'Settings_Customer_Types') {
                if (typeof syncCustomerTypeDropdowns === 'function') syncCustomerTypeDropdowns();
            }
        })
        .withFailureHandler(err => {
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to add item.");
        })
        .writeData(sheetName, { [nameField]: val });
};

window.saveSystemConfig = function() {
    const form = document.getElementById('systemSettingsForm');
    if (!form) return;
    const data = new FormData(form);
    const obj = {};
    data.forEach((v, k) => obj[k] = v);

    if (obj.COMPANY_NAME) {
        window.applyCompanyNameUI(obj.COMPANY_NAME);
    }

    google.script.run
        .withSuccessHandler(() => {
            showAlertModal("Success", "Settings saved successfully.");
            window.loadSystemConfig();
        })
        .withFailureHandler(err => {
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to save settings.");
        })
        .saveSettings(obj);
};

// USERS
window.loadUsersData = function() {
    google.script.run.withSuccessHandler(users => {
        document.getElementById('userTableBody').innerHTML = (users || []).map(u => `
            <tr>
                <td><strong>${u.User_ID}</strong></td>
                <td>${u.Name}</td>
                <td>${u.Email}</td>
                <td>••••••</td>
                <td><span class="badge badge-info">${u.Role}</span></td>
                <td>
                    <select class="form-control" style="width:auto;" onchange="google.script.run.withSuccessHandler(loadUsersData).updateUserRole('${u.User_ID}', this.value)">
                        <option value="Admin" ${u.Role==='Admin'?'selected':''}>Admin</option>
                        <option value="Manager" ${u.Role==='Manager'?'selected':''}>Manager</option>
                        <option value="Sales" ${u.Role==='Sales'?'selected':''}>Sales</option>
                        <option value="Viewer" ${u.Role==='Viewer'?'selected':''}>Viewer</option>
                    </select>
                </td>
                <td><span class="badge badge-success">${u.Status}</span></td>
                <td><button class="btn-icon btn-delete" onclick="google.script.run.withSuccessHandler(loadUsersData).deleteUser('${u.User_ID}')"><i class="fas fa-trash"></i></button></td>
            </tr>`).join('');
    }).getUsers();
};

window.openAddUserModal = function() {
    const form = document.getElementById('addUserForm');
    if (form) form.reset();
    const modal = document.getElementById('addUserModal');
    if (modal && modal.style) modal.style.display = 'flex';
};

window.submitNewUser = function() {
    const data = {
        name: document.getElementById('new_name').value.trim(),
        email: document.getElementById('new_email').value.trim(),
        password: document.getElementById('new_password').value.trim(),
        role: document.getElementById('new_role').value
    };
    google.script.run.withSuccessHandler(() => {
        closeModal('addUserModal');
        loadUsersData();
    }).createUser(data);
};

// WAREHOUSE INFO ANALYTICS
let whValueSharePieChartInstance = null;

function generateMiniDonutSvg(slices, size = 64, strokeWidth = 11) {
    if (!slices || slices.length === 0) return '';
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;
    const total = slices.reduce((acc, s) => acc + (s.percentage || 0), 0) || 100;
    let accumulatedOffset = 0;
    
    const circles = slices.map(slice => {
        const percent = (slice.percentage || 0) / total;
        const strokeLength = percent * circumference;
        const dashArray = `${strokeLength.toFixed(2)} ${(circumference - strokeLength).toFixed(2)}`;
        const dashOffset = -accumulatedOffset;
        accumulatedOffset += strokeLength;
        return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${slice.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset.toFixed(2)}" transform="rotate(-90 ${center} ${center})" />`;
    }).join('');
    
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block; overflow:visible;">${circles}</svg>`;
}

window.loadWarehouseInfoData = function() {
    google.script.run.withSuccessHandler(res => {
        if (!res.success) return;
        renderWarehouseInfoView(res.data);
    }).getWarehouseInfoAnalytics();
};

window.renderWarehouseInfoView = function(d) {
    if (!d) return;
    const warehouses = d.warehouses || [];
    const grandTotalVal = d.grandTotalValue !== undefined ? d.grandTotalValue : warehouses.reduce((sum, w) => sum + (w.totalValue || 0), 0);
    const grandTotalCtn = d.grandTotalCtn !== undefined ? d.grandTotalCtn : warehouses.reduce((sum, w) => sum + (w.totalCtn || 0), 0);
    const totalSkus = d.totalUniqueSkus || 18;
    const categoryBreakdown = d.categoryBreakdown || [
        { name: 'Sesa', percentage: 85, value: 87687620, color: '#6366f1' },
        { name: 'Olive Oil', percentage: 7, value: 7164963, color: '#06b6d4' },
        { name: 'Vasmol', percentage: 8, value: 8579124, color: '#3b82f6' }
    ];

    // 1. Total Stock Summary Card (Left Column)
    const summaryCardEl = document.getElementById('totalWarehouseSummaryCard');
    if (summaryCardEl) {
        summaryCardEl.innerHTML = `
            <div class="wh-summary-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 0.72rem; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px;">ALL WAREHOUSES</div>
                            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Total Stock Summary</h3>
                        </div>
                        <div style="width: 34px; height: 34px; border-radius: 8px; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">
                            <i class="fas fa-boxes"></i>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 1.95rem; font-weight: 900; color: #0f172a; line-height: 1.15; margin-bottom: 3px;">
                            ৳ ${formatBD(grandTotalVal)}
                        </div>
                        <div style="font-size: 0.82rem; font-weight: 700; color: #2563eb;">
                            Stk Amt: ${numberToWordsCroreLakh(grandTotalVal)}
                        </div>
                    </div>

                    <div class="wh-summary-breakdown-row">
                        <div class="wh-summary-donut-wrap">
                            ${generateMiniDonutSvg(categoryBreakdown, 76, 14)}
                        </div>
                        <div class="wh-summary-breakdown-list">
                            ${categoryBreakdown.map(cat => `
                                <div class="wh-summary-cat-item">
                                    <div style="display: flex; align-items: center; gap: 6px; color: #334155; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        <span style="width: 7px; height: 7px; border-radius: 50%; background: ${cat.color}; display: inline-block; flex-shrink: 0;"></span>
                                        <span style="overflow: hidden; text-overflow: ellipsis;">${cat.name} (${cat.percentage}%)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                        <span class="wh-ctn-badge">${formatBD(cat.ctn !== undefined ? cat.ctn : (cat.totalCtn || 0))} CTN</span>
                                        <span style="font-weight: 700; color: #0f172a; white-space: nowrap; text-align: right; min-width: 75px;">৳${formatBD(cat.value)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #1e293b;">
                    <div>Total CTN: <strong style="font-weight: 800; color: #0f172a;">${formatBD(grandTotalCtn)}</strong></div>
                    <div>Total SKUs: <strong style="font-weight: 800; color: #0f172a;">${totalSkus}</strong></div>
                </div>
            </div>`;
    }

    // 2. Individual Warehouse Cards (2x2 Right Grid)
    const gridEl = document.getElementById('whMergedCardsGrid');
    if (gridEl) {
        gridEl.innerHTML = warehouses.map(w => {
            const categories = w.categories || [];
            return `
            <div class="wh-single-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">${w.name}</div>
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: ${w.badgeColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                            <i class="fas fa-warehouse"></i>
                        </div>
                    </div>

                    <div class="wh-single-card-body">
                        <div class="wh-single-card-val">
                            <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; line-height: 1.15; margin-bottom: 3px; white-space: nowrap;">
                                ৳ ${formatBD(w.totalValue)}
                            </div>
                            <div style="font-size: 0.72rem; font-weight: 700; color: #2563eb; line-height: 1.2;">
                                Stk Amt: ${numberToWordsCroreLakh(w.totalValue)}
                            </div>
                        </div>

                        <div class="wh-single-card-catbox">
                            <div style="width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                ${generateMiniDonutSvg(categories, 44, 7)}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                                ${categories.map(c => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.66rem; gap: 6px;">
                                        <div style="display: flex; align-items: center; gap: 3px; color: #334155; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            <span style="width: 5px; height: 5px; border-radius: 50%; background: ${c.color}; display: inline-block; flex-shrink: 0;"></span>
                                            <span>${c.name} (${c.percentage}%)</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                                            <span class="wh-ctn-badge-sm">${formatBD(c.ctn !== undefined ? c.ctn : (c.totalCtn || 0))} CTN</span>
                                            <div style="font-weight: 700; color: #0f172a; white-space: nowrap; text-align: right;">৳${formatBD(c.value)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; color: #475569;">
                    <div>CTN: <strong style="font-weight: 800; color: #0f172a;">${formatBD(w.totalCtn)}</strong></div>
                    <div>SKU: <strong style="font-weight: 800; color: #0f172a;">${w.skuCount || 0}</strong></div>
                </div>
            </div>`;
        }).join('');
    }

    // 3. Render Bottom Left Clustered Bar Chart: Stock Level by Category & Warehouse
    renderWhCategoryBarChart(d.categories || ['Sesa', 'Olive Oil', 'Vasmol'], warehouses);

    // 4. Render Bottom Right Pie Chart: Warehouse Value Share
    renderWhValueSharePieChart(warehouses);
};

function renderWhCategoryBarChart(categories, warehouses) {
    const canvas = document.getElementById('whCategoryBarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (whCategoryBarChartInstance) {
        whCategoryBarChartInstance.destroy();
    }

    const datasets = warehouses.map(w => ({
        label: w.name,
        data: categories.map(cat => (w.stockUnitsByCategory && w.stockUnitsByCategory[cat]) || 0),
        backgroundColor: w.badgeColor,
        borderRadius: 3,
        barPercentage: 0.85,
        categoryPercentage: 0.75
    }));

    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 500;

    whCategoryBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'center',
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        usePointStyle: false,
                        font: { size: isSmallScreen ? 10 : 11, family: 'Inter, Segoe UI, sans-serif', weight: '600' },
                        padding: isSmallScreen ? 8 : 12,
                        color: '#334155'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(item) {
                            return ` ${item.dataset.label}: ${Number(item.parsed.y).toLocaleString()} units`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: isSmallScreen ? 9.5 : 11, weight: '600' },
                        color: '#475569',
                        maxRotation: isSmallScreen ? 30 : 0
                    }
                },
                y: {
                    min: 0,
                    max: 1000000,
                    ticks: {
                        stepSize: 100000,
                        callback: val => val.toLocaleString('en-US'),
                        font: { size: isSmallScreen ? 9 : 10 },
                        color: '#64748b'
                    },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

function renderWhValueSharePieChart(warehouses) {
    const canvas = document.getElementById('whValueSharePieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (whValueSharePieChartInstance) {
        whValueSharePieChartInstance.destroy();
    }

    const labels = warehouses.map(w => w.name);
    const dataVals = warehouses.map(w => w.totalValue || 0);
    const bgColors = warehouses.map(w => w.shareColor || w.badgeColor);

    // Custom Callout Plugin: identical to screenshot on desktop, intelligently clamped on mobile
    const calloutPlugin = {
        id: 'whValueCallouts',
        afterDraw(chart) {
            const chartCtx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;

            const total = dataVals.reduce((a, b) => a + b, 0);
            const chartWidth = chart.width;
            const isNarrow = chartWidth < 480;
            const isVeryNarrow = chartWidth < 360;

            meta.data.forEach((arc, i) => {
                const w = warehouses[i];
                if (!w) return;
                const angle = (arc.startAngle + arc.endAngle) / 2;
                const percent = Math.round((w.totalValue / total) * 100);

                // 1. Draw percentage inside the slice
                const midRadius = (arc.innerRadius + arc.outerRadius) * 0.55;
                const insideX = arc.x + Math.cos(angle) * midRadius;
                const insideY = arc.y + Math.sin(angle) * midRadius;

                chartCtx.save();
                chartCtx.fillStyle = '#ffffff';
                chartCtx.font = isNarrow ? 'bold 10px Inter, Segoe UI, sans-serif' : 'bold 11px Inter, Segoe UI, sans-serif';
                chartCtx.textAlign = 'center';
                chartCtx.textBaseline = 'middle';
                if (percent >= (isNarrow ? 8 : 5)) {
                    chartCtx.fillText(`${percent}%`, insideX, insideY);
                }

                // 2. Draw Callout pointer line and label outside
                const outerX = arc.x + Math.cos(angle) * arc.outerRadius;
                const outerY = arc.y + Math.sin(angle) * arc.outerRadius;
                const elbowDist = arc.outerRadius + (isNarrow ? 12 : 18);
                const elbowX = arc.x + Math.cos(angle) * elbowDist;
                const elbowY = arc.y + Math.sin(angle) * elbowDist;

                const isRight = Math.cos(angle) >= 0;
                const lineDist = isNarrow ? (isVeryNarrow ? 12 : 18) : 26;
                const lineEndDist = isRight ? lineDist : -lineDist;
                let endX = elbowX + lineEndDist;
                const endY = elbowY;

                // Measure text
                const nameFont = isNarrow ? 'bold 9.5px Inter, Segoe UI, sans-serif' : 'bold 10.5px Inter, Segoe UI, sans-serif';
                const valFont = isNarrow ? 'bold 9px Inter, Segoe UI, sans-serif' : 'bold 10px Inter, Segoe UI, sans-serif';
                const ctnFont = isNarrow ? '600 8.5px Inter, Segoe UI, sans-serif' : '600 9px Inter, Segoe UI, sans-serif';

                chartCtx.font = nameFont;
                const nameWidth = chartCtx.measureText(w.name).width;
                chartCtx.font = valFont;
                const valWidth = chartCtx.measureText(`৳${formatBD(w.totalValue)}`).width;
                const maxLabelWidth = Math.max(nameWidth, valWidth);

                // Smart clamping so no labels bleed off canvas on mobile
                if (isRight) {
                    if (endX + 6 + maxLabelWidth > chartWidth - 4) {
                        endX = Math.max(elbowX + 2, chartWidth - 4 - maxLabelWidth - 6);
                    }
                } else {
                    if (endX - 6 - maxLabelWidth < 4) {
                        endX = Math.min(elbowX - 2, 4 + maxLabelWidth + 6);
                    }
                }

                // Draw line
                chartCtx.beginPath();
                chartCtx.moveTo(outerX, outerY);
                chartCtx.lineTo(elbowX, elbowY);
                chartCtx.lineTo(endX, endY);
                chartCtx.strokeStyle = bgColors[i] || '#94a3b8';
                chartCtx.lineWidth = isNarrow ? 1.2 : 1.5;
                chartCtx.stroke();

                // Draw text labels
                chartCtx.textAlign = isRight ? 'left' : 'right';
                const textX = endX + (isRight ? (isNarrow ? 4 : 6) : (isNarrow ? -4 : -6));

                // Warehouse Name
                chartCtx.font = nameFont;
                chartCtx.fillStyle = '#0f172a';
                chartCtx.fillText(w.name, textX, endY - (isNarrow ? 12 : 14));

                // Value in red/brand color
                chartCtx.font = valFont;
                chartCtx.fillStyle = '#e11d48';
                chartCtx.fillText(`৳${formatBD(w.totalValue)}`, textX, endY);

                // CTN Count
                chartCtx.font = ctnFont;
                chartCtx.fillStyle = '#64748b';
                chartCtx.fillText(`CTN: ${formatBD(w.totalCtn)}`, textX, endY + (isNarrow ? 10 : 12));

                chartCtx.restore();
            });
        }
    };

    whValueSharePieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: function(context) {
                    const w = (context && context.chart && context.chart.width) || window.innerWidth;
                    const isNarrow = w < 480;
                    return {
                        top: isNarrow ? 18 : 25,
                        bottom: isNarrow ? 18 : 25,
                        left: isNarrow ? 32 : 70,
                        right: isNarrow ? 32 : 70
                    };
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(item) {
                            const val = item.raw || 0;
                            return ` ${item.label}: ৳ ${formatBD(val)}`;
                        }
                    }
                }
            }
        },
        plugins: [calloutPlugin]
    });
}

// MULTI-PRODUCT PURCHASE INBOUND (PAGE MODAL)
let mpp_cart = [];
let mpp_selected_product = null;
let mpp_master_products = [];
let isMppProcessing = false;

window.openMultiPurchaseModal = function() {
    const modal = document.getElementById('multiPurchaseModal');
    if (!modal) return;
    modal.style.display = 'flex';

    mpp_cart = [];
    mpp_selected_product = null;
    isMppProcessing = false;

    // Reset entry fields
    const searchInp = document.getElementById('mpp_prod_search');
    if (searchInp) searchInp.value = '';
    const batchInp = document.getElementById('mpp_batch');
    if (batchInp) batchInp.value = '';
    const expInp = document.getElementById('mpp_expiry');
    if (expInp) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 2);
        expInp.value = d.toISOString().split('T')[0];
    }
    const ctnQty = document.getElementById('mpp_ctn_qty');
    if (ctnQty) ctnQty.value = '0';
    const loosePcs = document.getElementById('mpp_loose_pcs');
    if (loosePcs) loosePcs.value = '0';
    const paidPcs = document.getElementById('mpp_paid_pcs');
    if (paidPcs) paidPcs.value = '0';
    const freePcs = document.getElementById('mpp_free_pcs');
    if (freePcs) freePcs.value = '0';
    const ctnCost = document.getElementById('mpp_ctn_cost');
    if (ctnCost) ctnCost.value = '';
    const unitCost = document.getElementById('mpp_unit_cost');
    if (unitCost) unitCost.value = '';
    const salePrice = document.getElementById('mpp_sale_price');
    if (salePrice) salePrice.value = '';
    const mrpPrice = document.getElementById('mpp_mrp_price');
    if (mrpPrice) mrpPrice.value = '';

    // Date
    const pDate = document.getElementById('mpp_purchase_date');
    if (pDate) {
        pDate.value = new Date().toISOString().split('T')[0];
    }

    // Populate Warehouses
    google.script.run.withSuccessHandler(data => {
        const whSel = document.getElementById('mpp_warehouse_select');
        if (whSel && data) {
            whSel.innerHTML = data.map(w => `<option value="${w.Warehouse_ID || w.warehouse_id}">${w.Warehouse_Name || w.warehouse_name}</option>`).join('');
            const mb = data.find(w => (w.Warehouse_Name || w.warehouse_name || '').toLowerCase().includes('moulovi'));
            if (mb) whSel.value = mb.Warehouse_ID || mb.warehouse_id;
        }
    }).getWarehouses();

    // Populate Suppliers
    google.script.run.withSuccessHandler(data => {
        const suppSel = document.getElementById('mpp_supplier_select');
        if (suppSel && data) {
            suppSel.innerHTML = '<option value="">Select Supplier</option>' + (data || []).map(s => `<option value="${s.Supplier_ID || s.supplier_id}">${s.Supplier_Name || s.supplier_name}</option>`).join('');
        }
    }).getData('Suppliers');

    // Populate Products
    google.script.run.withSuccessHandler(prods => {
        mpp_master_products = prods || [];
    }).getData('Products');

    mpp_renderTable();
};

window.mpp_searchProducts = function(val) {
    const dropdown = document.getElementById('mpp_prod_dropdown');
    if (!dropdown) return;
    const q = String(val || '').trim().toLowerCase();
    if (!q) {
        dropdown.style.display = 'none';
        return;
    }
    const matches = (mpp_master_products || []).filter(p => {
        const name = String(p.Product_Name || p.product_name || '').toLowerCase();
        const id = String(p.Product_ID || p.product_id || '').toLowerCase();
        const barcode = String(p.Barcode || p.barcode || '').toLowerCase();
        return name.includes(q) || id.includes(q) || barcode.includes(q);
    });

    if (!matches.length) {
        dropdown.innerHTML = '<div style="padding: 10px 14px; color: #94a3b8; font-size: 0.82rem;">No matching products found</div>';
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = matches.slice(0, 10).map(p => {
        const pId = p.Product_ID || p.product_id;
        const pName = p.Product_Name || p.product_name;
        const packSize = parseInt(p.Pack_Size || p.pack_size || p.upc || p.Carton_Size || 1) || 1;
        const cost = parseFloat(p.Cost_Price || p.cost_price || p.unit_price || 0) || 0;
        return `
            <div onclick="mpp_selectProduct('${pId}')" style="padding: 9px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <div>
                    <strong style="color: #0f172a;">${escapeHtml(pName)}</strong>
                    <div style="font-size: 0.74rem; color: #64748b;">Code: ${pId} | Pack: ${packSize} pcs</div>
                </div>
                <div style="text-align: right; color: #059669; font-weight: 700; font-size: 0.82rem;">
                    ৳ ${cost.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
    dropdown.style.display = 'block';
};

window.mpp_selectProduct = function(pId) {
    const p = (mpp_master_products || []).find(item => (item.Product_ID || item.product_id) === pId);
    if (!p) return;
    mpp_selected_product = p;

    const searchInp = document.getElementById('mpp_prod_search');
    if (searchInp) searchInp.value = p.Product_Name || p.product_name;

    const dropdown = document.getElementById('mpp_prod_dropdown');
    if (dropdown) dropdown.style.display = 'none';

    const packSize = parseInt(p.Pack_Size || p.pack_size || p.upc || p.Carton_Size || 1) || 1;
    const unitCostVal = parseFloat(p.Cost_Price || p.cost_price || p.unit_price || 0) || 0;
    const ctnCostVal = unitCostVal * packSize;
    const salePriceVal = parseFloat(p.Sale_Price || p.sale_price || 0) || 0;
    const mrpPriceVal = parseFloat(p.MRP_Price || p.mrp_price || p.mrp || 0) || 0;

    const unitCost = document.getElementById('mpp_unit_cost');
    if (unitCost) unitCost.value = unitCostVal > 0 ? unitCostVal.toFixed(2) : '';

    const ctnCost = document.getElementById('mpp_ctn_cost');
    if (ctnCost) ctnCost.value = ctnCostVal > 0 ? ctnCostVal.toFixed(2) : '';

    const salePrice = document.getElementById('mpp_sale_price');
    if (salePrice) salePrice.value = salePriceVal > 0 ? salePriceVal.toFixed(2) : '';

    const mrpPrice = document.getElementById('mpp_mrp_price');
    if (mrpPrice) mrpPrice.value = mrpPriceVal > 0 ? mrpPriceVal.toFixed(2) : '';

    const batchInp = document.getElementById('mpp_batch');
    if (batchInp && !batchInp.value) {
        batchInp.value = 'BT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
    }

    const ctnQty = document.getElementById('mpp_ctn_qty');
    if (ctnQty) {
        ctnQty.value = '0';
        ctnQty.focus();
    }
    const loosePcs = document.getElementById('mpp_loose_pcs');
    if (loosePcs) loosePcs.value = '0';
    const paidPcs = document.getElementById('mpp_paid_pcs');
    if (paidPcs) paidPcs.value = '0';
    const freePcs = document.getElementById('mpp_free_pcs');
    if (freePcs) freePcs.value = '0';
};

window.mpp_getPackSize = function() {
    if (!mpp_selected_product) return 1;
    const p = mpp_selected_product;
    return parseInt(p.Pack_Size || p.pack_size || p.upc || p.Carton_Size || 1) || 1;
};

window.mpp_calcFromCtn = function() {
    const packSize = mpp_getPackSize();
    const ctn = Math.max(0, parseInt(document.getElementById('mpp_ctn_qty')?.value) || 0);
    const loose = Math.max(0, parseInt(document.getElementById('mpp_loose_pcs')?.value) || 0);
    const paid = (ctn * packSize) + loose;
    const paidEl = document.getElementById('mpp_paid_pcs');
    if (paidEl) paidEl.value = paid;
};

window.mpp_calcFromLoose = function() {
    mpp_calcFromCtn();
};

window.mpp_calcFromPaid = function() {
    const packSize = mpp_getPackSize();
    const paid = Math.max(0, parseInt(document.getElementById('mpp_paid_pcs')?.value) || 0);
    const ctn = Math.floor(paid / packSize);
    const loose = paid % packSize;
    const ctnEl = document.getElementById('mpp_ctn_qty');
    if (ctnEl) ctnEl.value = ctn;
    const looseEl = document.getElementById('mpp_loose_pcs');
    if (looseEl) looseEl.value = loose;
};

window.mpp_calcFromCtnCost = function() {
    const packSize = mpp_getPackSize();
    const ctnCost = parseFloat(document.getElementById('mpp_ctn_cost')?.value) || 0;
    const unitEl = document.getElementById('mpp_unit_cost');
    if (unitEl && packSize > 0) {
        unitEl.value = (ctnCost / packSize).toFixed(2);
    }
};

window.mpp_calcFromUnitCost = function() {
    const packSize = mpp_getPackSize();
    const unitCost = parseFloat(document.getElementById('mpp_unit_cost')?.value) || 0;
    const ctnEl = document.getElementById('mpp_ctn_cost');
    if (ctnEl) {
        ctnEl.value = (unitCost * packSize).toFixed(2);
    }
};

window.mpp_addItem = function() {
    if (!mpp_selected_product) {
        return showAlertModal("Select Product", "Please search and select a product first.");
    }
    const p = mpp_selected_product;
    const pId = p.Product_ID || p.product_id;
    const pName = p.Product_Name || p.product_name;

    const ctn = Math.max(0, parseInt(document.getElementById('mpp_ctn_qty')?.value) || 0);
    const loose = Math.max(0, parseInt(document.getElementById('mpp_loose_pcs')?.value) || 0);
    const paid = Math.max(0, parseInt(document.getElementById('mpp_paid_pcs')?.value) || 0);
    const free = Math.max(0, parseInt(document.getElementById('mpp_free_pcs')?.value) || 0);

    const inboundStk = paid + free;
    if (inboundStk <= 0) {
        return showAlertModal("Validation", "Please enter quantity (Paid PCS or Free PCS) greater than 0.");
    }

    const unitCost = Math.max(0, parseFloat(document.getElementById('mpp_unit_cost')?.value) || 0);
    const salePrice = Math.max(0, parseFloat(document.getElementById('mpp_sale_price')?.value) || 0);
    const mrpPrice = Math.max(0, parseFloat(document.getElementById('mpp_mrp_price')?.value) || 0);
    const batch = document.getElementById('mpp_batch')?.value?.trim() || ('BT-' + Date.now().toString().slice(-6));
    const expiry = document.getElementById('mpp_expiry')?.value?.trim() || '2028-12-31';

    const lineTotal = Math.round(paid * unitCost);

    mpp_cart.push({
        id: pId,
        name: pName,
        batch: batch,
        expiry: expiry,
        ctnQty: ctn,
        loosePcs: loose,
        paidQty: paid,
        freeQty: free,
        inboundStk: inboundStk,
        unitCost: unitCost,
        salePrice: salePrice,
        mrpPrice: mrpPrice,
        total: lineTotal
    });

    // Reset entry fields
    mpp_selected_product = null;
    const searchInp = document.getElementById('mpp_prod_search');
    if (searchInp) {
        searchInp.value = '';
        searchInp.focus();
    }
    const batchInp = document.getElementById('mpp_batch');
    if (batchInp) batchInp.value = '';
    const ctnQty = document.getElementById('mpp_ctn_qty');
    if (ctnQty) ctnQty.value = '0';
    const loosePcs = document.getElementById('mpp_loose_pcs');
    if (loosePcs) loosePcs.value = '0';
    const paidPcs = document.getElementById('mpp_paid_pcs');
    if (paidPcs) paidPcs.value = '0';
    const freePcs = document.getElementById('mpp_free_pcs');
    if (freePcs) freePcs.value = '0';
    const ctnCost = document.getElementById('mpp_ctn_cost');
    if (ctnCost) ctnCost.value = '';
    const unitCostEl = document.getElementById('mpp_unit_cost');
    if (unitCostEl) unitCostEl.value = '';
    const salePriceEl = document.getElementById('mpp_sale_price');
    if (salePriceEl) salePriceEl.value = '';
    const mrpPriceEl = document.getElementById('mpp_mrp_price');
    if (mrpPriceEl) mrpPriceEl.value = '';

    mpp_renderTable();
};

window.mpp_removeItem = function(idx) {
    mpp_cart.splice(idx, 1);
    mpp_renderTable();
};

window.mpp_renderTable = function() {
    const tbody = document.getElementById('mpp_table_body');
    const emptyRow = document.getElementById('mpp_empty_row');
    const grandTotalEl = document.getElementById('mpp_grand_total');

    if (!tbody) return;

    if (!mpp_cart.length) {
        tbody.innerHTML = '';
        if (emptyRow) emptyRow.style.display = 'block';
        if (grandTotalEl) grandTotalEl.textContent = '৳ 0';
        return;
    }

    if (emptyRow) emptyRow.style.display = 'none';

    let grandTotal = 0;
    tbody.innerHTML = mpp_cart.map((item, idx) => {
        grandTotal += item.total;
        return `
            <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.86rem;">
                <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; max-width: 220px; word-break: break-word;">
                    ${escapeHtml(item.name)}
                </td>
                <td style="padding: 10px 10px; color: #475569; font-size: 0.8rem; font-family: monospace;">
                    ${escapeHtml(item.batch)}
                </td>
                <td style="padding: 10px 10px; color: #64748b; font-size: 0.8rem;">
                    ${escapeHtml(item.expiry)}
                </td>
                <td style="padding: 10px 8px; text-align: center; font-weight: 700; color: #0f172a;">
                    ${item.paidQty}
                </td>
                <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #16a34a;">
                    ${item.freeQty > 0 ? `<span style="background: #dcfce7; padding: 2px 8px; border-radius: 12px; font-size: 0.78rem;">${item.freeQty}</span>` : '0'}
                </td>
                <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #2563eb;">
                    ${item.inboundStk}
                </td>
                <td style="padding: 10px 10px; text-align: right; color: #334155;">
                    ৳ ${item.unitCost.toFixed(2)}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0f172a;">
                    ৳ ${formatBD(item.total)}
                </td>
                <td style="padding: 10px 8px; text-align: center;">
                    <button type="button" onclick="mpp_removeItem(${idx})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; font-size: 0.9rem;" title="Remove Item">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (grandTotalEl) {
        grandTotalEl.textContent = `৳ ${formatBD(grandTotal)}`;
    }
};

window.mpp_submit = function() {
    if (isMppProcessing) return;

    if (!mpp_cart.length) {
        return showAlertModal("Validation", "Please add at least one product before saving the purchase.");
    }

    const whId = document.getElementById('mpp_warehouse_select')?.value;
    if (!whId) {
        return showAlertModal("Validation", "Please select a Destination Warehouse.");
    }

    const suppId = document.getElementById('mpp_supplier_select')?.value;
    if (!suppId) {
        return showAlertModal("Validation", "Please select a Supplier.");
    }

    const pDate = document.getElementById('mpp_purchase_date')?.value || new Date().toISOString().split('T')[0];
    const invoiceNo = 'PO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);

    const saveBtn = document.getElementById('mpp_btn_save');
    const origHtml = saveBtn ? saveBtn.innerHTML : '';

    isMppProcessing = true;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    const payload = {
        warehouseId: whId,
        supplierId: suppId,
        date: pDate,
        invoiceNo: invoiceNo,
        items: mpp_cart.map(i => ({
            id: i.id,
            name: i.name,
            batch: i.batch,
            expiry: i.expiry,
            qty: i.paidQty,
            freeQty: i.freeQty,
            price: i.unitCost,
            salePrice: i.salePrice,
            mrpPrice: i.mrpPrice,
            total: i.total
        }))
    };

    google.script.run
        .withSuccessHandler(res => {
            isMppProcessing = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = origHtml;
            }
            if (res && res.success) {
                closeModal('multiPurchaseModal');
                showAlertModal("Purchase Inbound Saved", `Successfully recorded ${mpp_cart.length} items with PO number: ${res.purchaseId || invoiceNo}`);
                loadPurchasesData();
                if (window.loadDashboardData) loadDashboardData();
                if (window.loadWarehouseInfoData) loadWarehouseInfoData();
                if (window.loadInventoryData) loadInventoryData();
            } else {
                showAlertModal("Error", (res && res.error) || "Failed to process purchase entry.");
            }
        })
        .withFailureHandler(err => {
            isMppProcessing = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = origHtml;
            }
            showAlertModal("Error", (err && err.message) ? err.message : "Failed to record purchase.");
        })
        .createBulkPurchase(payload);
};

// Close dropdown on outside click
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mpp_prod_dropdown');
    const searchInp = document.getElementById('mpp_prod_search');
    if (dropdown && searchInp && !dropdown.contains(e.target) && e.target !== searchInp) {
        dropdown.style.display = 'none';
    }
});
