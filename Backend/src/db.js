import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Support configurable persistent data directory (useful when packaged)
// If PROTOTIPO_DATA_DIR is set (absolute path), use it. Otherwise fall back to repo Backend/data.
const configuredDataDir = process.env.PROTOTIPO_DATA_DIR && String(process.env.PROTOTIPO_DATA_DIR).trim().length > 0
  ? path.resolve(String(process.env.PROTOTIPO_DATA_DIR))
  : path.resolve('Backend', 'data');

const configuredUploadsDir = process.env.PROTOTIPO_UPLOADS_DIR && String(process.env.PROTOTIPO_UPLOADS_DIR).trim().length > 0
  ? path.resolve(String(process.env.PROTOTIPO_UPLOADS_DIR))
  : path.resolve('Backend', 'uploads');

const dataDir = configuredDataDir;
const uploadsDir = configuredUploadsDir;
const dbPath = path.join(dataDir, 'app.db');
const require = createRequire(import.meta.url);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const SQL = await initSqlJs({
  locateFile: (file) => require.resolve(`sql.js/dist/${file}`)
});

export const db = fs.existsSync(dbPath)
  ? new SQL.Database(fs.readFileSync(dbPath))
  : new SQL.Database();

export function persistDatabase() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

db.exec(`
  CREATE TABLE IF NOT EXISTS module_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    record_id INTEGER,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

persistDatabase();

function allRows(query, parameters = []) {
  const statement = db.prepare(query);
  try {
    statement.bind(parameters);
    const rows = [];
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
    return rows;
  } finally {
    statement.free();
  }
}

function oneRow(query, parameters = []) {
  return allRows(query, parameters)[0] || null;
}

const moduleSeeds = {
  products: [
    { name: 'Arroz bolsa 5kg', sku: 'ALI-001', category: 'Alimentos', stock: 120, unit: 'bolsas', cost: 4.5, salePrice: 6.5, minStock: 30, status: 'Activo', notes: 'Rotacion alta' },
    { name: 'Aceite vegetal 1L', sku: 'ABA-014', category: 'Abarrotes', stock: 84, unit: 'botellas', cost: 2.8, salePrice: 4.2, minStock: 20, status: 'Activo', notes: 'Revisar fechas' }
  ],
  suppliers: [
    { name: 'Distribuidora Central', contact: 'María Perez', phone: '0999999999', email: 'central@proveedores.local', category: 'Alimentos', leadTime: '48h', rating: 'A', status: 'Activo', notes: 'Entrega puntual' },
    { name: 'Mayorista Sur', contact: 'Carlos Ruiz', phone: '0988888888', email: 'sur@proveedores.local', category: 'Higiene', leadTime: '72h', rating: 'B', status: 'Activo', notes: 'Precios variables' }
  ],
  product_values: [
    { product: 'Arroz bolsa 5kg', cost: 4.5, salePrice: 6.5, discount: 0.2, margin: 30, updatedOn: '2026-05-18', notes: 'Precio por temporada' },
    { product: 'Aceite vegetal 1L', cost: 2.8, salePrice: 4.2, discount: 0, margin: 33, updatedOn: '2026-05-18', notes: 'Margen sugerido' }
  ],
  inventory_control: [
    { product: 'Arroz bolsa 5kg', purchaseValue: 4.5, saleValue: 6.5, expiryDate: '2026-10-01', entryDate: '2026-05-18', quantity: 120, marketValue: 6.2, notes: 'Control principal de rotacion' },
    { product: 'Aceite vegetal 1L', purchaseValue: 2.8, saleValue: 4.2, expiryDate: '2026-08-20', entryDate: '2026-05-18', quantity: 84, marketValue: 4.1, notes: 'Lote de reposicion' }
  ],
  sales: [
    { date: '2026-05-18', product: 'Arroz bolsa 5kg', quantity: 5, unitPrice: 6.5, total: 32.5, customer: 'Cliente mostrador', paymentMethod: 'Efectivo', status: 'Cerrada', notes: 'Venta diaria' },
    { date: '2026-05-18', product: 'Aceite vegetal 1L', quantity: 2, unitPrice: 4.2, total: 8.4, customer: 'Cliente fiel', paymentMethod: 'Transferencia', status: 'Cerrada', notes: 'Pago confirmado' }
  ],
  reports: [
    { title: 'Reporte diario', period: 'Diario', metric: 'Ventas', result: 40.9, notes: 'Resumen del dia' },
    { title: 'Reporte de stock', period: 'Semanal', metric: 'Inventario', result: 2, notes: 'Productos bajo minimo' }
  ]
};

function seedModule(moduleName, records) {
  const total = oneRow('SELECT COUNT(*) AS total FROM module_records WHERE module = ?', [moduleName]);

  if (total.total !== 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO module_records (module, data_json)
    VALUES (?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (const record of records) {
      insert.run([moduleName, JSON.stringify(record)]);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    insert.free();
  }

  persistDatabase();
}

Object.entries(moduleSeeds).forEach(([moduleName, records]) => seedModule(moduleName, records));

function parseData(row) {
  return {
    ...row,
    data: JSON.parse(row.data_json)
  };
}

export function listModuleRecords(moduleName) {
  return allRows('SELECT * FROM module_records WHERE module = ? ORDER BY datetime(created_at) DESC, id DESC', [moduleName]).map(parseData);
}

export function getModuleRecord(id) {
  const row = oneRow('SELECT * FROM module_records WHERE id = ?', [id]);
  return row ? parseData(row) : null;
}

export function createModuleRecord(moduleName, data) {
  const statement = db.prepare(`
    INSERT INTO module_records (module, data_json, updated_at)
    VALUES (?, ?, datetime('now'))
  `);

  statement.run([moduleName, JSON.stringify(data)]);
  statement.free();
  persistDatabase();
  return listModuleRecords(moduleName)[0];
}

export function updateModuleRecord(id, data) {
  const existing = getModuleRecord(id);
  if (!existing) {
    return null;
  }

  const statement = db.prepare(`
    UPDATE module_records
    SET data_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  statement.run([JSON.stringify(data), id]);
  statement.free();
  persistDatabase();
  return getModuleRecord(id);
}

