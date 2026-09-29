/**
 * shoPPilot IMS - Application Bootstrapper
 * Connects Supabase Service with the Frontend
 */
import { initGoogleScriptRunBridge, BackendService } from './supabaseService.js';
import { getSupabaseCredentials, saveSupabaseCredentials, getSupabase } from './supabaseClient.js';
import schemaSql from '../supabase_schema.sql?raw';

// Expose on window for direct access or through the google.script.run bridge
window.BackendService = BackendService;
window.getSupabaseCredentials = getSupabaseCredentials;
window.saveSupabaseCredentials = saveSupabaseCredentials;

// Initialize the Google Apps Script bridge so all original code in index.html works unmodified!
initGoogleScriptRunBridge();

// Handle login view & session state seamlessly in client
window.checkAppAuthState = function() {
  const user = BackendService.getCurrentUser();
  const authView = document.getElementById('authView');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  const mobileBtn = document.getElementById('mobileMenuBtn');

  if (!user || !user.User_ID) {
    if (authView) authView.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (mobileBtn) mobileBtn.style.display = 'none';
  } else {
    if (authView) authView.style.display = 'none';
    if (sidebar) sidebar.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'block';

    // Update user info
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) userAvatar.textContent = (user.Name || 'U').charAt(0).toUpperCase();

    const userName = document.querySelector('.user-name');
    if (userName) userName.textContent = user.Name || user.User_ID;

    // Update role-based links
    const role = user.Role || 'Viewer';
    const settingsLink = document.querySelector("a[onclick*=\"switchAppView('settings')\"]");
    const usersLink = document.querySelector("a[onclick*=\"switchAppView('users')\"]");
    if (settingsLink) settingsLink.style.display = (role === 'Admin' || role === 'Manager') ? 'flex' : 'none';
    if (usersLink) usersLink.style.display = (role === 'Admin' || role === 'Manager') ? 'flex' : 'none';
  }
};

// Expose SQL schema globally for modal usage
window.SUPABASE_SCHEMA_SQL = schemaSql;

// Tables required by shoPPilot IMS
const REQUIRED_TABLES = [
  { name: 'products', label: 'Products Master', desc: 'SKU, pricing, category, brand, UPC' },
  { name: 'warehouse_stock', label: 'Warehouse Stock', desc: 'Multi-warehouse inventory levels' },
  { name: 'warehouses', label: 'Warehouses', desc: 'Locations (MouloviBazar, Begumganj...)' },
  { name: 'categories', label: 'Categories', desc: 'Product classifications' },
  { name: 'brands', label: 'Brands', desc: 'Brand directory' },
  { name: 'customers', label: 'Customers', desc: 'Customer name, type (Retail/Wholesale), dues' },
  { name: 'suppliers', label: 'Suppliers', desc: 'Vendor records & contacts' },
  { name: 'transactions_sales', label: 'Sales Orders', desc: 'Invoices, memos, and items' },
  { name: 'transactions_purchase', label: 'Purchases', desc: 'Inbound POs and batch costs' },
  { name: 'inventory_ledger', label: 'Stock Ledger', desc: 'IN/OUT audit trails' },
  { name: 'customer_payments', label: 'Customer Payments', desc: 'Collections & receivables' },
  { name: 'deposits', label: 'Bank Deposits', desc: 'Cash transfers & settlements' },
  { name: 'expenses', label: 'Expenses', desc: 'Operational expenditures' },
  { name: 'users', label: 'User Roles', desc: 'Authentication and permissions' },
  { name: 'settings', label: 'System Settings', desc: 'Company, currency, invoice prefix' },
  { name: 'settings_banks', label: 'Bank Accounts', desc: 'Payment deposit destinations' },
  { name: 'settings_expense_categories', label: 'Expense Types', desc: 'Rent, salaries, utility tags' },
  { name: 'settings_customer_types', label: 'Customer Types', desc: 'Retail, Wholesale, Corporate tags' }
];

