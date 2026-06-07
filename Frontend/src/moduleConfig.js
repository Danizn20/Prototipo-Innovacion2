export const AUTH_CREDENTIALS = {
  username: 'Admin',
  password: 'InnovaAdmin'
};

export const MODULES = {
  home: {
    key: 'home',
    label: 'Inicio',
    title: 'Inicio',
    subtitle: 'Bienvenido a la sucursal de Temuco.'
  },
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    subtitle: 'Graficos y analisis visual del negocio.'
  },
  products: {
    key: 'products',
    label: 'Productos',
    title: 'Productos',
    subtitle: 'Módulo de productos unificado con información de proveedores y mercado.',
    actionLabel: 'Guardar producto',
    listLabel: 'Productos registrados',
    displayLabel: (record) => `${record.name || 'Producto'} · ${record.category || 'Sin categoria'}`,
    fields: [
      { name: 'name', label: 'Productos', type: 'text', placeholder: 'Arroz bolsa 5kg', required: true },
      { name: 'supplier', label: 'Proveedores', type: 'text', placeholder: 'Distribuidora Central' },
      { name: 'marketValue', label: 'Valores de Mercado', type: 'number', step: '1', min: 0 },
      { name: 'sku', label: 'Codigo Producto', type: 'text', placeholder: 'ALI-001' },
      { name: 'stock', label: 'Cantidad disponible', type: 'number', min: 0 },
      { name: 'category', label: 'Categoria', type: 'text', placeholder: 'Alimentos' },
      { name: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Bajo stock', 'Descontinuado'] },
      { name: 'cost', label: 'Costo (Calculado)', type: 'number', step: '1', min: 0 },
      { name: 'salePrice', label: 'Precio de venta (Calculado)', type: 'number', step: '1', min: 0 },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Rotacion, alertas...' }
    ],
    defaultValues: {
      name: '',
      supplier: '',
      marketValue: 0,
      sku: '',
      stock: 0,
      category: '',
      status: 'Activo',
      cost: 0,
      salePrice: 0,
      notes: ''
    }
  },
  inventory_control: {
    key: 'inventory_control',
    label: 'Inventario',
    title: 'Control de inventario',
    subtitle: 'Listado maestro de productos con compra, venta, caducidad, ingreso, cantidad y valor de mercado.',
    actionLabel: 'Guardar registro',
    listLabel: 'Inventario completo',
    displayLabel: (record) => `${record.product || 'Producto'} · ${record.quantity ?? 0} unidades`,
    fields: [
      { name: 'product', label: 'Producto', type: 'text', placeholder: 'Arroz bolsa 5kg', required: true },
      { name: 'purchaseValue', label: 'Valor de compra', type: 'number', step: '0.01', min: 0 },
      { name: 'saleValue', label: 'Valor de venta', type: 'number', step: '0.01', min: 0 },
      { name: 'expiryDate', label: 'Fecha de caducidad', type: 'date' },
      { name: 'entryDate', label: 'Fecha de ingreso al local', type: 'date' },
      { name: 'quantity', label: 'Cantidad', type: 'number', min: 0 },
      { name: 'marketValue', label: 'Valor de mercado', type: 'number', step: '0.01', min: 0 },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Proveedor, lote, alertas, rotacion...' }
    ],
    defaultValues: {
      product: '',
      purchaseValue: 0,
      saleValue: 0,
      expiryDate: '',
      entryDate: '',
      quantity: 0,
      marketValue: 0,
      notes: ''
    }
  },
  sales: {
    key: 'sales',
    label: 'Ventas',
    title: 'Ventas',
    subtitle: 'Registro local de ventas y movimientos de caja.',
    actionLabel: 'Guardar venta',
    listLabel: 'Ventas registradas',
    displayLabel: (record) => `Venta #${record.id} · ${record.customer || 'Cliente general'}`,
    fields: [
      { name: 'date', label: 'Fecha', type: 'date', required: true },
      { name: 'customer', label: 'Cliente', type: 'text', placeholder: 'Mostrador' },
      { name: 'paymentMethod', label: 'Metodo de pago', type: 'select', options: ['Efectivo', 'Transferencia', 'Tarjeta'] },
      { name: 'status', label: 'Estado', type: 'select', options: ['Cerrada', 'Pendiente', 'Anulada'] },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Factura, promo, comentario...' }
    ],
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      customer: '',
      paymentMethod: 'Efectivo',
      status: 'Cerrada',
      notes: ''
    }
  },
  reports: {
    key: 'reports',
    label: 'Reportes',
    title: 'Reportes',
    subtitle: 'Resumenes automaticos para control de inventario y ventas.',
    actionLabel: 'Guardar reporte',
    listLabel: 'Reportes guardados',
    displayLabel: (record) => `${record.title || 'Reporte'} · ${record.period || 'General'}`,
    fields: [
      { name: 'title', label: 'Titulo', type: 'text', placeholder: 'Reporte diario', required: true },
      { name: 'period', label: 'Periodo', type: 'text', placeholder: 'Diario / semanal / mensual' },
      { name: 'metric', label: 'Metrica', type: 'text', placeholder: 'Ventas, stock, abastecimiento' },
      { name: 'result', label: 'Resultado', type: 'number', step: '0.01', min: 0 },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Hallazgos, alertas, conclusiones...' }
    ],
    defaultValues: {
      title: '',
      period: '',
      metric: '',
      result: 0,
      notes: ''
    }
  },
  documents: {
    key: 'documents',
    label: 'Documentos',
    title: 'Documentos',
    subtitle: 'Carga y descarga de Excel, imagenes y archivos del negocio.',
    listLabel: 'Documentos cargados'
  }
  ,
  settings: {
    key: 'settings',
    label: 'Configuraciones',
    title: 'Configuraciones',
    subtitle: 'Preferencias de la aplicacion y cuenta de administrador.'
  }
};

export const MODULE_LABELS = {
  home: 'Inicio',
  dashboard: 'Dashboard',
  products: 'Productos',
  inventory_control: 'Inventario',
  sales: 'Ventas',
  reports: 'Reportes',
  documents: 'Documentos',
  settings: 'Configuraciones'
};

export const MODULE_ORDER = [
  'home',
  'dashboard',
  'products',
  'inventory_control',
  'sales',
  'documents',
  'settings'
];

export function getModuleConfig(moduleKey) {
  return MODULES[moduleKey];
}

export function getDefaultForm(moduleKey) {
  return structuredClone(MODULES[moduleKey]?.defaultValues || {});
}

export function getInitialForms() {
  return {
    products: getDefaultForm('products'),
    inventory_control: getDefaultForm('inventory_control'),
    sales: getDefaultForm('sales'),
    reports: getDefaultForm('reports')
  };
}