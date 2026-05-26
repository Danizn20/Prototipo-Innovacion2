import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import XLSX from 'xlsx';
import {
  createDocument,
  createModuleRecord,
  dashboardSummary,
  deleteDocument,
  deleteModuleRecord,
  flattenRecord,
  getDocument,
  getModuleRecord,
  getModuleRecordByName,
  getUploadsDir,
  listDocuments,
  listModuleRecords,
  updateModuleRecord
} from './db.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const uploadsDir = getUploadsDir();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDir),
  filename: (_req, file, callback) => {
    const safeName = `${Date.now()}-${file.originalname}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    callback(null, safeName);
  }
});

const upload = multer({ storage });
const memoryUpload = multer({ storage: multer.memoryStorage() });

function normalizeInventoryRow(record) {
  const quantity = Number(record.quantity || 0);
  const purchaseValue = Number(record.purchaseValue || 0);
  const saleValue = Number(record.saleValue || 0);
  const marketValue = Number(record.marketValue || 0);

  return {
    ...record,
    quantity,
    purchaseValue,
    saleValue,
    marketValue,
    investmentTotal: Number((quantity * purchaseValue).toFixed(2)),
    incomeTotal: Number((quantity * saleValue).toFixed(2)),
    marketTotal: Number((quantity * marketValue).toFixed(2)),
    projectedMargin: Number(((quantity * saleValue) - (quantity * purchaseValue)).toFixed(2))
  };
}

function buildInventoryWorkbook(records) {
  const inventoryRows = records.map(flattenRecord).map(normalizeInventoryRow);
  const summary = inventoryRows.reduce((accumulator, record) => {
    accumulator.quantity += Number(record.quantity || 0);
    accumulator.investmentTotal += Number(record.investmentTotal || 0);
    accumulator.incomeTotal += Number(record.incomeTotal || 0);
    accumulator.marketTotal += Number(record.marketTotal || 0);
    return accumulator;
  }, { quantity: 0, investmentTotal: 0, incomeTotal: 0, marketTotal: 0 });

  const workbook = XLSX.utils.book_new();
  const inventorySheet = XLSX.utils.json_to_sheet(inventoryRows.map((record) => ({
    id: record.id,
    product: record.product,
    purchaseValue: record.purchaseValue,
    saleValue: record.saleValue,
    expiryDate: record.expiryDate,
    entryDate: record.entryDate,
    quantity: record.quantity,
    marketValue: record.marketValue,
    investmentTotal: record.investmentTotal,
    incomeTotal: record.incomeTotal,
    projectedMargin: record.projectedMargin,
    notes: record.notes
  })));
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Metrica', 'Valor'],
    ['Registros', inventoryRows.length],
    ['Cantidad total', summary.quantity],
    ['Inversion total', summary.investmentTotal],
    ['Ingreso estimado', summary.incomeTotal],
    ['Valor de mercado', summary.marketTotal],
    ['Margen proyectado', Number((summary.incomeTotal - summary.investmentTotal).toFixed(2))]
  ]);

  XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventario');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
  return workbook;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Backend local de inventario listo' });
});

app.get('/api/dashboard/summary', (_req, res) => {
  res.json(dashboardSummary());
});

app.get('/api/modules/:module/records', (req, res) => {
  res.json(listModuleRecords(req.params.module));
});

app.post('/api/modules/:module/records', (req, res) => {
  const { module } = req.params;
  const data = req.body || {};

  if (module === 'sales') {
    const { products, ...saleData } = data;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'La venta debe incluir al menos un producto.' });
    }

    // 1. Validar stock para todos los productos
    for (const item of products) {
      const inventoryItem = getModuleRecordByName('inventory_control', item.productName);
      if (!inventoryItem) {
        return res.status(400).json({ message: `Producto "${item.productName}" no encontrado.` });
      }
      if (inventoryItem.data.quantity < item.quantity) {
        return res.status(400).json({ message: `Stock insuficiente para "${item.productName}".` });
      }
    }

    // 2. Crear el registro de la venta principal
    const saleRecord = createModuleRecord(module, saleData);

    // 3. Actualizar stock y registrar items de venta
    for (const item of products) {
      const inventoryItem = getModuleRecordByName('inventory_control', item.productName);
      const newStock = inventoryItem.data.quantity - item.quantity;
      updateModuleRecord(inventoryItem.id, { ...inventoryItem.data, quantity: newStock });

      db.prepare(
        'INSERT INTO sales_items (sale_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)'
      ).run(saleRecord.id, item.productName, item.quantity, item.unitPrice, item.quantity * item.unitPrice);
    }
    persistDatabase();

    return res.status(201).json(saleRecord);
  }

  const record = createModuleRecord(module, data);
  return res.status(201).json(record);
});

app.post('/api/inventory/restock', (req, res) => {
  const { productName, quantity } = req.body;

  if (!productName || !quantity) {
    return res.status(400).json({ message: 'Debes especificar el producto y la cantidad a reabastecer.' });
  }

  const inventoryItem = getModuleRecordByName('inventory_control', productName);

  if (!inventoryItem) {
    return res.status(404).json({ message: `Producto "${productName}" no encontrado en el inventario.` });
  }

  const currentStock = Number(inventoryItem.data.quantity || 0);
  const restockQuantity = Number(quantity);
  const newStock = currentStock + restockQuantity;

  updateModuleRecord(inventoryItem.id, { ...inventoryItem.data, quantity: newStock });

  // Guardar en el historial de reabastecimiento
  createModuleRecord('restock_history', {
    product_name: productName,
    quantity_added: restockQuantity,
    notes: `Reabastecimiento manual. Stock anterior: ${currentStock}, stock nuevo: ${newStock}.`
  });

  return res.json({ message: 'Reabastecimiento exitoso.', newStock });
});

app.put('/api/modules/:module/records/:id', (req, res) => {
  const existing = getModuleRecord(req.params.id);

  if (!existing || existing.module !== req.params.module) {
    return res.status(404).json({ message: 'Registro no encontrado' });
  }

  const updated = updateModuleRecord(req.params.id, req.body || {});
  return res.json(updated);
});

app.delete('/api/modules/:module/records/:id', (req, res) => {
  const existing = getModuleRecord(req.params.id);

  if (!existing || existing.module !== req.params.module) {
    return res.status(404).json({ message: 'Registro no encontrado' });
  }

  deleteModuleRecord(req.params.id);
  return res.status(204).send();
});

app.get('/api/modules/:module/export', (req, res) => {
  const records = listModuleRecords(req.params.module);
  const workbook = req.params.module === 'inventory_control'
    ? buildInventoryWorkbook(records)
    : (() => {
      const worksheet = XLSX.utils.json_to_sheet(records.map(flattenRecord));
      const createdWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(createdWorkbook, worksheet, req.params.module.slice(0, 31) || 'Datos');
      return createdWorkbook;
    })();
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.module}.xlsx`);
  return res.send(buffer);
});