// Global modal for Supabase Connection & Database Setup
window.openSupabaseConfigModal = function() {
  let modal = document.getElementById('supabaseConfigModal');
  if (!modal) {
    const div = document.createElement('div');
    div.id = 'supabaseConfigModal';
    div.className = 'modal';
    div.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(4px);';
    div.innerHTML = `
      <div class="modal-content" style="max-width: 680px; width:95%; max-height:92vh; background:#ffffff; border-radius:16px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.35); border:1px solid #e2e8f0; padding:0;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:white; padding:18px 24px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #334155;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px; height:38px; border-radius:10px; background:#10b981; display:flex; align-items:center; justify-content:center; color:white; font-size:1.1rem; box-shadow:0 4px 10px rgba(16,185,129,0.3);">
              <i class="fas fa-database"></i>
            </div>
            <div>
              <h3 style="margin:0; font-size:1.15rem; font-weight:800; letter-spacing:-0.02em; color:white;">Supabase Database Setup</h3>
              <p style="margin:0; font-size:0.75rem; color:#94a3b8;">Store all inventory, sales, purchases, and ledger data in PostgreSQL</p>
            </div>
          </div>
          <button type="button" class="btn-close" onclick="closeModal('supabaseConfigModal')" style="background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
        </div>

        <!-- Scrollable Body -->
        <div style="overflow-y:auto; padding:20px 24px; flex:1; display:flex; flex-direction:column; gap:18px;">
          
          <!-- Connection Status Card -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Connection Details</span>
              <div id="cfg_live_status_badge" style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:700; padding:4px 10px; border-radius:9999px; background:#dcfce7; color:#15803d;">
                <span style="width:7px; height:7px; border-radius:50%; background:#22c55e;"></span>
                <span>Active Project</span>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:4px;">PROJECT ID</label>
                <input type="text" id="cfg_sb_project_id" class="form-control" value="tkrttsmspgvcryfjejej" readonly style="font-size:0.85rem; font-weight:700; background:#ffffff; color:#0f172a; height:38px;">
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:4px;">PROJECT URL</label>
                <input type="text" id="cfg_sb_url" class="form-control" placeholder="https://your-project.supabase.co" style="font-size:0.85rem; background:#ffffff; height:38px;">
              </div>
            </div>

            <div>
              <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:4px;">PUBLISHABLE API KEY (ANON)</label>
              <div style="display:flex; gap:8px;">
                <input type="password" id="cfg_sb_key" class="form-control" placeholder="sb_publishable_..." style="font-size:0.82rem; font-family:monospace; background:#ffffff; height:38px;">
                <button type="button" class="btn btn-secondary" onclick="toggleSupabaseKeyVisibility()" style="height:38px; padding:0 12px;" title="Show/Hide Key">
                  <i id="cfg_sb_key_eye" class="far fa-eye"></i>
                </button>
                <button type="button" class="btn btn-primary" onclick="saveSupabaseConfigModal()" style="height:38px; padding:0 16px; font-weight:700; background:#3b82f6; white-space:nowrap;">
                  <i class="fas fa-check"></i> Update
                </button>
              </div>
            </div>
          </div>

          <!-- Step-by-Step Database Setup Banner -->
          <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:12px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <h4 style="margin:0; font-size:0.95rem; font-weight:800; color:#1e40af;">
                <i class="fas fa-magic" style="color:#3b82f6;"></i> Database Setup (Run Schema in Supabase)
              </h4>
              <span style="font-size:0.72rem; font-weight:700; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:6px;">1-Time Setup</span>
            </div>
            <p style="font-size:0.8rem; color:#3b82f6; margin:0 0 12px 0; line-height:1.45;">
              To store all products, sales, customers, and stock permanently in your Supabase database, run the complete SQL script once in your Supabase SQL Editor:
            </p>

            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <button type="button" id="btnCopySql" class="btn btn-primary" onclick="copySupabaseSql()" style="background:#10b981; border-color:#059669; font-weight:700; font-size:0.82rem; height:36px; padding:0 14px; box-shadow:0 2px 6px rgba(16,185,129,0.3);">
                <i class="fas fa-copy"></i> Copy Complete SQL Schema
              </button>
              <a href="https://supabase.com/dashboard/project/tkrttsmspgvcryfjejej/sql/new" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-weight:700; font-size:0.82rem; height:36px; padding:0 14px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #93c5fd; color:#1d4ed8;">
                <i class="fas fa-external-link-alt"></i> Open Supabase SQL Editor
              </a>
              <button type="button" class="btn btn-secondary" onclick="toggleSupabaseSqlView()" style="font-weight:600; font-size:0.82rem; height:36px; padding:0 12px; background:#ffffff; border:1px solid #cbd5e1;">
                <i class="fas fa-code"></i> <span id="btnSqlViewText">View SQL Script</span>
              </button>
            </div>

            <!-- Collapsible SQL Script Area -->
            <div id="cfg_sql_preview_area" style="display:none; margin-top:12px;">
              <textarea id="cfg_sql_textarea" readonly style="width:100%; height:160px; font-family:monospace; font-size:0.75rem; background:#0f172a; color:#a7f3d0; border-radius:8px; padding:10px; border:1px solid #334155; resize:vertical;"></textarea>
            </div>
          </div>

          <!-- Table Health Check & Verification -->
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div>
                <h4 style="margin:0; font-size:0.9rem; font-weight:800; color:#0f172a;">
                  <i class="fas fa-table" style="color:#6366f1;"></i> Database Tables Status
                </h4>
                <p style="margin:0; font-size:0.75rem; color:#64748b;">Live status of database tables in Supabase</p>
              </div>
              <div style="display:flex; gap:8px;">
                <button type="button" id="btnTestTables" class="btn btn-secondary btn-sm" onclick="testSupabaseTables()" style="font-weight:700; font-size:0.75rem; height:32px; padding:0 12px; border:1px solid #cbd5e1;">
                  <i class="fas fa-sync-alt"></i> Verify Tables
                </button>
                <button type="button" id="btnSeedData" class="btn btn-sm" onclick="seedSupabaseDemoData()" style="font-weight:700; font-size:0.75rem; height:32px; padding:0 12px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">
                  <i class="fas fa-seedling"></i> Seed Master Data
                </button>
              </div>
            </div>

            <div id="cfg_tables_grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px;">
              <!-- Populated dynamically by testSupabaseTables -->
              <div style="grid-column:1/-1; text-align:center; padding:16px; color:#64748b; font-size:0.8rem; background:#f8fafc; border-radius:8px;">
                Click <strong>"Verify Tables"</strong> to inspect table health on Supabase.
              </div>
            </div>
          </div>

          <!-- Notice -->
          <div style="font-size:0.75rem; color:#64748b; line-height:1.45; display:flex; gap:8px; align-items:flex-start;">
            <i class="fas fa-info-circle" style="color:#3b82f6; margin-top:2px;"></i>
            <span>
              If tables are not created yet, shoPPilot safely uses its local reactive store so you can test features without interruptions. Once you execute the SQL script in Supabase, data is automatically stored in your Supabase project in detail.
            </span>
          </div>

        </div>

        <!-- Footer -->
        <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 24px; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="btn btn-secondary" onclick="closeModal('supabaseConfigModal')">Close</button>
          <button type="button" class="btn btn-primary" onclick="testSupabaseTables()" style="background:#0f172a; font-weight:700;">
            <i class="fas fa-check-circle"></i> Check Live Connection
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    modal = div;
  }

  // Populate credentials
  const creds = getSupabaseCredentials();
  const urlInp = document.getElementById('cfg_sb_url');
  if (urlInp) urlInp.value = creds.url || 'https://tkrttsmspgvcryfjejej.supabase.co';
  const keyInp = document.getElementById('cfg_sb_key');
  if (keyInp) keyInp.value = creds.key || 'sb_publishable_vW3njY0ETCekPpP2yKsAlw_2DnJV3pC';

  // Populate SQL textarea
  const sqlArea = document.getElementById('cfg_sql_textarea');
  if (sqlArea) sqlArea.value = window.SUPABASE_SCHEMA_SQL || '';

  // Show modal safely
  if (modal) {
    modal.style.display = 'flex';
  }

  // Automatically run table check
  setTimeout(() => {
    testSupabaseTables();
  }, 200);
};

// Global UI & Modal Helpers
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

window.openLogoutModal = function() {
  const m = document.getElementById('logoutConfirmModal');
  if (m && m.style) m.style.display = 'flex';
};

window.executeLogout = function() {
  if (window.BackendService && typeof window.BackendService.logout === 'function') {
    window.BackendService.logout();
  } else {
    localStorage.removeItem('shoppilot_active_user');
    sessionStorage.removeItem('shoppilot_active_user');
  }
  window.location.reload();
};

// Toggle API key visibility
window.toggleSupabaseKeyVisibility = function() {
  const inp = document.getElementById('cfg_sb_key');
  const icon = document.getElementById('cfg_sb_key_eye');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.className = 'far fa-eye-slash';
  } else {
    inp.type = 'password';
    if (icon) icon.className = 'far fa-eye';
  }
};

// Toggle SQL script viewer
window.toggleSupabaseSqlView = function() {
  const area = document.getElementById('cfg_sql_preview_area');
  const btnText = document.getElementById('btnSqlViewText');
  if (!area) return;
  if (area.style.display === 'none') {
    area.style.display = 'block';
    if (btnText) btnText.textContent = 'Hide SQL Script';
  } else {
    area.style.display = 'none';
    if (btnText) btnText.textContent = 'View SQL Script';
  }
};

// Copy SQL schema to clipboard
window.copySupabaseSql = function() {
  const sql = window.SUPABASE_SCHEMA_SQL || '';
  if (!sql) return;

  const btn = document.getElementById('btnCopySql');
  const copyFn = () => {
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copied to Clipboard!';
      btn.style.background = '#059669';
      setTimeout(() => {
        btn.innerHTML = origHtml;
        btn.style.background = '#10b981';
      }, 2500);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(sql).then(copyFn).catch(() => {
      // Fallback
      fallbackCopy(sql);
      copyFn();
    });
  } else {
    fallbackCopy(sql);
    copyFn();
  }
};

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    console.error('Copy fallback failed', e);
  }
  document.body.removeChild(ta);
}

// Test and verify all Supabase tables live
window.testSupabaseTables = async function() {
  const container = document.getElementById('cfg_tables_grid');
  const btn = document.getElementById('btnTestTables');
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

  const sb = getSupabase();
  if (!sb) {
    if (container) container.innerHTML = '<div style="grid-column:1/-1; color:#ef4444; font-size:0.8rem;">Supabase client not initialized. Check URL and Key.</div>';
    if (btn) btn.innerHTML = '<i class="fas fa-sync-alt"></i> Verify Tables';
    return;
  }

  const results = [];
  for (const t of REQUIRED_TABLES) {
    try {
      const { data, error } = await sb.from(t.name).select('*', { count: 'exact', head: true });
      if (error) {
        results.push({ name: t.name, label: t.label, ok: false, msg: error.message });
      } else {
        // Table exists
        results.push({ name: t.name, label: t.label, ok: true, msg: 'Ready' });
      }
    } catch (e) {
      results.push({ name: t.name, label: t.label, ok: false, msg: e.message });
    }
  }

  if (btn) btn.innerHTML = '<i class="fas fa-sync-alt"></i> Verify Tables';

  const totalOk = results.filter(r => r.ok).length;
  const statusBadge = document.getElementById('cfg_live_status_badge');
  if (statusBadge) {
    if (totalOk === REQUIRED_TABLES.length) {
      statusBadge.style.background = '#dcfce7';
      statusBadge.style.color = '#15803d';
      statusBadge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#22c55e;"></span> All ${totalOk} Tables Ready`;
    } else if (totalOk > 0) {
      statusBadge.style.background = '#fef3c7';
      statusBadge.style.color = '#b45309';
      statusBadge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#f59e0b;"></span> ${totalOk}/${REQUIRED_TABLES.length} Tables Found`;
    } else {
      statusBadge.style.background = '#fee2e2';
      statusBadge.style.color = '#b91c1c';
      statusBadge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:#ef4444;"></span> Tables Not Created (Run SQL)`;
    }
  }

  if (container) {
    container.innerHTML = results.map(r => `
      <div style="background:${r.ok ? '#f0fdf4' : '#fff1f2'}; border:1px solid ${r.ok ? '#bbf7d0' : '#fecdd3'}; border-radius:8px; padding:8px 10px; display:flex; align-items:center; justify-content:space-between;">
        <div style="overflow:hidden;">
          <div style="font-size:0.75rem; font-weight:700; color:${r.ok ? '#166534' : '#9f1239'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${r.label}</div>
          <div style="font-size:0.65rem; color:#64748b; font-family:monospace;">${r.name}</div>
        </div>
        <div>
          ${r.ok 
            ? '<span style="color:#16a34a; font-size:0.85rem;" title="Table ready"><i class="fas fa-check-circle"></i></span>' 
            : '<span style="color:#e11d48; font-size:0.85rem;" title="Run SQL script to create"><i class="fas fa-exclamation-circle"></i></span>'}
        </div>
      </div>
    `).join('');
  }
};

