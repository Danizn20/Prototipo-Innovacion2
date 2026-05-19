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
  getUploadsDir,
  listDocuments,
  listModuleRecords,
  updateModuleRecord
} from './db.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const uploadsDir = getUploadsDir();

app.use(cors({ origin: 'http://localhost:5173' }));
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
  const record = createModuleRecord(req.params.module, req.body || {});
  return res.status(201).json(record);
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
  const records = listModuleRecords(req.params.module).map(flattenRecord);
  const worksheet = XLSX.utils.json_to_sheet(records);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, req.params.module.slice(0, 31) || 'Datos');
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
