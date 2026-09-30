/**
 * shoPPilot IMS - Data Management & Bulk Data Importer Module
 * Provides sample CSV templates, data export, CSV parser, preview, and bulk database upload
 */

// Complete Schema Metadata & Sample Data for all core tables
export const DATA_TABLES = [
  {
    id: 'customers',
    sheetName: 'Customers',
    name: 'Customers Directory',
    category: 'Master Data',
    icon: 'fas fa-users',
    primaryKey: 'customer_id',
    description: 'Customer contact info, customer types (Retail/Wholesale), and opening receivables balance',
    headers: ['customer_id', 'customer_name', 'customer_type', 'phone', 'email', 'address', 'opening_due', 'current_due', 'status'],
    sampleCSV: `customer_id,customer_name,customer_type,phone,email,address,opening_due,current_due,status
CST1001,Al-Madina Traders,Wholesale,01711223344,madina@example.com,Moulovi Bazar Dhaka,12500,12500,Active
CST1002,Rahman General Store,Retail,01822334455,rahman@example.com,Chawkbazar Dhaka,0,0,Active
CST1003,Prime Consumer Corp,Corporate,01933445566,prime@example.com,Gulshan-1 Dhaka,45000,45000,Active`
  },
  {
    id: 'products',
    sheetName: 'Products',
    name: 'Products Master',
    category: 'Master Data',
    icon: 'fas fa-boxes',
    primaryKey: 'product_id',
    description: 'Product catalog, barcode/SKU, category, brand, pack size (UPC), cost price, and retail sale price',
    headers: ['product_id', 'product_name', 'category_id', 'brand_id', 'upc', 'unit_price', 'sale_price', 'mrp_price', 'stock', 'reorder_level', 'expiry_date', 'status'],
    sampleCSV: `product_id,product_name,category_id,brand_id,upc,unit_price,sale_price,mrp_price,stock,reorder_level,expiry_date,status
P1001,Parachute Pure Coconut Oil 200ml,C0001,B0003,24,110.00,135.00,145.00,120,20,2027-12-31,Active
P1002,Dettol Original Soap 75g (Pack of 3),C0002,B0002,48,95.00,118.00,125.00,240,30,2028-06-30,Active
P1003,Vasmol Black Henna Cream 12ml,C0001,B0001,192,20.00,25.00,30.00,500,50,2027-08-31,Active`
  },
  {
    id: 'transactions_purchase',
    sheetName: 'Transactions_Purchase',
    name: 'Purchases (Supplier POs)',
    category: 'Transactions',
    icon: 'fas fa-history',
    primaryKey: 'purchase_id',
    description: 'Inbound stock purchase entries, batch numbers, supplier purchases, cost price, and quantities',
    headers: ['purchase_id', 'date', 'warehouse_id', 'supplier_id', 'product_id', 'batch_no', 'expiry_date', 'quantity', 'unit_price', 'sale_price', 'mrp_price', 'total', 'created_by'],
    sampleCSV: `purchase_id,date,warehouse_id,supplier_id,product_id,batch_no,expiry_date,quantity,unit_price,sale_price,mrp_price,total,created_by
PU1001,2026-09-01,W001,S0001,P1001,BAT-2026-01,2027-12-31,100,110.00,135.00,145.00,11000.00,Admin
PU1002,2026-09-02,W001,S0002,P1002,BAT-2026-02,2028-06-30,200,95.00,118.00,125.00,19000.00,Admin`
  },
  {
    id: 'transactions_sales',
    sheetName: 'Transactions_Sales',
    name: 'Sales Invoices & Orders',
    category: 'Transactions',
    icon: 'fas fa-shopping-cart',
    primaryKey: 'sale_id',
    description: 'Customer sales memos, line item quantities, discounts, net totals, payment types, and dues',
    headers: ['sale_id', 'invoice_no', 'memo_no', 'date', 'customer_id', 'warehouse_id', 'product_id', 'batch_no', 'quantity', 'sale_price', 'gross_total', 'discount', 'net_total', 'payment_type', 'paid_amount', 'due_amount', 'created_by'],
    sampleCSV: `sale_id,invoice_no,memo_no,date,customer_id,warehouse_id,product_id,batch_no,quantity,sale_price,gross_total,discount,net_total,payment_type,paid_amount,due_amount,created_by
SA1001,INV-2026-0001,MEMO-401,2026-09-05,CST1001,W001,P1001,BAT-2026-01,10,135.00,1350.00,50.00,1300.00,Cash,1300.00,0.00,Admin
SA1002,INV-2026-0002,MEMO-402,2026-09-06,CST1002,W001,P1002,BAT-2026-02,20,118.00,2360.00,0.00,2360.00,Credit,1000.00,1360.00,Admin`
  },
  {
    id: 'inventory_ledger',
    sheetName: 'Inventory_Ledger',
    name: 'Inventory Movement Ledger',
    category: 'Transactions',
    icon: 'fas fa-clipboard-list',
    primaryKey: 'ledger_id',
    description: 'Stock audit trail for all IN / OUT movements, reference numbers, and balance checkpoints',
    headers: ['ledger_id', 'date', 'product_id', 'warehouse_id', 'batch_no', 'type', 'reference_id', 'quantity', 'balance_stock', 'note'],
    sampleCSV: `ledger_id,date,product_id,warehouse_id,batch_no,type,reference_id,quantity,balance_stock,note
L1001,2026-09-01,P1001,W001,BAT-2026-01,IN,PU1001,100,100,Inbound purchase stock receipt
L1002,2026-09-05,P1001,W001,BAT-2026-01,OUT,INV-2026-0001,10,90,Customer sales delivery`
  },
  {
    id: 'customer_payments',
    sheetName: 'Customer_Payments',
    name: 'Customer Payments (Receivables)',
    category: 'Finance',
    icon: 'fas fa-hand-holding-usd',
    primaryKey: 'payment_id',
    description: 'Payment receipts collected against customer dues, invoice numbers, bank or cash modes',
    headers: ['payment_id', 'date', 'customer_id', 'invoice_no', 'memo_no', 'category', 'bank_name', 'amount', 'payment_mode', 'narration', 'created_by'],
    sampleCSV: `payment_id,date,customer_id,invoice_no,memo_no,category,bank_name,amount,payment_mode,narration,created_by
PAY1001,2026-09-10,CST1001,INV-2026-0001,MEMO-401,Customer Payment,BRAC Bank PLC,1300.00,Bank,Online clearance receipt,Admin
PAY1002,2026-09-12,CST1002,INV-2026-0002,MEMO-402,Customer Payment,,1000.00,Cash,Direct shop cash collection,Admin`
  },
  {
    id: 'deposits',
    sheetName: 'Deposits',
    name: 'Cash Book / Bank Deposits',
    category: 'Finance',
    icon: 'fas fa-money-check-alt',
    primaryKey: 'deposit_id',
    description: 'Cash transfers to bank accounts or internal settlement deposits',
    headers: ['deposit_id', 'date', 'deposit_type', 'destination', 'slip_no', 'amount', 'note', 'created_by'],
    sampleCSV: `deposit_id,date,deposit_type,destination,slip_no,amount,note,created_by
DP1001,2026-09-12,Bank Deposit,BRAC Bank PLC,DEP-9812,15000.00,Daily cash counter bank deposit,Admin
DP1002,2026-09-15,Bank Deposit,Islami Bank Bangladesh,DEP-9815,25000.00,Weekly revenue bank transfer,Admin`
  },
  {
    id: 'expenses',
    sheetName: 'Expenses',
    name: 'Operating Expenses',
    category: 'Finance',
    icon: 'fas fa-receipt',
    primaryKey: 'expense_id',
    description: 'Operational store expenditures, rent, salaries, utilities, and delivery costs',
    headers: ['expense_id', 'date', 'category', 'amount', 'note', 'created_by'],
    sampleCSV: `expense_id,date,category,amount,note,created_by
EXP1001,2026-09-02,Electricity & Utilities,3400.00,Monthly warehouse electricity bill,Admin
EXP1002,2026-09-05,Shop Rent,18000.00,September outlet rent settlement,Admin
EXP1003,2026-09-10,Transport & Delivery,1250.00,Courier and local goods freight,Admin`
  },
  {
    id: 'settings_banks',
    sheetName: 'Settings_Banks',
    name: 'Bank Accounts Master',
    category: 'Settings & Taxonomies',
    icon: 'fas fa-university',
    primaryKey: 'bank_id',
    description: 'Company bank accounts directory for deposits and customer collections',
    headers: ['bank_id', 'bank_name', 'status'],
    sampleCSV: `bank_id,bank_name,status
BK0001,Islami Bank Bangladesh,Active
BK0002,BRAC Bank PLC,Active
BK0003,Dutch-Bangla Bank,Active
BK0004,City Bank Ltd,Active`
  },
  {
    id: 'settings_expense_categories',
    sheetName: 'Settings_Expense_Categories',
    name: 'Expense Categories',
    category: 'Settings & Taxonomies',
    icon: 'fas fa-tags',
    primaryKey: 'ec_id',
    description: 'Category labels for operating expenditures (Rent, Salary, Utilities, etc.)',
    headers: ['ec_id', 'category_name', 'status'],
    sampleCSV: `ec_id,category_name,status
EC0001,Shop Rent,Active
EC0002,Staff Salary,Active
EC0003,Electricity & Utilities,Active
EC0004,Transport & Delivery,Active
EC0005,Office Stationary & Tea,Active`
  },
  {
    id: 'warehouses',
    sheetName: 'Warehouses',
    name: 'Warehouses & Locations',
    category: 'Master Data',
    icon: 'fas fa-warehouse',
    primaryKey: 'warehouse_id',
    description: 'Physical warehouse hubs, distribution depots, and stock locations',
    headers: ['warehouse_id', 'warehouse_name', 'location', 'status'],
    sampleCSV: `warehouse_id,warehouse_name,location,status
W001,MouloviBazar Hub,Dhaka North,Active
W002,Begumganj 2,Noakhali,Active
W003,Begumganj 3,Noakhali,Active
W004,Armanitola Depot,Old Dhaka,Active`
  },
  {
    id: 'suppliers',
    sheetName: 'Suppliers',
    name: 'Suppliers & Vendors',
    category: 'Master Data',
    icon: 'fas fa-truck-loading',
    primaryKey: 'supplier_id',
    description: 'Vendor master records, contacts, and purchasing sources',
    headers: ['supplier_id', 'supplier_name', 'contact_person', 'phone', 'status'],
    sampleCSV: `supplier_id,supplier_name,contact_person,phone,status
S0001,Unilever Bangladesh Ltd,Tareq Rahman,01912345678,Active
S0002,Square Consumer Products,Farhan Ahmed,01812345678,Active
S0003,Marico Bangladesh,Nasir Uddin,01712345678,Active`
  },
  {
    id: 'categories',
    sheetName: 'Categories',
    name: 'Product Categories',
    category: 'Settings & Taxonomies',
    icon: 'fas fa-folder-open',
    primaryKey: 'category_id',
    description: 'Product taxonomy classifications (Hair Care, Skin Care, etc.)',
    headers: ['category_id', 'category_name', 'status'],
    sampleCSV: `category_id,category_name,status
C0001,Hair Care,Active
C0002,Skin Care,Active
C0003,Baby Care,Active
C0004,Oral Care,Active
C0005,Olive Oil,Active`
  },
  {
    id: 'brands',
    sheetName: 'Brands',
    name: 'Brands Directory',
    category: 'Settings & Taxonomies',
    icon: 'fas fa-copyright',
    primaryKey: 'brand_id',
    description: 'Manufacturer and brand directory for product categorization',
    headers: ['brand_id', 'brand_name', 'status'],
    sampleCSV: `brand_id,brand_name,status
B0001,Vasmol,Active
B0002,Dettol,Active
B0003,Parachute,Active
B0004,Sesa,Active
B0005,Figaro,Active`
  },
  {
    id: 'settings_customer_types',
    sheetName: 'Settings_Customer_Types',
    name: 'Customer Types',
    category: 'Settings & Taxonomies',
    icon: 'fas fa-user-tag',
    primaryKey: 'ct_id',
    description: 'Customer classification tiers (Retail, Wholesale, Corporate, Dealer)',
    headers: ['ct_id', 'type_name', 'status'],
    sampleCSV: `ct_id,type_name,status
CT0001,Retail,Active
CT0002,Wholesale,Active
CT0003,Corporate,Active
CT0004,Distributor,Active
CT0005,Dealer,Active`
  }
];