// Seed Master Demo Data into Supabase
window.seedSupabaseDemoData = async function() {
  const sb = getSupabase();
  if (!sb) return alert("Supabase is not configured.");

  const btn = document.getElementById('btnSeedData');
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Seeding...';

  try {
    // 1. Settings
    const settingsRows = [
      { key: 'COMPANY_NAME', value: 'shoPPilot' },
      { key: 'CURRENCY_SYMBOL', value: '৳' },
      { key: 'INVOICE_PREFIX', value: 'INV' },
      { key: 'LOW_STOCK_ALERT_LEVEL', value: '10' },
      { key: 'LOW_STOCK_ALERT_DAYS', value: '5' },
      { key: 'EXPIRY_ALERT_DAYS', value: '30' },
      { key: 'OPENING_CASH_BALANCE', value: '25000' }
    ];
    await sb.from('settings').upsert(settingsRows);

    // 2. Warehouses
    await sb.from('warehouses').upsert([
      { warehouse_id: 'W001', warehouse_name: 'MouloviBazar', location: 'Dhaka', status: 'Active' },
      { warehouse_id: 'W002', warehouse_name: 'Begumganj 2', location: 'Noakhali', status: 'Active' },
      { warehouse_id: 'W003', warehouse_name: 'Begumganj 3', location: 'Noakhali', status: 'Active' },
      { warehouse_id: 'W004', warehouse_name: 'Armanitola', location: 'Old Dhaka', status: 'Active' }
    ]);

    // 3. Categories
    await sb.from('categories').upsert([
      { category_id: 'C0001', category_name: 'Hair Care', status: 'Active' },
      { category_id: 'C0002', category_name: 'Skin Care', status: 'Active' },
      { category_id: 'C0003', category_name: 'Baby Care', status: 'Active' },
      { category_id: 'C0004', category_name: 'Oral Care', status: 'Active' },
      { category_id: 'C0005', category_name: 'Olive Oil', status: 'Active' }
    ]);

    // 4. Brands
    await sb.from('brands').upsert([
      { brand_id: 'B0001', brand_name: 'Vasmol', status: 'Active' },
      { brand_id: 'B0002', brand_name: 'Dettol', status: 'Active' },
      { brand_id: 'B0003', brand_name: 'Parachute', status: 'Active' },
      { brand_id: 'B0004', brand_name: 'Sesa', status: 'Active' },
      { brand_id: 'B0005', brand_name: 'Figaro', status: 'Active' }
    ]);

    // 5. Customers
    await sb.from('customers').upsert([
      { customer_id: 'CST0005', customer_name: 'Nasim Store-HBL', phone: '01819887733', address: 'Habiganj Market', current_due: 23032, opening_due: 0, status: 'Active' },
      { customer_id: 'CST0001', customer_name: 'Hamidul Store-MEL', phone: '01711223344', address: 'MouloviBazar Market', current_due: 15400, opening_due: 15400, status: 'Active' },
      { customer_id: 'CST0002', customer_name: 'Masud Store-HBL', phone: '01819887766', address: 'Habiganj Bazar', current_due: 8200, opening_due: 8200, status: 'Active' },
      { customer_id: 'CST0003', customer_name: 'Hamidul Store-HBL', phone: '01819887755', address: 'Habiganj Market', current_due: 0, opening_due: 0, status: 'Active' },
      { customer_id: 'CST0004', customer_name: 'S.B.Traders-MEL', phone: '01719887744', address: 'Moulvibazar', current_due: 45173, opening_due: 45173, status: 'Active' }
    ]);

    // 6. Products
    await sb.from('products').upsert([
      { product_id: 'P0010', product_name: 'Amba Olive oil 150gm tin (80) 550/-', category_id: 'C0005', brand_id: 'B0005', upc: '80', stock: 2720, unit_price: 380, sale_price: 458.33, mrp_price: 550, status: 'Active' },
      { product_id: 'P0011', product_name: 'Lucy Olive Oil 150gm tin (80) 515/-', category_id: 'C0005', brand_id: 'B0005', upc: '80', stock: 2480, unit_price: 360, sale_price: 429, mrp_price: 515, status: 'Active' },
      { product_id: 'P0012', product_name: 'Sesa Ayurvedic 100ml 230/-', category_id: 'C0001', brand_id: 'B0004', upc: '96', stock: 12632, unit_price: 155, sale_price: 191.67, mrp_price: 230, status: 'Active' },
      { product_id: 'P0013', product_name: 'Sesa Ayurvedic 100ml 265/-', category_id: 'C0001', brand_id: 'B0004', upc: '96', stock: 165600, unit_price: 180, sale_price: 220.83, mrp_price: 265, status: 'Active' },
      { product_id: 'P0014', product_name: 'Sesa Ayurvedic 200ml 490/-', category_id: 'C0001', brand_id: 'B0004', upc: '48', stock: 1344, unit_price: 340, sale_price: 408, mrp_price: 490, status: 'Active' },
      { product_id: 'P0015', product_name: 'Sesa Ayurvedic 200ml 420/-', category_id: 'C0001', brand_id: 'B0004', upc: '48', stock: 21, unit_price: 290, sale_price: 350, mrp_price: 420, status: 'Active' },
      { product_id: 'P0016', product_name: 'Vasmol Henna Cream Hair Colour Black (12+12)ml 30/-', category_id: 'C0001', brand_id: 'B0001', upc: '192', stock: 1200, unit_price: 20, sale_price: 24, mrp_price: 30, status: 'Active' },
      { product_id: 'P0001', product_name: 'Super Vasmol 33 Kesh Kala 100ml', category_id: 'C0001', brand_id: 'B0001', upc: '24', stock: 120, unit_price: 65, sale_price: 80, mrp_price: 85, status: 'Active' },
      { product_id: 'P0002', product_name: 'Dettol Antiseptic Liquid 100ml', category_id: 'C0002', brand_id: 'B0002', upc: '12', stock: 60, unit_price: 110, sale_price: 130, mrp_price: 135, status: 'Active' }
    ]);

    // 7. Warehouse Stock
    await sb.from('warehouse_stock').upsert([
      { product_id: 'P0010', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 2720 },
      { product_id: 'P0010', warehouse_id: 'W002', warehouse_name: 'Begumganj 2', stock: 800 },
      { product_id: 'P0011', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 2480 },
      { product_id: 'P0012', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 12632 },
      { product_id: 'P0013', warehouse_id: 'W002', warehouse_name: 'Begumganj 2', stock: 165600 },
      { product_id: 'P0013', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 9600 },
      { product_id: 'P0014', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 1344 },
      { product_id: 'P0015', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 21 },
      { product_id: 'P0016', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 1200 },
      { product_id: 'P0001', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 80 },
      { product_id: 'P0002', warehouse_id: 'W001', warehouse_name: 'MouloviBazar', stock: 60 }
    ]);

    alert("Master demo data successfully seeded into Supabase!");
    testSupabaseTables();
  } catch (e) {
    alert("Seeding error: " + e.message + "\nMake sure you have run the SQL schema first.");
  } finally {
    if (btn) btn.innerHTML = '<i class="fas fa-seedling"></i> Seed Master Data';
  }
};

window.saveSupabaseConfigModal = function() {
  const url = document.getElementById('cfg_sb_url')?.value?.trim() || '';
  const key = document.getElementById('cfg_sb_key')?.value?.trim() || '';
  if (!url || !key) {
    alert("Please enter both Supabase URL and Anon Key.");
    return;
  }
  saveSupabaseCredentials(url, key);
};

// Check auth state on load
document.addEventListener('DOMContentLoaded', () => {
  window.checkAppAuthState();
});