export function deleteModuleRecord(id) {
  const statement = db.prepare('DELETE FROM module_records WHERE id = ?');
  statement.run([id]);
  statement.free();
  persistDatabase();
}

export function dashboardSummary() {
  const moduleNames = ['products', 'suppliers', 'product_values', 'inventory_control', 'sales', 'reports'];
  const summary = {};

  for (const moduleName of moduleNames) {
    summary[moduleName] = oneRow('SELECT COUNT(*) AS total FROM module_records WHERE module = ?', [moduleName]).total;
  }

  const sales = listModuleRecords('sales').map((entry) => entry.data);
  const products = listModuleRecords('products').map((entry) => entry.data);
  const lowStock = products.filter((product) => Number(product.stock || 0) <= Number(product.minStock || 0)).length;
  const totalSales = sales.reduce((accumulator, sale) => accumulator + Number(sale.total || 0), 0);

  return {
    modules: summary,
    lowStock,
    totalSales: Number(totalSales.toFixed(2)),
    documents: oneRow('SELECT COUNT(*) AS total FROM documents').total
  };
}

export function listDocuments() {
  return allRows('SELECT * FROM documents ORDER BY datetime(created_at) DESC, id DESC');
}

export function createDocument(document) {
  const statement = db.prepare(`
    INSERT INTO documents (module, record_id, original_name, stored_name, mime_type, size, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  statement.run([
    document.module,
    document.record_id ?? null,
    document.original_name,
    document.stored_name,
    document.mime_type,
    document.size,
    document.description || ''
  ]);
  statement.free();
  persistDatabase();
  return listDocuments()[0];
}

export function getDocument(id) {
  return oneRow('SELECT * FROM documents WHERE id = ?', [id]);
}

export function deleteDocument(id) {
  const statement = db.prepare('DELETE FROM documents WHERE id = ?');
  statement.run([id]);
  statement.free();
  persistDatabase();
}

export function getUploadsDir() {
  return uploadsDir;
}

export function flattenRecord(record) {
  return {
    id: record.id,
    module: record.module,
    created_at: record.created_at,
    updated_at: record.updated_at,
    ...record.data
  };
}