app.post('/api/modules/:module/import', memoryUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Debes enviar un archivo Excel' });
  }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  for (const row of rows) {
    createModuleRecord(req.params.module, row);
  }

  return res.json({ imported: rows.length });
});

app.get('/api/documents', (_req, res) => {
  res.json(listDocuments());
});

app.post('/api/documents', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Debes subir un archivo' });
  }

  const document = createDocument({
    module: String(req.body.module || 'general').trim(),
    record_id: req.body.record_id ? Number(req.body.record_id) : null,
    original_name: req.file.originalname,
    stored_name: req.file.filename,
    mime_type: req.file.mimetype,
    size: req.file.size,
    description: String(req.body.description || '').trim()
  });

  return res.status(201).json(document);
});

app.get('/api/documents/:id/download', (req, res) => {
  const document = getDocument(req.params.id);

  if (!document) {
    return res.status(404).json({ message: 'Documento no encontrado' });
  }

  const filePath = path.join(uploadsDir, document.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Archivo no encontrado en disco' });
  }

  res.download(filePath, document.original_name);
});

app.delete('/api/documents/:id', (req, res) => {
  const document = getDocument(req.params.id);

  if (!document) {
    return res.status(404).json({ message: 'Documento no encontrado' });
  }

  const filePath = path.join(uploadsDir, document.stored_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  deleteDocument(req.params.id);
  return res.status(204).send();
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(port, () => {
  console.log(`Backend local de inventario escuchando en http://localhost:${port}`);
});