// State for active bulk upload
let activeParsedRows = [];
let activeParsedHeaders = [];
let activeSelectedTable = 'customers';
let activeTableCounts = {};

/**
 * Initialize Data Management View
 */
export async function initDataManagementView() {
  const container = document.getElementById('view_data_management');
  if (!container) return;

  // Render initial frame if empty
  if (!document.getElementById('dmUploadStudio')) {
    renderDataManagementLayout();
  }

  // Refresh counts
  await refreshTableCounts();
}

/**
 * Render complete Data Management UI Layout
 */
function renderDataManagementLayout() {
  const container = document.getElementById('view_data_management');
  if (!container) return;

  container.innerHTML = `
    <div class="page-header dm-page-header" style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #4361ee; color: white; border-radius: 8px; font-size: 1.1rem; flex-shrink: 0; box-shadow: 0 3px 8px rgba(67, 97, 238, 0.25);">
          <i class="fas fa-database"></i>
        </span>
        <div>
          <h1 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.3;">Data Management & Bulk Importer</h1>
          <p class="subtitle" style="margin: 3px 0 0; color: #64748b; font-size: 0.82rem;">Bulk upload legacy data, download sample CSV templates, inspect schemas, and backup tables</p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary" onclick="window.refreshTableCounts()" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border-radius: 7px;">
          <i class="fas fa-sync-alt"></i> Refresh Counts
        </button>
        <button type="button" class="btn btn-secondary" onclick="if(window.openSupabaseConfigModal) window.openSupabaseConfigModal()" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border-radius: 7px;">
          <i class="fas fa-plug"></i> Database Setup
        </button>
      </div>
    </div>

    <!-- 1. BULK UPLOAD STUDIO CARD -->
    <div id="dmUploadStudio" class="chart-card" style="padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="width: 28px; height: 28px; background: #e0e7ff; color: #4361ee; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.9rem;">
            <i class="fas fa-file-import"></i>
          </span>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #1e293b; margin: 0;">Bulk Upload Studio</h3>
            <p style="font-size: 0.78rem; color: #64748b; margin: 2px 0 0;">Upload CSV or TXT spreadsheet files directly into system tables</p>
          </div>
        </div>
        <div id="dmActiveTableCountBadge" style="font-size: 0.78rem; font-weight: 600; color: #4361ee; background: #eff6ff; padding: 3px 10px; border-radius: 20px;">
          Select a table below
        </div>
      </div>

      <!-- Step 1 & Step 2 Controls Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 16px;">
        <!-- Table Selector -->
        <div>
          <label style="font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">
            1. Select Target Table:
          </label>
          <select id="dmTableSelect" class="form-control" onchange="window.selectDataManagementTable(this.value)" style="font-size: 0.85rem; font-weight: 600; height: 38px; border-radius: 8px;">
            ${DATA_TABLES.map(t => `<option value="${t.id}">${t.name} (${t.sheetName})</option>`).join('')}
          </select>
        </div>

        <!-- Sample Template Action -->
        <div>
          <label style="font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">
            2. Get Sample Template:
          </label>
          <button type="button" class="btn btn-secondary" onclick="window.downloadSelectedSampleCSV()" style="width: 100%; height: 38px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; background: #f8fafc; border: 1px solid #cbd5e1; color: #1e293b;">
            <i class="fas fa-file-csv" style="color: #10b981; font-size: 1rem;"></i> Download Sample CSV File
          </button>
        </div>

        <!-- Import Mode -->
        <div>
          <label style="font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">
            3. Upload Mode:
          </label>
          <select id="dmUploadMode" class="form-control" style="font-size: 0.85rem; height: 38px; border-radius: 8px;">
            <option value="append">Append (Add as new records)</option>
            <option value="upsert">Upsert (Update if ID exists, otherwise insert)</option>
          </select>
        </div>
      </div>

      <!-- Table Details & Required Columns Strip -->
      <div id="dmTableMetaStrip" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 0.8rem; color: #475569;">
        <!-- Populated dynamically -->
      </div>

      <!-- File Dropzone -->
      <div id="dmDropzone" 
           ondragover="event.preventDefault(); this.style.borderColor='#4361ee'; this.style.background='#f0f4ff';" 
           ondragleave="this.style.borderColor='#cbd5e1'; this.style.background='#fafbfc';" 
           ondrop="event.preventDefault(); this.style.borderColor='#cbd5e1'; this.style.background='#fafbfc'; window.handleDropCSV(event);"
           onclick="document.getElementById('dmFileInput').click()"
           style="border: 2px dashed #cbd5e1; border-radius: 10px; padding: 24px; text-align: center; cursor: pointer; background: #fafbfc; transition: 0.2s;">
        <input type="file" id="dmFileInput" accept=".csv, .txt" style="display: none;" onchange="window.handleFileSelected(event)">
        <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #4361ee; margin-bottom: 8px; display: block;"></i>
        <p style="margin: 0; font-weight: 600; font-size: 0.88rem; color: #1e293b;">
          Click to choose CSV file or drag and drop here
        </p>
        <span style="display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
          Supports UTF-8 CSV or comma-delimited text files
        </span>
      </div>

      <!-- Preview & Validation Container (Shown after file parsing) -->
      <div id="dmPreviewSection" style="display: none; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 0.88rem; color: #1e293b;">Data Preview:</span>
            <span id="dmParsedRowCount" style="font-size: 0.78rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">0 rows</span>
            <span id="dmParsedFileName" style="font-size: 0.78rem; color: #64748b; font-style: italic;"></span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="window.clearParsedCSV()" style="padding: 6px 12px; font-size: 0.78rem; border-radius: 6px;">
              <i class="fas fa-times"></i> Clear File
            </button>
            <button type="button" id="btnConfirmBulkUpload" class="btn btn-primary" onclick="window.executeBulkImport()" style="padding: 7px 18px; font-size: 0.85rem; font-weight: 700; border-radius: 6px; background: #10b981; border: none; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
              <i class="fas fa-check-circle"></i> Confirm & Start Bulk Upload
            </button>
          </div>
        </div>

        <div style="overflow-x: auto; max-height: 260px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <table class="table" id="dmPreviewTable" style="margin: 0; font-size: 0.76rem; width: 100%;">
            <thead id="dmPreviewThead" style="background: #f1f5f9; position: sticky; top: 0; z-index: 1;"></thead>
            <tbody id="dmPreviewTbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 2. ALL TABLES DIRECTORY GRID -->
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="font-size: 1.05rem; font-weight: 700; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-th-list" style="color: #4361ee;"></i> System Tables & Sample Templates
      </h3>
      <span style="font-size: 0.78rem; color: #64748b;">${DATA_TABLES.length} tables available</span>
    </div>

    <div class="dm-table-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
      ${DATA_TABLES.map(table => `
        <div class="chart-card dm-table-card" style="padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; transition: 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                <span style="width: 30px; height: 30px; border-radius: 6px; background: #f1f5f9; color: #4361ee; display: inline-flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0;">
                  <i class="${table.icon}"></i>
                </span>
                <div style="overflow: hidden;">
                  <h4 style="margin: 0; font-size: 0.88rem; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${table.name}</h4>
                  <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">${table.id}</span>
                </div>
              </div>
              <span id="dmCount_${table.id}" class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;">
                ...
              </span>
            </div>
            <p style="font-size: 0.76rem; color: #64748b; margin: 6px 0 10px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.7em;">
              ${table.description}
            </p>
          </div>

          <div style="display: flex; gap: 6px; border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 4px;">
            <button type="button" class="btn btn-secondary" onclick="window.downloadTableSampleCSV('${table.id}')" title="Download sample CSV template" style="flex: 1; padding: 5px 8px; font-size: 0.74rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #f8fafc;">
              <i class="fas fa-file-csv" style="color: #10b981;"></i> Sample CSV
            </button>
            <button type="button" class="btn btn-secondary" onclick="window.quickSelectTableForUpload('${table.id}')" title="Upload data to this table" style="flex: 1; padding: 5px 8px; font-size: 0.74rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; color: #4361ee; background: #eff6ff; border: 1px solid #bfdbfe;">
              <i class="fas fa-upload"></i> Upload
            </button>
            <button type="button" class="btn btn-secondary" onclick="window.exportTableDataCSV('${table.id}')" title="Export current data as CSV" style="padding: 5px 10px; font-size: 0.74rem; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="Export current data">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Select first table by default
  selectDataManagementTable(activeSelectedTable);
}

