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
    subtitle: 'Control de existencias, costos y precios de venta.',
    actionLabel: 'Guardar producto',
    listLabel: 'Productos registrados',
    displayLabel: (record) => `${record.name || 'Producto'} · ${record.category || 'Sin categoria'}`,
    fields: [
      { name: 'name', label: 'Nombre del producto', type: 'text', placeholder: 'Arroz bolsa 5kg', required: true },
      { name: 'sku', label: 'Codigo / SKU', type: 'text', placeholder: 'ALI-001' },
      { name: 'category', label: 'Categoria', type: 'text', placeholder: 'Alimentos' },
      { name: 'stock', label: 'Stock actual', type: 'number', min: 0 },
      { name: 'unit', label: 'Unidad', type: 'select', options: ['unidades', 'cajas', 'paquetes', 'bolsas', 'botellas', 'kg', 'litros'] },
      { name: 'cost', label: 'Costo', type: 'number', step: '0.01', min: 0 },
      { name: 'salePrice', label: 'Precio de venta', type: 'number', step: '0.01', min: 0 },
      { name: 'minStock', label: 'Stock minimo', type: 'number', min: 0 },
      { name: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Bajo stock', 'Descontinuado'] },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Rotacion, ubicacion, alertas...' }
    ],
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      stock: 0,
      unit: 'unidades',
      cost: 0,
      salePrice: 0,
      minStock: 0,
      status: 'Activo',
      notes: ''
    }
  },
  suppliers: {
    key: 'suppliers',
    label: 'Proveedores',
    title: 'Proveedores',
    subtitle: 'Gestion de contactos, tiempos de entrega y calificaciones.',
    actionLabel: 'Guardar proveedor',
    listLabel: 'Proveedores registrados',
    displayLabel: (record) => `${record.name || 'Proveedor'} · ${record.category || 'General'}`,
    fields: [
      { name: 'name', label: 'Nombre del proveedor', type: 'text', placeholder: 'Distribuidora Central', required: true },
      { name: 'contact', label: 'Contacto', type: 'text', placeholder: 'Maria Perez' },
      { name: 'phone', label: 'Telefono', type: 'text', placeholder: '0999999999' },
      { name: 'email', label: 'Correo', type: 'email', placeholder: 'ventas@proveedor.local' },
      { name: 'category', label: 'Categoria', type: 'text', placeholder: 'Alimentos' },
      { name: 'leadTime', label: 'Tiempo de entrega', type: 'text', placeholder: '48h' },
      { name: 'rating', label: 'Calificacion', type: 'select', options: ['A', 'B', 'C'] },
      { name: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Pendiente', 'Suspendido'] },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Condiciones, descuentos, acuerdos...' }
    ],
    defaultValues: {
      name: '',
      contact: '',
      phone: '',
      email: '',
      category: '',
      leadTime: '',
      rating: 'A',
      status: 'Activo',
      notes: ''
    }
  },
  product_values: {
    key: 'product_values',
    label: 'Valores de Productos',
    title: 'Valores de productos',
    subtitle: 'Costo, precio, margen y ajustes de valor por producto.',
    actionLabel: 'Guardar valor',
    listLabel: 'Valores registrados',
    displayLabel: (record) => `${record.product || 'Producto'} · margen ${record.margin ?? 0}%`,
    fields: [
      { name: 'product', label: 'Producto', type: 'text', placeholder: 'Arroz bolsa 5kg', required: true },
      { name: 'cost', label: 'Costo', type: 'number', step: '0.01', min: 0 },
      { name: 'salePrice', label: 'Precio de venta', type: 'number', step: '0.01', min: 0 },
      { name: 'discount', label: 'Descuento', type: 'number', step: '0.01', min: 0 },
      { name: 'margin', label: 'Margen (%)', type: 'number', step: '0.01', min: 0 },
      { name: 'updatedOn', label: 'Fecha de actualizacion', type: 'date' },
      { name: 'notes', label: 'Observaciones', type: 'textarea', rows: 4, placeholder: 'Promocion, ajuste, temporada...' }
    ],
    defaultValues: {
      product: '',
      cost: 0,
      salePrice: 0,
      discount: 0,
      margin: 0,
      updatedOn: '',
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
  suppliers: 'Proveedores',
  product_values: 'Valores de Productos',
  inventory_control: 'Inventario',
  sales: 'Ventas',
  reports: 'Reportes',
  documents: 'Documentos'
  ,
  settings: 'Configuraciones'
};

export const MODULE_ORDER = [
  'home',
  'dashboard',
  'products',
  'suppliers',
  'product_values',
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
    suppliers: getDefaultForm('suppliers'),
    product_values: getDefaultForm('product_values'),
    inventory_control: getDefaultForm('inventory_control'),
    sales: getDefaultForm('sales'),
    reports: getDefaultForm('reports')
  };
}