/**
 * Handle switching selected table in the Bulk Studio
 */
export function selectDataManagementTable(tableId) {
  activeSelectedTable = tableId;
  const selectElem = document.getElementById('dmTableSelect');
  if (selectElem && selectElem.value !== tableId) {
    selectElem.value = tableId;
  }

  const tableMeta = DATA_TABLES.find(t => t.id === tableId) || DATA_TABLES[0];
  const countBadge = document.getElementById('dmActiveTableCountBadge');
  const count = activeTableCounts[tableMeta.id] ?? '...';
  if (countBadge) {
    countBadge.innerHTML = `Target: <strong>${tableMeta.name}</strong> · ${count} current records`;
  }

  const strip = document.getElementById('dmTableMetaStrip');
  if (strip) {
    strip.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
        <div>
          <strong style="color: #1e293b;">Primary Key:</strong> <code style="color: #4361ee; font-weight: bold;">${tableMeta.primaryKey}</code> · 
          <strong style="color: #1e293b;">Expected Columns (${tableMeta.headers.length}):</strong> 
          <span style="font-family: monospace; font-size: 0.74rem; color: #334155;">${tableMeta.headers.join(', ')}</span>
        </div>
        <a href="javascript:void(0)" onclick="window.downloadSelectedSampleCSV()" style="color: #10b981; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          <i class="fas fa-download"></i> Download Sample
        </a>
      </div>
    `;
  }
}

/**
 * Quick select table from directory cards and scroll to Studio
 */
export function quickSelectTableForUpload(tableId) {
  selectDataManagementTable(tableId);
  const studio = document.getElementById('dmUploadStudio');
  if (studio) {
    studio.scrollIntoView({ behavior: 'smooth', block: 'start' });
    studio.style.outline = '2px solid #4361ee';
    setTimeout(() => { studio.style.outline = 'none'; }, 1000);
  }
}

/**
 * Refresh Table Record Counts
 */
export async function refreshTableCounts() {
  try {
    const res = await window.BackendService.getAllTableCounts();
    if (res && res.counts) {
      activeTableCounts = res.counts;
      DATA_TABLES.forEach(t => {
        const badge = document.getElementById(`dmCount_${t.id}`);
        if (badge) {
          const c = res.counts[t.id] ?? 0;
          badge.textContent = `${c} records`;
          badge.style.background = c > 0 ? '#ecfdf5' : '#f1f5f9';
          badge.style.color = c > 0 ? '#047857' : '#64748b';
        }
      });
      selectDataManagementTable(activeSelectedTable);
    }
  } catch (e) {
    console.warn('Could not fetch all table counts:', e);
  }
}

/**
 * Download Sample CSV Template
 */
export function downloadTableSampleCSV(tableId) {
  const table = DATA_TABLES.find(t => t.id === tableId);
  if (!table) return;

  const content = table.sampleCSV.trim() + '\n';
  downloadCSVFile(`sample_${table.id}.csv`, content);
}

export function downloadSelectedSampleCSV() {
  downloadTableSampleCSV(activeSelectedTable);
}

/**
 * Export Current Data from Table as CSV
 */
export async function exportTableDataCSV(tableId) {
  const table = DATA_TABLES.find(t => t.id === tableId);
  if (!table) return;

  try {
    const rawData = await window.BackendService.getData(table.sheetName);
    if (!Array.isArray(rawData) || rawData.length === 0) {
      if (window.showAlertModal) {
        window.showAlertModal("No Data Found", `Table "${table.name}" has no records to export yet.`);
      } else {
        alert(`Table "${table.name}" has no records to export yet.`);
      }
      return;
    }

    // Determine headers from data or schema
    const keys = table.headers;
    const headerRow = keys.join(',');
    const rows = rawData.map(item => {
      return keys.map(k => {
        const val = item[k] !== undefined ? item[k] : 
                    (item[k.toUpperCase()] !== undefined ? item[k.toUpperCase()] : 
                    (item[k.toLowerCase()] !== undefined ? item[k.toLowerCase()] : ''));
        const str = String(val === null || val === undefined ? '' : val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });

    const csvContent = [headerRow, ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSVFile(`export_${table.id}_${dateStr}.csv`, csvContent);
  } catch (e) {
    if (window.showAlertModal) {
      window.showAlertModal("Export Error", e.message);
    } else {
      alert("Export failed: " + e.message);
    }
  }
}

/**
 * File Drop & Selection Handlers
 */
export function handleDropCSV(event) {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    processCSVFile(files[0]);
  }
}

export function handleFileSelected(event) {
  const files = event.target?.files;
  if (files && files.length > 0) {
    processCSVFile(files[0]);
  }
}

function processCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseAndPreviewCSV(text, file.name);
  };
  reader.readAsText(file);
}

/**
 * Robust CSV Parsing & Preview Engine
 */
function parseAndPreviewCSV(csvText, fileName = '') {
  if (!csvText || !csvText.trim()) {
    if (window.showAlertModal) window.showAlertModal("Empty File", "The selected file is empty.");
    return;
  }

  const { headers, rows } = parseCSVText(csvText);

  if (!headers || headers.length === 0 || rows.length === 0) {
    if (window.showAlertModal) window.showAlertModal("Parse Error", "Could not detect valid CSV headers or rows.");
    return;
  }

  activeParsedHeaders = headers;
  activeParsedRows = rows;

  // Show preview container
  const previewSec = document.getElementById('dmPreviewSection');
  if (previewSec) previewSec.style.display = 'block';

  const countBadge = document.getElementById('dmParsedRowCount');
  if (countBadge) countBadge.textContent = `${rows.length} rows detected`;

  const fileNameLabel = document.getElementById('dmParsedFileName');
  if (fileNameLabel) fileNameLabel.textContent = fileName ? `(${fileName})` : '';

  // Render Table Head
  const thead = document.getElementById('dmPreviewThead');
  if (thead) {
    thead.innerHTML = `<tr>${headers.map(h => `<th style="padding: 6px 10px; font-weight: 700; color: #1e293b;">${escapeHtml(h)}</th>`).join('')}</tr>`;
  }

  // Render Table Body (first 5 sample rows)
  const tbody = document.getElementById('dmPreviewTbody');
  if (tbody) {
    const previewRows = rows.slice(0, 5);
    tbody.innerHTML = previewRows.map((r, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        ${headers.map(h => `<td style="padding: 6px 10px; color: #334155; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(String(r[h] ?? ''))}</td>`).join('')}
      </tr>
    `).join('');

    if (rows.length > 5) {
      tbody.innerHTML += `
        <tr>
          <td colspan="${headers.length}" style="text-align: center; padding: 8px; color: #64748b; font-style: italic; background: #fafafa;">
            + and ${rows.length - 5} more rows ready for import
          </td>
        </tr>
      `;
    }
  }
}

export function clearParsedCSV() {
  activeParsedRows = [];
  activeParsedHeaders = [];
  const previewSec = document.getElementById('dmPreviewSection');
  if (previewSec) previewSec.style.display = 'none';
  const fileInput = document.getElementById('dmFileInput');
  if (fileInput) fileInput.value = '';
}

/**
 * Execute Bulk Upload to Supabase / BackendService
 */
export async function executeBulkImport() {
  if (!activeParsedRows || activeParsedRows.length === 0) {
    if (window.showAlertModal) window.showAlertModal("No Data", "Please select or drop a valid CSV file first.");
    return;
  }

  const tableMeta = DATA_TABLES.find(t => t.id === activeSelectedTable) || DATA_TABLES[0];
  const mode = document.getElementById('dmUploadMode')?.value || 'append';

  const btn = document.getElementById('btnConfirmBulkUpload');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
  }

  try {
    const res = await window.BackendService.bulkUploadTableData(tableMeta.id, activeParsedRows, mode);
    
    if (res && res.success) {
      if (window.showAlertModal) {
        window.showAlertModal("Upload Successful!", `Successfully imported ${res.count} records into ${tableMeta.name}.`);
      } else {
        alert(`Successfully imported ${res.count} records into ${tableMeta.name}.`);
      }

      // Refresh table counts
      await refreshTableCounts();

      // Trigger app global metadata refreshes
      if (typeof window.loadGlobalMetadata === 'function') window.loadGlobalMetadata();
      if (typeof window.refreshMasterLists === 'function') window.refreshMasterLists();

      // Clear preview
      clearParsedCSV();
    } else {
      throw new Error(res?.error || "Bulk upload encountered an error.");
    }
  } catch (err) {
    if (window.showAlertModal) {
      window.showAlertModal("Import Failed", err.message || "Could not complete bulk import.");
    } else {
      alert("Import Failed: " + (err.message || "Error"));
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

/**
 * Helper: Pure JavaScript CSV Parser handling commas and quotes
 */
function parseCSVText(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // skip CRLF
      row.push(currentField.trim());
      if (row.some(val => val !== '')) lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(val => val !== '')) lines.push(row);
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].map(h => h.trim());
  const rows = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = line[idx] !== undefined ? line[idx] : '';
    });
    rows.push(obj);
  }

  return { headers, rows };
}

/**
 * Helper: Trigger client-side file download
 */
function downloadCSVFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Attach globally for inline HTML event handlers
window.initDataManagementView = initDataManagementView;
window.selectDataManagementTable = selectDataManagementTable;
window.quickSelectTableForUpload = quickSelectTableForUpload;
window.refreshTableCounts = refreshTableCounts;
window.downloadTableSampleCSV = downloadTableSampleCSV;
window.downloadSelectedSampleCSV = downloadSelectedSampleCSV;
window.exportTableDataCSV = exportTableDataCSV;
window.handleDropCSV = handleDropCSV;
window.handleFileSelected = handleFileSelected;
window.clearParsedCSV = clearParsedCSV;
window.executeBulkImport = executeBulkImport;
