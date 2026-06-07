import { useEffect, useMemo, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { Home, LineChart, Package, ClipboardList, ShoppingCart, FileText, Settings as SettingsIcon } from 'lucide-react';
import { apiJson, downloadFile, uploadFormData } from './api.js';
import { AUTH_CREDENTIALS, getDefaultForm, getInitialForms, getModuleConfig, MODULE_LABELS, MODULE_ORDER } from './moduleConfig.js';

const MODULE_ICONS = {
  home: Home,
  dashboard: LineChart,
  products: Package,
  inventory_control: ClipboardList,
  sales: ShoppingCart,
  documents: FileText,
  settings: SettingsIcon
};

const AUTH_STORAGE_KEY = 'prototipo_innovacion_auth';
const ADMIN_STORAGE_KEY = 'prototipo_admin';
const SETTINGS_STORAGE_KEY = 'prototipo_settings';

function isLoggedIn() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}

const moneyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
});

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDateValue(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('es-CL');
}

function buildInventoryRow(record, productsList = []) {
  const data = record.data || {};
  const quantity = Number(data.quantity ?? data.stock ?? 0);

  // Find matching product by name
  const productName = data.product || data.name || '';
  const matchedProductObj = productsList.find(p => (p.data && p.data.name === productName)) || { data: {} };
  const matchedProduct = matchedProductObj.data || {};

  const purchaseValue = Number(data.purchaseValue || matchedProduct.cost || 0);
  const saleValue = Number(data.saleValue || matchedProduct.salePrice || 0);
  const marketValue = Number(data.marketValue || matchedProduct.marketValue || 0);
  const expiryDate = data.expiryDate || '';
  const entryDate = data.entryDate || '';
  const today = new Date();
  const parsedExpiry = expiryDate ? new Date(expiryDate) : null;
  const daysToExpiry = parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
    ? Math.ceil((parsedExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const investmentTotal = Number((quantity * purchaseValue).toFixed(2));
  const incomeTotal = Number((quantity * saleValue).toFixed(2));
  const marketTotal = Number((quantity * marketValue).toFixed(2));
  const isOutOfStock = quantity === 0;
  const isLowStock = quantity > 0 && quantity <= 20;
  const isExpired = daysToExpiry !== null && daysToExpiry < 0;
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30;

  return {
    ...record,
    product: productName,
    supplier: matchedProduct.supplier || '-',
    sku: matchedProduct.sku || '-',
    category: matchedProduct.category || '-',
    productStatus: matchedProduct.status || '-',
    purchaseValue,
    saleValue,
    expiryDate,
    entryDate,
    quantity,
    marketValue,
    investmentTotal,
    incomeTotal,
    marketTotal,
    projectedMargin: Number((incomeTotal - investmentTotal).toFixed(2)),
    daysToExpiry,
    isOutOfStock,
    isLowStock,
    isExpired,
    isExpiringSoon
  };
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverUser, setRecoverUser] = useState('');
  const [recoverMessage, setRecoverMessage] = useState('');

  function attemptRecover() {
    setRecoverMessage('');
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      const admin = raw ? JSON.parse(raw) : { username: AUTH_CREDENTIALS.username, password: AUTH_CREDENTIALS.password };
      if (!recoverUser) {
        setRecoverMessage('Ingresa tu usuario o correo.');
        return;
      }
      if (recoverUser === admin.username || recoverUser === (admin.email || '')) {
        setRecoverMessage('Solicitud enviada (simulada). Revisa las instrucciones.');
      } else if (recoverUser === AUTH_CREDENTIALS.username) {
        setRecoverMessage('Solicitud enviada (simulada). Revisa las instrucciones.');
      } else {
        setRecoverMessage('Usuario no encontrado.');
      }
    } catch (e) {
      setRecoverMessage('Error al procesar la solicitud.');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    // check local admin override first
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      const admin = raw ? JSON.parse(raw) : null;
      if (admin && username === admin.username && password === admin.password) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
        onLogin();
        return;
      }
    } catch (e) {
      // ignore
    }

    if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      onLogin();
      return;
    }

    setError('Usuario o contraseña incorrectos');
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="eyebrow">Acceso local</p>
        <h1>Inventario local para suministros</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Usuario
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Usuario" />
          </label>

          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" />
          </label>

          {error ? <p className="error-message">{error}</p> : null}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" className="primary auth-button">Ingresar</button>
            <button type="button" className="text-button" onClick={() => { setRecoverMode((r) => !r); setRecoverMessage(''); }}>
              Recuperar contraseña
            </button>
          </div>

          {recoverMode ? (
            <div style={{ marginTop: 12 }}>
              <label>
                Usuario o correo
                <input value={recoverUser} onChange={(e) => setRecoverUser(e.target.value)} placeholder="Usuario o correo" />
              </label>
              <div className="button-row">
                <button type="button" className="primary" onClick={attemptRecover}>Enviar solicitud</button>
                <button type="button" className="secondary" onClick={() => setRecoverMode(false)}>Cancelar</button>
              </div>
              {recoverMessage ? <p className="muted">{recoverMessage}</p> : null}
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function SettingsPanel({ settings, saveSettings, adminUser, saveAdmin }) {
  const [localAdmin, setLocalAdmin] = useState(adminUser || { username: '', email: '' });
  const [pwd, setPwd] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLocalAdmin(adminUser || { username: '', email: '' });
  }, [adminUser]);

  function handleSaveSettings(event) {
    event?.preventDefault?.();
    saveSettings({});
    setMsg('Configuraciones guardadas.');
    setTimeout(() => setMsg(''), 3000);
  }

  function handleSaveAdmin(event) {
    event?.preventDefault?.();
    saveAdmin(localAdmin);
    setMsg('Datos de administrador guardados.');
    setTimeout(() => setMsg(''), 3000);
  }

  function handleChangePassword() {
    const current = (() => {
      try { const raw = localStorage.getItem(ADMIN_STORAGE_KEY); return raw ? JSON.parse(raw) : AUTH_CREDENTIALS; } catch (e) { return AUTH_CREDENTIALS; }
    })();
    if (pwd !== current.password) { setMsg('La contraseña actual no coincide.'); return; }
    if (!pwdNew || pwdNew !== pwdConfirm) { setMsg('La nueva contraseña no coincide o está vacía.'); return; }
    saveAdmin({ username: current.username, password: pwdNew });
    setMsg('Contraseña actualizada.');
    setPwd(''); setPwdNew(''); setPwdConfirm('');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <>
      <p className="module-plain-description">Preferencias y datos del administrador.</p>
      <section className="module-layout">
        <form className="card module-form" onSubmit={handleSaveSettings}>
          <div className="card-header">
            <div>
              <p className="card-title">Preferencias de la aplicacion</p>
              <p className="card-subtitle">Tema y tamaño de letra</p>
            </div>
          </div>

          <label>
            Tema
            <select value={settings.theme} onChange={(e) => saveSettings({ theme: e.target.value })}>
              <option value="dark">Oscuro</option>
              <option value="light">Claro</option>
            </select>
          </label>

          <label>
            Tamaño de letra
            <select value={settings.fontSize} onChange={(e) => saveSettings({ fontSize: e.target.value })}>
              <option value="small">Pequeña</option>
              <option value="medium">Mediana</option>
              <option value="large">Grande</option>
            </select>
          </label>

          <div className="button-row">
            <button type="submit" className="primary">Guardar configuraciones</button>
          </div>
        </form>

        <section className="card record-list">
          <div className="card-header">
            <div>
              <p className="card-title">Cuenta administrador</p>
              <p className="card-subtitle">Actualiza los datos de inicio de sesion</p>
            </div>
          </div>

          <label>
            Usuario
            <input value={localAdmin.username} onChange={(e) => setLocalAdmin((prev) => ({ ...prev, username: e.target.value }))} />
          </label>
          <label>
            Correo (opcional)
            <input value={localAdmin.email || ''} onChange={(e) => setLocalAdmin((prev) => ({ ...prev, email: e.target.value }))} />
          </label>

          <div className="button-row">
            <button type="button" className="primary" onClick={handleSaveAdmin}>Guardar cuenta</button>
          </div>

          <hr />
          <p className="card-subtitle">Cambiar contraseña</p>
          <label>
            Contraseña actual
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </label>
          <label>
            Nueva contraseña
            <input type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} />
          </label>
          <label>
            Repetir nueva contraseña
            <input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} />
          </label>
          <div className="button-row">
            <button type="button" className="primary" onClick={handleChangePassword}>Actualizar contraseña</button>
          </div>
          {msg ? <p className="muted">{msg}</p> : null}
        </section>
      </section>
    </>
  );
}

function AppShell() {
  const [isRestockModalOpen, setRestockModalOpen] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [summary, setSummary] = useState(null);
  const [dashboardData, setDashboardData] = useState({ products: [], sales: [], suppliers: [], product_values: [], inventory_control: [] });
  const [records, setRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  
  // Sales state
  const [salesCart, setSalesCart] = useState([]);
  const [salesForm, setSalesForm] = useState({ date: new Date().toISOString().slice(0, 10), customer: '', paymentMethod: 'Efectivo', status: 'Cerrada', notes: '' });
  const [salesProductSelect, setSalesProductSelect] = useState({ productName: '', quantity: 1 });
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [forms, setForms] = useState(getInitialForms());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionHasChanges, setSessionHasChanges] = useState(false);
  const [dayClosePrepared, setDayClosePrepared] = useState(false);
  const [documentForm, setDocumentForm] = useState({ module: 'products', record_id: '', description: '', file: null });
  const [restockForm, setRestockForm] = useState({ productName: '', quantity: '' });
  const [restockMessage, setRestockMessage] = useState('');
  const [chartMode, setChartMode] = useState('bar');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [productsList, setProductsList] = useState([]);

  async function handleRestockSubmit(event) {
    event.preventDefault();
    setRestockMessage('');

    if (!restockForm.productName || !restockForm.quantity) {
      setRestockMessage('Por favor selecciona un producto y la cantidad.');
      return;
    }

    try {
      const response = await apiJson('/api/inventory/restock', {
        method: 'POST',
        body: JSON.stringify({
          productName: restockForm.productName,
          quantity: Number(restockForm.quantity)
        })
      });

      setRestockForm({ productName: '', quantity: '' });
      setRestockModalOpen(false);
      await refreshCurrentView();
      alert(`Éxito: ${response.message || 'Inventario actualizado.'}`);
    } catch (err) {
      setRestockMessage(`Error: ${err.message}`);
    }
  }
  const CHART_FILTERS_KEY = 'prototipo_chart_filters';
  const defaultChartFilters = { bar: 'modules', line: 'sales_total', pie: 'product_status', lineGranularity: 'month', lineRange: 'all' };
  const [chartFilters, setChartFilters] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CHART_FILTERS_KEY);
      return raw ? JSON.parse(raw) : defaultChartFilters;
    } catch (e) {
      return defaultChartFilters;
    }
  });

  function updateChartFilters(next) {
    setChartFilters((current) => {
      const updated = typeof next === 'function' ? next(current) : { ...current, ...next };
      try {
        sessionStorage.setItem(CHART_FILTERS_KEY, JSON.stringify(updated));
      } catch (e) {
        // ignore storage errors
      }
      return updated;
    });
  }

  const activeModule = getModuleConfig(activeView);
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { theme: 'dark', fontSize: 'medium' };
    } catch (e) {
      return { theme: 'dark', fontSize: 'medium' };
    }
  });

  const [adminUser, setAdminUser] = useState(() => {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { username: AUTH_CREDENTIALS.username, password: AUTH_CREDENTIALS.password };
    } catch (e) {
      return { username: AUTH_CREDENTIALS.username, password: AUTH_CREDENTIALS.password };
    }
  });

  useEffect(() => {
    // apply theme
    if (settings.theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
    // apply font size
    const sizeMap = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = sizeMap[settings.fontSize] || '16px';
  }, [settings]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!sessionHasChanges || dayClosePrepared) {
        return;
      }

      event.preventDefault();
      event.returnValue = 'Tienes cambios del dia sin cierre. Usa "Cierre del dia" para exportar PDF y Excel antes de salir.';
      return event.returnValue;
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sessionHasChanges, dayClosePrepared]);

  function saveSettings(next) {
    const updated = { ...settings, ...next };
    setSettings(updated);
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
  }

  function saveAdmin(next) {
    const updated = { ...adminUser, ...next };
    setAdminUser(updated);
    try { localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
  }

  async function loadSummary() {
    const data = await apiJson('/api/dashboard/summary');
    setSummary(data);
  }

  async function loadDashboardData() {
    const [products, sales, suppliers, productValues, inventoryControl] = await Promise.all([
      apiJson('/api/modules/products/records'),
      apiJson('/api/modules/sales/records'),
      apiJson('/api/modules/suppliers/records'),
      apiJson('/api/modules/product_values/records'),
      apiJson('/api/modules/inventory_control/records')
    ]);

    setDashboardData({ products, sales, suppliers, product_values: productValues, inventory_control: inventoryControl });
  }

  function computeInventorySummaryFromRows(rows) {
    return rows.reduce((accumulator, row) => {
      accumulator.count += 1;
      accumulator.quantity += Number(row.quantity || 0);
      accumulator.investmentTotal += Number(row.investmentTotal || 0);
      accumulator.incomeTotal += Number(row.incomeTotal || 0);
      accumulator.marketTotal += Number(row.marketTotal || 0);
      return accumulator;
    }, {
      count: 0,
      quantity: 0,
      investmentTotal: 0,
      incomeTotal: 0,
      marketTotal: 0
    });
  }

  async function loadRecords(moduleKey = activeView) {
    if (!getModuleConfig(moduleKey) || moduleKey === 'home' || moduleKey === 'dashboard' || moduleKey === 'documents') {
      return;
    }

    if (moduleKey === 'inventory_control' || moduleKey === 'sales') {
      const [modData, prodData] = await Promise.all([
        apiJson(`/api/modules/${moduleKey}/records`),
        apiJson(`/api/modules/products/records`)
      ]);
      setRecords(modData);
      setProductsList(prodData);
    } else {
      const data = await apiJson(`/api/modules/${moduleKey}/records`);
      setRecords(data);
    }
  }

  async function loadDocuments() {
    const data = await apiJson('/api/documents');
    setDocuments(data);
  }

  async function refreshCurrentView() {
    setLoading(true);
    setError('');

    try {
      if (activeView === 'home') {
        await loadSummary();
      } else if (activeView === 'dashboard') {
        await Promise.all([loadSummary(), loadDashboardData()]);
      } else if (activeView === 'documents') {
        await loadDocuments();
        await loadSummary();
      } else {
        await Promise.all([loadRecords(activeView), loadSummary()]);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      return;
    }

    refreshCurrentView();
  }, [activeView]);

  const dashboardCards = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      { label: 'Productos', value: summary.modules.products || 0 },
      { label: 'Proveedores', value: summary.modules.suppliers || 0 },
      { label: 'Inventario', value: summary.modules.inventory_control || 0 },
      { label: 'Ventas', value: summary.modules.sales || 0 },
      { label: 'Reportes', value: summary.modules.reports || 0 },
      { label: 'Stock bajo', value: summary.lowStock || 0 },
      { label: 'Ventas totales', value: `$${Number(summary.totalSales || 0).toFixed(2)}` }
    ];
  }, [summary]);

  const dashboardInsights = useMemo(() => {
    const products = dashboardData.products.map((record) => record.data);
    const sales = dashboardData.sales.map((record) => record.data);
    const suppliers = dashboardData.suppliers.map((record) => record.data);

    // Modern pastel palette based on references
    const colorScale = ['#fbc558', '#fb889c', '#5a80f8', '#46d8ad', '#a58ff7', '#6ad1ff'];

    const countBy = (collection, selector) => {
      const map = new Map();
      collection.forEach((item) => {
        const key = selector(item) || 'Sin dato';
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries()).map(([label, value], index) => ({
        label,
        value,
        color: colorScale[index % colorScale.length]
      }));
    };

    const sumBy = (collection, labelSelector, valueSelector) => {
      const map = new Map();
      collection.forEach((item) => {
        const label = labelSelector(item) || 'Sin dato';
        map.set(label, (map.get(label) || 0) + Number(valueSelector(item) || 0));
      });
      return Array.from(map.entries()).map(([label, value], index) => ({
        label,
        value,
        color: colorScale[index % colorScale.length]
      }));
    };

    let barData = [];
    let barLabel = '';
    const reports = dashboardData?.reports?.map((r) => r.data || {}) || [];    if (chartFilters.bar === 'productos_estado') {
      barData = countBy(products, (product) => product.status || (Number(product.stock || 0) <= Number(product.minStock || 0) ? 'Bajo stock' : 'Activo'));
      barLabel = 'Productos por estado';
    } else if (chartFilters.bar === 'ventas_metodo') {
      barData = countBy(sales, (sale) => sale.paymentMethod || 'Sin metodo');
      barLabel = 'Ventas por método de pago';
    } else if (chartFilters.bar === 'ventas_estado') {
      barData = countBy(sales, (sale) => sale.status || 'Sin estado');
      barLabel = 'Ventas por estado';
    } else {
      // registros por modulo (default)
      barData = [
        { label: 'Productos', value: products.length, color: '#fbc558' },
        { label: 'Proveedores', value: suppliers.length, color: '#fb889c' },
        { label: 'Ventas', value: sales.length, color: '#5a80f8' },
        { label: 'Reportes', value: reports.length, color: '#46d8ad' },
        { label: 'Inventario', value: dashboardData?.inventoryControl?.length || 0, color: '#a58ff7' },
        { label: 'Stock bajo', value: dashboardData?.inventoryControl?.filter(row => Number(row.quantity || 0) <= 20 && Number(row.quantity || 0) > 0)?.length || 0, color: '#ffb64d' },
        { label: 'Sin stock', value: dashboardData?.inventoryControl?.filter(row => Number(row.quantity || 0) === 0)?.length || 0, color: '#ff5959' },
        { label: 'Ventas totales', value: summary?.totalSales || 0, color: '#fbc558' },
        { label: 'Registros', value: records?.length, color: '#4ea7ff' },
      ];
      barLabel = 'Registros por módulo';
    }

    let lineData = [];
    let lineLabel = '';
    const granularity = chartFilters.lineGranularity || 'month';

    const formatByGranularity = (dateStr, granularity) => {
      const d = dateStr ? new Date(dateStr) : null;
      if (!d || Number.isNaN(d.getTime())) return { key: 'Sin fecha', label: 'Sin fecha', formatted: 'Sin fecha', time: 0 };
      const year = d.getFullYear();
      const month = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const day = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // ISO week number (simple algorithm)
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
      const weekYear = tmp.getUTCFullYear();
      const weekNo = Math.ceil(((tmp - Date.UTC(weekYear,0,1)) / 86400000 + 1)/7);
      const week = `${weekYear}-W${String(weekNo).padStart(2,'0')}`;

      const locale = navigator?.language || 'es-CL';
      if (granularity === 'day') return { key: day, label: day, formatted: d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }), time: d.getTime() };
      if (granularity === 'week') {
        // compute week start (Monday) and end (Sunday)
        const dayOfWeek = (d.getDay() + 6) % 7; // Monday=0
        const start = new Date(d);
        start.setDate(d.getDate() - dayOfWeek);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const sf = start.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
        const ef = end.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
        return { key: week, label: week, formatted: `Sem ${String(weekNo).padStart(2,'0')} · ${sf} - ${ef}`, time: start.getTime() };
      }
      if (granularity === 'month') return { key: month, label: month, formatted: d.toLocaleDateString(locale, { month: 'short', year: 'numeric' }), time: d.getTime() };
      return { key: String(year), label: String(year), formatted: String(year), time: d.getTime() };
    };

    if (chartFilters.line === 'stock_product') {
      lineData = products.slice(0, 8).map((product, index) => ({
        label: product.name || `P${index + 1}`,
        value: Number(product.stock || 0)
      }));
      lineLabel = 'Stock de productos';
    } else if (chartFilters.line === 'sales_count') {
      // count sales by date granularity
      // apply range filter
      const range = chartFilters.lineRange || 'all';
      const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 24 * 3600 * 1000;
      const map = new Map();
      sales.filter((sale) => {
        if (!sale.date) return false;
        const t = new Date(sale.date).getTime();
        return range === 'all' ? true : (!Number.isNaN(t) && t >= cutoff);
      }).forEach((sale) => {
        const f = formatByGranularity(sale.date, granularity);
        map.set(f.key, { label: f.formatted || f.label, value: (map.get(f.key)?.value || 0) + 1, time: f.time });
      });
      lineData = Array.from(map.values()).sort((a,b) => (a.time || 0) - (b.time || 0)).map((r) => ({ label: r.label, value: r.value }));
      lineLabel = `Cantidad de ventas por ${granularity}`;
    } else {
      // default: total sales by date granularity, with range filter
      const range = chartFilters.lineRange || 'all';
      const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 24 * 3600 * 1000;
      const map = new Map();
      sales.filter((sale) => {
        if (!sale.date) return false;
        const t = new Date(sale.date).getTime();
        return range === 'all' ? true : (!Number.isNaN(t) && t >= cutoff);
      }).forEach((sale) => {
        const f = formatByGranularity(sale.date, granularity);
        map.set(f.key, { label: f.formatted || f.label, value: (map.get(f.key)?.value || 0) + Number(sale.total || 0), time: f.time });
      });
      lineData = Array.from(map.values()).sort((a,b) => (a.time || 0) - (b.time || 0)).map((r) => ({ label: r.label, value: Number(r.value || 0) }));
      lineLabel = `Total de ventas por ${granularity}`;
    }

    let pieData = [];
    let pieLabel = '';
    if (chartFilters.pie === 'sales_payment') {
      pieData = countBy(sales, (sale) => sale.paymentMethod || 'Sin metodo').filter((item) => item.value > 0);
      pieLabel = 'Ventas por método de pago';
    } else if (chartFilters.pie === 'sales_status') {
      pieData = countBy(sales, (sale) => sale.status || 'Sin estado').filter((item) => item.value > 0);
      pieLabel = 'Ventas por estado';
    } else if (chartFilters.pie === 'product_category') {
      pieData = countBy(products, (product) => product.category || 'Sin categoría').filter((item) => item.value > 0);
      pieLabel = 'Productos por categoría';
    } else {
      pieData = countBy(products, (product) => product.status || (Number(product.stock || 0) <= Number(product.minStock || 0) ? 'Bajo stock' : 'Activo')).filter((item) => item.value > 0);
      pieLabel = 'Productos por estado';
    }

    return {
      barData,
      lineData,
      pieData,
      meta: {
        barLabel,
        lineLabel,
        pieLabel
      }
    };
  }, [dashboardData, chartFilters]);

  const inventoryRows = useMemo(() => records.map((r) => buildInventoryRow(r, productsList)), [records, productsList]);

  const [inventoryFilters, setInventoryFilters] = useState({ query: '', status: 'all', expiry: 'all', sort: 'expiryDate' });

  const visibleInventoryRows = useMemo(() => {
    const now = new Date();
    const soonThreshold = 30;

    const filtered = inventoryRows.filter((row) => {
      const query = inventoryFilters.query.trim().toLowerCase();
      const matchesQuery = !query || [row.product, row.notes, row.supplier, row.category, row.sku].some((value) => String(value || '').toLowerCase().includes(query));
      const isOutOfStock = Number(row.quantity || 0) === 0;
      const isLowStock = Number(row.quantity || 0) > 0 && Number(row.quantity || 0) <= 20;
      const expiryDate = row.expiryDate ? new Date(row.expiryDate) : null;
      const daysToExpiry = expiryDate && !Number.isNaN(expiryDate.getTime())
        ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= soonThreshold && daysToExpiry >= 0;
      const isExpired = daysToExpiry !== null && daysToExpiry < 0;

      const matchesStatus = inventoryFilters.status === 'all'
        || (inventoryFilters.status === 'out_of_stock' && isOutOfStock)
        || (inventoryFilters.status === 'low_stock' && isLowStock)
        || (inventoryFilters.status === 'healthy' && !isLowStock && !isOutOfStock)
        || (inventoryFilters.status === 'expired' && isExpired)
        || (inventoryFilters.status === 'soon' && isExpiringSoon);

      const matchesExpiry = inventoryFilters.expiry === 'all'
        || (inventoryFilters.expiry === 'expired' && isExpired)
        || (inventoryFilters.expiry === 'soon' && isExpiringSoon)
        || (inventoryFilters.expiry === 'fresh' && daysToExpiry !== null && daysToExpiry > soonThreshold)
        || (inventoryFilters.expiry === 'no_date' && !expiryDate);

      return matchesQuery && matchesStatus && matchesExpiry;
    });

    const sorters = {
      expiryDate: (a, b) => String(a.expiryDate || '9999-12-31').localeCompare(String(b.expiryDate || '9999-12-31')),
      quantity: (a, b) => Number(a.quantity || 0) - Number(b.quantity || 0),
      marketValue: (a, b) => Number(b.marketValue || 0) - Number(a.marketValue || 0)
    };

    return [...filtered].sort(sorters[inventoryFilters.sort] || sorters.expiryDate);
  }, [inventoryRows, inventoryFilters]);

  const inventorySummary = useMemo(() => {
    return inventoryRows.reduce((accumulator, row) => {
      accumulator.count += 1;
      accumulator.quantity += Number(row.quantity || 0);
      accumulator.investmentTotal += Number(row.investmentTotal || 0);
      accumulator.incomeTotal += Number(row.incomeTotal || 0);
      accumulator.marketTotal += Number(row.marketTotal || 0);
      return accumulator;
    }, {
      count: 0,
      quantity: 0,
      investmentTotal: 0,
      incomeTotal: 0,
      marketTotal: 0
    });
  }, [inventoryRows]);

  const inventoryAlerts = useMemo(() => {
    const now = new Date();
    const soonDays = 30;
    const lowStock = inventoryRows.filter((row) => Number(row.quantity || 0) <= 20);
    const expiringSoon = inventoryRows.filter((row) => {
      if (!row.expiryDate) return false;
      const date = new Date(row.expiryDate);
      if (Number.isNaN(date.getTime())) return false;
      const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= soonDays;
    });
    const expired = inventoryRows.filter((row) => {
      if (!row.expiryDate) return false;
      const date = new Date(row.expiryDate);
      return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
    });
    const highestInvestment = inventoryRows.reduce((top, row) => (Number(row.investmentTotal || 0) > Number(top?.investmentTotal || 0) ? row : top), null);

    return {
      lowStock,
      expiringSoon,
      expired,
      highestInvestment
    };
  }, [inventoryRows]);

  function ShoppingIllustration() {
    return (
      <svg viewBox="0 0 720 420" className="shopping-illustration" role="img" aria-label="Personas comprando en una tienda">
        <defs>
          <linearGradient id="skyGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#17253f" />
            <stop offset="100%" stopColor="#0d1322" />
          </linearGradient>
          <linearGradient id="storeGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffb64d" />
            <stop offset="100%" stopColor="#ff8f4d" />
          </linearGradient>
          <linearGradient id="bagGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#6ad1ff" />
            <stop offset="100%" stopColor="#4ea7ff" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="720" height="420" rx="32" fill="url(#skyGradient)" />
        <circle cx="122" cy="92" r="34" fill="#ffe9b5" opacity="0.9" />
        <path d="M0 312C118 274 183 284 274 310C370 337 431 350 540 324C612 306 652 295 720 302V420H0Z" fill="#0a1020" />

        <g transform="translate(86 88)">
          <rect x="0" y="76" width="360" height="128" rx="18" fill="#111a2d" stroke="#25324f" />
          <rect x="28" y="28" width="304" height="54" rx="12" fill="url(#storeGradient)" />
          <text x="180" y="62" textAnchor="middle" fill="#1b1f2d" fontSize="28" fontWeight="700">NEGOCIO LOCAL</text>
          <g fill="#f7fafc">
            <rect x="22" y="98" width="60" height="56" rx="10" fill="#1c2942" />
            <rect x="94" y="98" width="60" height="56" rx="10" fill="#1c2942" />
            <rect x="166" y="98" width="60" height="56" rx="10" fill="#1c2942" />
            <rect x="238" y="98" width="60" height="56" rx="10" fill="#1c2942" />
            <rect x="310" y="98" width="28" height="56" rx="10" fill="#1c2942" />
          </g>
          <path d="M0 204h360" stroke="#2b3958" strokeWidth="4" />
        </g>

        <g transform="translate(438 175)">
          <path d="M60 0l30 62h-22l-8-16-8 16H30l30-62Z" fill="#ffcf70" />
          <circle cx="60" cy="74" r="22" fill="#f5d6c4" />
          <path d="M32 126c6-22 17-36 28-36s22 14 28 36v54H32Z" fill="#4ea7ff" />
          <path d="M16 146h88v14H16z" fill="#314362" />
        </g>

        <g transform="translate(500 160)">
          <circle cx="72" cy="26" r="22" fill="#f1cab2" />
          <path d="M38 140c5-30 16-50 34-50s29 20 34 50v40H38Z" fill="#6ad1ff" />
          <path d="M6 150h128v14H6z" fill="#314362" />
          <path d="M76 74l18 0 12 42h-36z" fill="url(#bagGradient)" />
          <path d="M70 70c0-10 4-18 10-18s10 8 10 18" fill="none" stroke="#1f2b44" strokeWidth="5" />
        </g>

        <g transform="translate(210 236)">
          <circle cx="56" cy="18" r="18" fill="#f2c7ad" />
          <path d="M26 112c4-24 13-40 30-40s26 16 30 40v32H26Z" fill="#ff8f4d" />
          <path d="M4 120h108v12H4z" fill="#314362" />
          <path d="M52 68l20 0 12 30H40z" fill="url(#bagGradient)" />
        </g>

        <g opacity="0.85">
          <circle cx="612" cy="78" r="7" fill="#ffd98b" />
          <circle cx="640" cy="104" r="5" fill="#6ad1ff" />
          <circle cx="584" cy="122" r="4" fill="#ff9d9d" />
        </g>
      </svg>
    );
  }

  function BarChart({ data, active }) {
    const maxValue = Math.max(...data.map((item) => item.value), 1);
    const containerRef = useRef();
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

    function onBarHover(event, item) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip({ visible: true, x: event.clientX - rect.left + 8, y: event.clientY - rect.top + 8, text: `${item.label}: ${item.value}` });
    }

    function onLeave() {
      setTooltip((t) => ({ ...t, visible: false }));
    }

    async function exportBarAsPng() {
      const w = 900;
      const h = 420;
      const padding = 60;
      const innerW = w - padding * 2;
      const innerH = h - padding * 2;
      const maxV = Math.max(...data.map((d) => Number(d.value || 0)), 1);
      const totalV = data.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0) || 1;
      const barW = innerW / data.length - 12;
      let bars = '';
      data.forEach((item, i) => {
        const bw = barW;
        const x = padding + i * (bw + 12);
        const value = Number(item.value || 0);
        const pct = Math.round((value / totalV) * 100);
        const barHeight = Math.max((value / maxV) * innerH, 2);
        const y = padding + (innerH - barHeight);
        const radius = Math.min(bw / 2, barHeight);
        // Draw path with fully rounded top and flat bottom
        const path = `M ${x},${padding + innerH} L ${x},${y + radius} A ${radius},${radius} 0 0 1 ${x + bw},${y + radius} L ${x + bw},${padding + innerH} Z`;
        bars += `<path d="${path}" fill="${item.color || '#ccc'}"/>`;
        bars += `<text x="${x + bw / 2}" y="${Math.max(y - 10, 20)}" font-size="13" font-weight="700" text-anchor="middle" fill="#ffffff">${value} (${pct}%)</text>`;
        bars += `<text x="${x + bw / 2}" y="${padding + innerH + 20}" font-size="14" text-anchor="middle" fill="#eaf0ff">${item.label}</text>`;
      });
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#071226'/><text x='${padding}' y='32' font-size='18' font-weight='700' fill='#ffffff'>Grafico de barras - Total: ${totalV}</text><g>${bars}</g></svg>`;
      await exportSvgStringToPng(svg, `barras-${Date.now()}.png`, w, h);
    }
    const total = data.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0);

    return (
      <div ref={containerRef} className={`chart-card ${active ? 'active' : ''}`}>
        <div className="chart-title-row">
          <strong>Barra</strong>
          <span>Comparativo por categoría</span>
          <div style={{ marginLeft: 12 }}>
            <button type="button" className="export-btn" onClick={exportBarAsPng}>Exportar</button>
          </div>
        </div>
        <div className="bar-chart-container" style={{ position: 'relative', width: '100%', height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: '32px' }}>
          {data.map((item) => {
            const hPct = Math.max((item.value / maxValue) * 100, 8);
            return (
              <div key={item.label} className="bar-item" style={{ flex: 1, margin: '0 8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                <div className="hover-show" style={{ position: 'absolute', top: -24, width: '100%', textAlign: 'center', opacity: 0, transition: 'opacity 0.2s', zIndex: 10 }}>
                   <strong>{item.value}</strong>
                </div>
                <div
                  className="bar-fill-modern"
                  style={{
                    height: `${hPct}%`,
                    background: item.color,
                    borderTopLeftRadius: '50px',
                    borderTopRightRadius: '50px',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    width: '100%',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseMove={(e) => onBarHover(e, item)}
                  onMouseLeave={onLeave}
                />
                <span style={{ fontSize: '11px', textAlign: 'center', marginTop: '8px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
              </div>
            );
          })}
        </div>
        {tooltip.visible ? (
          <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
          {data.map(item => (
            <div key={'leg-'+item.label} style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
               <span style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, marginRight: 6 }}></span>
               <span className="muted">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function LineChart({ data, active }) {
    const width = 520;
    const height = 220;
    const padding = 28;
    const values = data.map((item) => Number(item.value || 0));
    const maxValue = Math.max(...values, 1);
    const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
    const pointsObj = data.map((item, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (Number(item.value || 0) / maxValue) * (height - padding * 2);
      return { x, y };
    });

    const createSmoothPath = (pts) => {
      if (pts.length === 0) return '';
      if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpX = p0.x + (p1.x - p0.x) / 2;
        d += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
      }
      return d;
    };
    
    const smoothPath = createSmoothPath(pointsObj);

    const svgRef = useRef();
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

    async function exportLineAsPng() {
      const w = 900;
      const h = 420;
      const exportPadding = 70;
      const innerW = w - exportPadding * 2;
      const innerH = h - exportPadding * 2;
      const totalV = data.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0) || 1;
      const maxV = Math.max(...data.map((item) => Number(item.value || 0)), 1);
      const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;

      const pathPoints = data.map((item, index) => {
        const x = exportPadding + (index * xStep);
        const y = exportPadding + innerH - ((Number(item.value || 0) / maxV) * innerH);
        return { x, y };
      });

      const createExportPath = (pts) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const cpX = p0.x + (p1.x - p0.x) / 2;
          d += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
        }
        return d;
      };
      
      const exportPath = createExportPath(pathPoints);

      let pointsLayer = '';
      data.forEach((item, index) => {
        const x = exportPadding + (index * xStep);
        const y = exportPadding + innerH - ((Number(item.value || 0) / maxV) * innerH);
        const value = Number(item.value || 0);
        const pct = Math.round((value / totalV) * 100);
        pointsLayer += `<circle cx='${x}' cy='${y}' r='6' fill='#ffb64d' stroke='#ffffff' stroke-width='2'/>`;
        pointsLayer += `<text x='${x}' y='${Math.max(y - 12, 24)}' font-size='12' font-weight='700' text-anchor='middle' fill='#ffffff'>${value} (${pct}%)</text>`;
        pointsLayer += `<text x='${x}' y='${h - 24}' font-size='12' text-anchor='middle' fill='#dbe7ff'>${item.label}</text>`;
      });

      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#071226'/><text x='${exportPadding}' y='34' font-size='18' font-weight='700' fill='#ffffff'>Grafico de linea - Total: ${totalV}</text><path d='${exportPath}' fill='none' stroke='url(#lineExportGradient)' stroke-width='4'/><defs><linearGradient id='lineExportGradient' x1='0' x2='1' y1='0' y2='0'><stop offset='0%' stop-color='#ffb64d'/><stop offset='100%' stop-color='#4ea7ff'/></linearGradient></defs>${pointsLayer}</svg>`;
      await exportSvgStringToPng(svg, `linea-${Date.now()}.png`, w, h);
    }

    function onPointHover(e, item) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltip({ visible: true, x: e.clientX - rect.left + 8, y: e.clientY - rect.top + 8, text: `${item.label}: ${item.value}` });
    }

    function hideTooltip() { setTooltip((t) => ({ ...t, visible: false })); }

    return (
      <div className={`chart-card ${active ? 'active' : ''}`}>
        <div className="chart-title-row">
          <strong>Linea</strong>
          <span>Evolucion temporal</span>
          <div style={{ marginLeft: 12 }}>
            <button type="button" className="export-btn" onClick={exportLineAsPng}>Exportar</button>
          </div>
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="line-chart">
          <defs>
            <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ffb64d" />
              <stop offset="100%" stopColor="#4ea7ff" />
            </linearGradient>
            <linearGradient id="lineAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(78, 167, 255, 0.45)" />
              <stop offset="100%" stopColor="rgba(78, 167, 255, 0.02)" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line key={line} x1={padding} x2={width - padding} y1={padding + line * ((height - padding * 2) / 3)} y2={padding + line * ((height - padding * 2) / 3)} />
          ))}
          {pointsObj.length > 1 ? (
            <path
              d={`${smoothPath} L ${padding + (data.length - 1) * stepX},${height - padding} L ${padding},${height - padding} Z`}
              fill="url(#lineAreaGradient)"
            />
          ) : null}
          <path d={smoothPath} fill="none" stroke="url(#lineGradient)" strokeWidth="4" />
          {data.map((item, index) => {
            const x = padding + index * stepX;
            const y = height - padding - (Number(item.value || 0) / maxValue) * (height - padding * 2);
            return (
              <g key={`${item.label}-${index}`} onMouseMove={(e) => onPointHover(e, item)} onMouseLeave={hideTooltip}>
                <circle cx={x} cy={y} r="9" className="line-point-glow" />
                <circle cx={x} cy={y} r="5" />
              </g>
            );
          })}
        </svg>
        {tooltip.visible ? (<div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>) : null}
        <div className="chart-axis labels-inline">
          {data.map((item, index) => (
            <span key={`${item.label}-${index}`}>{item.label}</span>
          ))}
        </div>
      </div>
    );
  }

  function PieChart({ data, active }) {
    const total = data.reduce((accumulator, item) => accumulator + item.value, 0) || 1;
    const r = 40;
    const circ = 2 * Math.PI * r;

    async function exportPieAsPng() {
      const w = 900;
      const h = Math.ceil(data.length / 4) * 220 + 100;
      const totalV = data.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0) || 1;
      let rings = '';

      data.forEach((item, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const cx = 150 + col * 200;
        const cy = 150 + row * 220;
        const value = Number(item.value || 0);
        const pct = Math.round((value / totalV) * 100);
        const dash = (pct / 100) * circ;
        
        rings += `<g transform="translate(${cx - 50}, ${cy - 50})">`;
        rings += `<circle cx="50" cy="50" r="40" fill="none" stroke="#1f2b44" stroke-width="12" />`;
        rings += `<circle cx="50" cy="50" r="40" fill="none" stroke="${item.color || '#ccc'}" stroke-width="12" stroke-dasharray="${dash} ${circ}" stroke-linecap="round" transform="rotate(-90 50 50)" />`;
        rings += `<text x="50" y="56" text-anchor="middle" font-size="20" font-weight="700" fill="#ffffff">${pct}%</text>`;
        rings += `<text x="50" y="115" text-anchor="middle" font-size="16" font-weight="700" fill="${item.color || '#ccc'}">${value}</text>`;
        rings += `<text x="50" y="135" text-anchor="middle" font-size="14" fill="#dbe7ff">${item.label}</text>`;
        rings += `</g>`;
      });

      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#071226'/><text x='50' y='50' font-size='22' font-weight='700' fill='#ffffff'>Métricas de proporción - Total: ${totalV}</text>${rings}</svg>`;
      await exportSvgStringToPng(svg, `proporciones-${Date.now()}.png`, w, h);
    }

    return (
      <div className={`chart-card ${active ? 'active' : ''}`}>
        <div className="chart-title-row">
          <strong>Proporción</strong>
          <span>Métricas individuales</span>
          <div style={{ marginLeft: 12 }}>
            <button type="button" className="export-btn" onClick={exportPieAsPng}>Exportar</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '24px', padding: '24px 0' }}>
          {data.map((item, idx) => {
            const pct = total ? Math.round((item.value / total) * 100) : 0;
            const dash = (pct / 100) * circ;
            return (
              <div key={item.label + idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 100, height: 100 }}>
                  <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', overflow: 'visible' }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(150,150,150,0.15)" strokeWidth="10" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={item.color} strokeWidth="10" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'all 0.8s ease-out' }} />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <strong style={{ fontSize: '22px' }} className="pie-center-value">{pct}%</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                   <strong style={{ display: 'block', fontSize: '15px', color: item.color }}>{item.value}</strong>
                   <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Utility: convert SVG string to PNG and trigger download
  function exportSvgStringToPng(svgString, fileName, width = 800, height = 600) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#071226';
          ctx.fillRect(0,0,width,height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          canvas.toBlob((blob) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function logout() {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.reload();
  }

  function handleFieldChange(moduleKey, fieldName, value) {
    setForms((current) => ({
      ...current,
      [moduleKey]: {
        ...current[moduleKey],
        [fieldName]: value
      }
    }));
  }

  function startEditRecord(moduleKey, record) {
    setActiveView(moduleKey);
    setEditingId(record.id);
    setForms((current) => ({
      ...current,
      [moduleKey]: { ...getDefaultForm(moduleKey), ...record.data }
    }));
  }

  function clearModuleForm(moduleKey) {
    setEditingId(null);
    setForms((current) => ({
      ...current,
      [moduleKey]: getDefaultForm(moduleKey)
    }));
  }

  function coerceValue(field, value) {
    if (field.type === 'number') {
      return value === '' ? 0 : Number(value);
    }

    return value;
  }

  async function handleModuleSubmit(moduleKey, event) {
    event.preventDefault();
    setError('');

    const config = getModuleConfig(moduleKey);
    const payload = {};

    for (const field of config.fields) {
      payload[field.name] = coerceValue(field, forms[moduleKey][field.name]);
    }

    try {
      if (editingId) {
        await apiJson(`/api/modules/${moduleKey}/records/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiJson(`/api/modules/${moduleKey}/records`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setSessionHasChanges(true);
      setDayClosePrepared(false);

      clearModuleForm(moduleKey);
      await refreshCurrentView();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleDeleteRecord(moduleKey, id) {
    if (moduleKey === 'documents') {
      if (!window.confirm('¿Deseas eliminar este documento?')) {
        return;
      }

      try {
        await apiJson(`/api/documents/${id}`, { method: 'DELETE' });
        setSessionHasChanges(true);
        setDayClosePrepared(false);
        await refreshCurrentView();
      } catch (requestError) {
        setError(requestError.message);
      }

      return;
    }

    if (!window.confirm('¿Deseas eliminar este registro?')) {
      return;
    }

    try {
      await apiJson(`/api/modules/${moduleKey}/records/${id}`, { method: 'DELETE' });
      setSessionHasChanges(true);
      setDayClosePrepared(false);
      await refreshCurrentView();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleExport(moduleKey) {
    try {
      const response = await apiJson(`/api/modules/${moduleKey}/export`);
      alert(response.message || `Exportación a Excel completada con éxito.`);
    } catch (requestError) {
      alert(`Hubo un error al exportar: ${requestError.message}`);
      setError(requestError.message);
    }
  }

  async function handleDeleteAllRecords(moduleKey) {
    if (!window.confirm('¡CUIDADO! ¿Estás seguro de que quieres BORRAR TODOS los registros de este módulo? Esta acción es irreversible.')) {
      return;
    }
    try {
      await apiJson(`/api/modules/${moduleKey}/records`, { method: 'DELETE' });
      setSessionHasChanges(true);
      await refreshCurrentView();
      alert('Todos los registros han sido eliminados.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleImport(moduleKey, file) {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      await uploadFormData(`/api/modules/${moduleKey}/import`, formData);
      setSessionHasChanges(true);
      setDayClosePrepared(false);
      await refreshCurrentView();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleDocumentUpload(event) {
    event.preventDefault();

    if (!documentForm.file) {
      setError('Selecciona un archivo para cargar');
      return;
    }

    const formData = new FormData();
    formData.append('file', documentForm.file);
    formData.append('module', documentForm.module);
    formData.append('record_id', documentForm.record_id || '');
    formData.append('description', documentForm.description);

    try {
      await uploadFormData('/api/documents', formData);
      setSessionHasChanges(true);
      setDayClosePrepared(false);
      setDocumentForm({ module: documentForm.module, record_id: '', description: '', file: null });
      await refreshCurrentView();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleDownloadDocument(documentId, fileName) {
    try {
      await downloadFile(`/api/documents/${documentId}/download`, fileName || `documento-${documentId}`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function renderField(moduleKey, field) {
    const value = forms[moduleKey][field.name] ?? '';

    return (
      <label key={field.name}>
        {field.label}
        {field.type === 'textarea' ? (
          <textarea
            name={field.name}
            rows={field.rows || 4}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => handleFieldChange(moduleKey, field.name, event.target.value)}
          />
        ) : field.type === 'select' ? (
          <select
            name={field.name}
            value={value}
            onChange={(event) => handleFieldChange(moduleKey, field.name, event.target.value)}
          >
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            name={field.name}
            min={field.min}
            step={field.step}
            value={value}
            placeholder={field.placeholder}
            required={field.required}
            onChange={(event) => handleFieldChange(moduleKey, field.name, event.target.value)}
          />
        )}
      </label>
    );
  }

  function handleInventoryPdfExport(customRows, customSummary) {
    const columns = [
      'Producto',
      'Compra',
      'Venta',
      'Caducidad',
      'Ingreso',
      'Cantidad',
      'Mercado',
      'Inversión',
      'Ingreso estimado',
      'Margen'
    ];

    const rowsSource = customRows || visibleInventoryRows;
    const summarySource = customSummary || inventorySummary;
    const rows = rowsSource.map((row) => ([
      row.product || 'Producto',
      formatMoney(row.purchaseValue),
      formatMoney(row.saleValue),
      formatDateValue(row.expiryDate),
      formatDateValue(row.entryDate),
      String(row.quantity || 0),
      formatMoney(row.marketValue),
      formatMoney(row.investmentTotal),
      formatMoney(row.incomeTotal),
      formatMoney(row.projectedMargin)
    ]));

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(16, 26, 44);
    doc.roundedRect(28, 24, pageWidth - 56, 74, 14, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Reporte de control de inventario', 44, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Listado para control de compra, venta, caducidad, ingreso y valor de mercado.', 44, 70);
    doc.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 44, 88);

    doc.setTextColor(15, 23, 32);
    autoTable(doc, {
      startY: 112,
      body: [[
        `Registros: ${summarySource.count}`,
        `Unidades: ${summarySource.quantity}`,
        `Inversión: ${formatMoney(summarySource.investmentTotal)}`,
        `Ingreso estimado: ${formatMoney(summarySource.incomeTotal)}`,
        `Valor de mercado: ${formatMoney(summarySource.marketTotal)}`
      ]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, halign: 'center', valign: 'middle' },
      bodyStyles: { fillColor: [244, 247, 255], textColor: [15, 23, 32], fontStyle: 'bold' },
      tableLineColor: [220, 228, 241],
      tableLineWidth: 0.6,
      margin: { left: 40, right: 40 }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [columns],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
      headStyles: { fillColor: [16, 26, 44], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      margin: { left: 40, right: 40 }
    });

    const footerY = doc.internal.pageSize.getHeight() - 24;
    doc.setFontSize(9);
    doc.setTextColor(92, 106, 138);
    doc.text('Prototipo Innovacion · Control local de inventario', 40, footerY);
    doc.text(`Pagina ${doc.getNumberOfPages()}`, pageWidth - 40, footerY, { align: 'right' });

    const pdfBlob = doc.output('blob');
    const formData = new FormData();
    const d = new Date();
    const formattedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth()+1).padStart(2, '0')}-${d.getFullYear()}-${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}hrs`;
    formData.append('file', pdfBlob, `Inventario-${formattedDate}.pdf`);
    formData.append('type', 'PDF');
    
    uploadFormData('/api/export/save-local', formData)
      .then(resp => alert(resp.message || 'Exportación PDF guardada con éxito.'))
      .catch(err => alert('Error guardando PDF: ' + err.message));
  }

  async function handleDayCloseExport() {
    try {
      const inventoryRaw = await apiJson('/api/modules/inventory_control/records');
      const inventoryBuilt = inventoryRaw.map(record => buildInventoryRow(record, productsList));
      const summaryBuilt = computeInventorySummaryFromRows(inventoryBuilt);

      const response = await apiJson('/api/modules/inventory_control/export');
      handleInventoryPdfExport(inventoryBuilt, summaryBuilt);

      setDayClosePrepared(true);
      setSessionHasChanges(false);
      localStorage.setItem('LAST_DAY_CLOSE', new Date().toISOString());
      alert('Cierre del dia completado: se exportaron Excel y PDF.');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible completar el cierre del dia.');
    }
  }

  function renderInventoryControlView(config) {
    const tableRows = [...visibleInventoryRows].sort((a, b) => (a.product || '').localeCompare(b.product || ''));

    return (
      <>
        <p className="module-plain-description">{config.subtitle}</p>

        <section className="module-layout inventory-layout">
          <div className="button-row" style={{ marginBottom: 16, gridColumn: '1 / -1' }}>
            <button type="button" className="primary" onClick={() => { setInventoryModalOpen(true); clearModuleForm(config.key); }}>
              Nuevo registro
            </button>
            <button type="button" className="secondary" onClick={() => setRestockModalOpen(true)}>
              Reabastecimiento
            </button>
            <button type="button" className="secondary" onClick={() => handleExport(config.key)}>
              Descargar Excel
            </button>
            <button type="button" className="secondary" onClick={() => handleInventoryPdfExport()}>
              Descargar PDF
            </button>
            <button type="button" className="secondary danger" style={{ backgroundColor: '#7f1d1d', color: 'white', borderColor: '#7f1d1d' }} onClick={() => handleDeleteAllRecords(config.key)}>
              Borrar Todo
            </button>
            <label className="secondary file-button">
              Cargar Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => handleImport(config.key, event.target.files?.[0])}
              />
            </label>
          </div>

          {(inventoryModalOpen || editingId) ? (
            <div className="modal-overlay" onClick={(e) => {
              if (e.target === e.currentTarget) {
                setInventoryModalOpen(false);
                clearModuleForm(config.key);
              }
            }}>
              <div className="modal-card">
                <form className="card module-form" style={{ margin: 0 }} onSubmit={async (event) => {
                  event.preventDefault();
                  await handleModuleSubmit(config.key, event);
                  if (!error) {
                    setInventoryModalOpen(false);
                  }
                }}>
                  <div className="card-header">
                    <div>
                      <p className="card-title">{editingId ? 'Editar registro de inventario' : config.actionLabel}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => { setInventoryModalOpen(false); clearModuleForm(config.key); }}>Cerrar</button>
                  </div>

                  <div className="form-grid">{config.fields.map((field) => renderField(config.key, field))}</div>

                  {error ? <p className="error-message">{error}</p> : null}

                  <div className="button-row">
                    <button type="submit" className="primary">
                      {editingId ? 'Guardar cambios' : config.actionLabel}
                    </button>
                    <button type="button" className="secondary" onClick={() => clearModuleForm(config.key)}>
                      Limpiar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          <section className="card record-list inventory-record-list" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div>
                <p className="card-title">{config.listLabel}</p>
                <p className="card-subtitle">Tabla completa con costos, precios, caducidad, ingreso y valores resumidos.</p>
              </div>
              <span className="badge accent">{tableRows.length} registros</span>
            </div>

            <div className="inventory-filter-bar">
              <label>
                Buscar
                <input
                  value={inventoryFilters.query}
                  onChange={(event) => setInventoryFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="Producto, nota o lote"
                />
              </label>
              <label>
                Estado
                <select value={inventoryFilters.status} onChange={(event) => setInventoryFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="all">Todos</option>
                  <option value="healthy">Completo</option>
                  <option value="low_stock">Falta de productos</option>
                  <option value="out_of_stock">Sin productos</option>
                  <option value="soon">Caduca pronto</option>
                  <option value="expired">Vencido</option>
                </select>
              </label>
              <label>
                Caducidad
                <select value={inventoryFilters.expiry} onChange={(event) => setInventoryFilters((current) => ({ ...current, expiry: event.target.value }))}>
                  <option value="all">Todas</option>
                  <option value="fresh">Lejana</option>
                  <option value="soon">Próxima</option>
                  <option value="expired">Vencida</option>
                  <option value="no_date">Sin fecha</option>
                </select>
              </label>
              <label>
                Orden
                <select value={inventoryFilters.sort} onChange={(event) => setInventoryFilters((current) => ({ ...current, sort: event.target.value }))}>
                  <option value="expiryDate">Caducidad</option>
                  <option value="quantity">Cantidad</option>
                  <option value="marketValue">Valor de mercado</option>
                </select>
              </label>
              <button type="button" className="secondary" onClick={() => setInventoryFilters({ query: '', status: 'all', expiry: 'all', sort: 'expiryDate' })}>
                Limpiar filtros
              </button>
            </div>

            <p className="inventory-metrics-note">Aquí puedes revisar qué compraste, cuánto te cuesta realmente, cuánto podrías ingresar y si el stock queda corto o de más.</p>

            <div className="inventory-summary-grid">
              <div className="summary-tile">
                <span>Inversión total</span>
                <strong>{formatMoney(inventorySummary.investmentTotal)}</strong>
              </div>
              <div className="summary-tile">
                <span>Ingreso estimado</span>
                <strong>{formatMoney(inventorySummary.incomeTotal)}</strong>
              </div>
              <div className="summary-tile">
                <span>Valor de mercado</span>
                <strong>{formatMoney(inventorySummary.marketTotal)}</strong>
              </div>
              <div className="summary-tile">
                <span>Unidades totales</span>
                <strong>{inventorySummary.quantity}</strong>
              </div>
            </div>

            {loading ? <p className="muted">Cargando inventario...</p> : null}

            {!loading && tableRows.length === 0 ? <p className="muted">Aun no hay registros de inventario.</p> : null}

            {!loading && tableRows.length > 0 ? (
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Proveedor</th>
                      <th>SKU</th>
                      <th>Categoría</th>
                      <th>Estado Prod.</th>
                      <th>Cantidad</th>
                      <th>Caducidad</th>
                      <th>Mercado</th>
                      <th>Inversión</th>
                      <th>Ingreso est.</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} className={row.isExpired ? 'inventory-row-expired' : row.isExpiringSoon ? 'inventory-row-soon' : row.isOutOfStock ? 'inventory-row-out' : row.isLowStock ? 'inventory-row-low' : ''}>
                        <td>
                          <strong>{row.product || 'Producto'}</strong>
                        </td>
                        <td>{row.supplier}</td>
                        <td><span className="muted">{row.sku}</span></td>
                        <td>{row.category}</td>
                        <td><span className={`inventory-status ${row.productStatus === 'Activo' ? 'ok' : row.productStatus === 'Descontinuado' ? 'danger' : 'warning'}`}>{row.productStatus}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title={row.isOutOfStock ? 'Sin productos' : row.isLowStock ? 'Con falta de productos' : 'Completo'}>
                            <div className={`semaforo-dot ${row.isOutOfStock ? 'danger' : row.isLowStock ? 'warning' : 'ok'}`} />
                            {row.quantity}
                          </div>
                        </td>
                        <td>{formatDateValue(row.expiryDate)}</td>
                        <td>{formatMoney(row.marketValue)}</td>
                        <td>{formatMoney(row.investmentTotal)}</td>
                        <td>{formatMoney(row.incomeTotal)}</td>
                        <td>
                          <div className="row-actions">
                            <span className={`inventory-status ${row.isExpired ? 'danger' : row.isExpiringSoon ? 'warning' : row.isOutOfStock ? 'danger' : row.isLowStock ? 'warning' : 'ok'}`}>
                              {row.isExpired ? 'Vencido' : row.isExpiringSoon ? 'Caduca pronto' : row.isOutOfStock ? 'Sin stock' : row.isLowStock ? 'Bajo stock' : 'Sano'}
                            </span>
                            <button type="button" className="text-button" onClick={() => { startEditRecord(config.key, row); setInventoryModalOpen(true); }}>
                              Editar
                            </button>
                            <button type="button" className="text-button danger" onClick={() => handleDeleteRecord(config.key, row.id)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </section>
      </>
    );
  }

  function renderProductsView(config) {
    const tableRows = records.map((r) => ({ ...r, ...r.data })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return (
      <>
        <p className="module-plain-description">{config.subtitle}</p>

        <section className="module-layout">
          <div className="button-row" style={{ marginBottom: 16, gridColumn: '1 / -1' }}>
            <button type="button" className="primary" onClick={() => { setProductModalOpen(true); clearModuleForm(config.key); }}>
              Agregar producto
            </button>
            <button type="button" className="secondary" onClick={() => handleExport(config.key)}>
              Descargar Excel
            </button>
            <button type="button" className="secondary danger" style={{ backgroundColor: '#7f1d1d', color: 'white', borderColor: '#7f1d1d' }} onClick={() => handleDeleteAllRecords(config.key)}>
              Borrar Todo
            </button>
            <label className="secondary file-button">
              Cargar Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => handleImport(config.key, event.target.files?.[0])}
              />
            </label>
          </div>

          {(productModalOpen || editingId) ? (
            <div className="modal-overlay" onClick={(e) => {
              if (e.target === e.currentTarget) {
                setProductModalOpen(false);
                clearModuleForm(config.key);
              }
            }}>
              <div className="modal-card">
                <form className="card module-form" style={{ margin: 0 }} onSubmit={async (event) => {
                  event.preventDefault();
                  await handleModuleSubmit(config.key, event);
                  if (!error) {
                    setProductModalOpen(false);
                  }
                }}>
                  <div className="card-header">
                    <div>
                      <p className="card-title">{editingId ? `Editar ${config.label.toLowerCase()}` : config.actionLabel}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => { setProductModalOpen(false); clearModuleForm(config.key); }}>Cerrar</button>
                  </div>

                  <div className="form-grid">{config.fields.map((field) => renderField(config.key, field))}</div>

                  {error ? <p className="error-message">{error}</p> : null}

                  <div className="button-row">
                    <button type="submit" className="primary">
                      {editingId ? 'Guardar cambios' : config.actionLabel}
                    </button>
                    <button type="button" className="secondary" onClick={() => clearModuleForm(config.key)}>
                      Limpiar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          <section className="card record-list" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div>
                <p className="card-title">{config.listLabel}</p>
                <p className="card-subtitle">Vista en tabla para consultar y administrar registros de productos.</p>
              </div>
            </div>

            {loading ? <p className="muted">Cargando productos...</p> : null}

            {!loading && tableRows.length === 0 ? <p className="muted">Aun no hay registros.</p> : null}

            {!loading && tableRows.length > 0 ? (
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Productos</th>
                      <th>Proveedores</th>
                      <th>Valores de Mercado</th>
                      <th>Codigo Producto</th>
                      <th>Cantidad disponible</th>
                      <th>Categoria</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.supplier || '-'}</td>
                        <td>{formatMoney(row.marketValue)}</td>
                        <td>{row.sku || '-'}</td>
                        <td>{row.stock || 0}</td>
                        <td>{row.category || '-'}</td>
                        <td><span className={`inventory-status ${row.status === 'Activo' ? 'ok' : row.status === 'Descontinuado' ? 'danger' : 'warning'}`}>{row.status}</span></td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="text-button" onClick={() => { startEditRecord(config.key, { id: row.id, data: row }); setProductModalOpen(true); }}>Editar</button>
                            <button type="button" className="text-button danger" onClick={() => handleDeleteRecord(config.key, row.id)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </section>
      </>
    );
  }

  async function handleSalesPdfExport() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(16, 26, 44);
    doc.roundedRect(28, 24, pageWidth - 56, 74, 14, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Reporte de Ventas', 44, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Listado de ventas registradas.', 44, 70);
    doc.text(`Generado: ${new Date().toLocaleString('es-CL')}`, 44, 88);

    doc.setTextColor(15, 23, 32);

    const rows = records.map((record) => {
      const data = record.data || {};
      const date = formatDateValue(data.date);
      const total = formatMoney(data.products?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0);
      return [
        `Venta #${record.id}`,
        date,
        data.customer || 'Mostrador',
        data.paymentMethod || 'Efectivo',
        data.status || 'Cerrada',
        total
      ];
    });

    autoTable(doc, {
      startY: 112,
      head: [['ID Venta', 'Fecha', 'Cliente', 'Método de Pago', 'Estado', 'Total']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
      headStyles: { fillColor: [16, 26, 44], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      margin: { left: 40, right: 40 }
    });

    const pdfBlob = doc.output('blob');
    const formData = new FormData();
    formData.append('file', pdfBlob, `ventas-${Date.now()}.pdf`);
    formData.append('type', 'PDF');
    
    uploadFormData('/api/export/save-local', formData)
      .then(resp => alert(resp.message || 'Exportación PDF guardada con éxito.'))
      .catch(err => alert('Error guardando PDF: ' + err.message));
  }

  async function handleSalesSubmit(event) {
    event.preventDefault();
    if (salesCart.length === 0) {
      setError('Añade al menos un producto a la venta.');
      return;
    }
    
    try {
      if (editingId) {
         await apiJson(`/api/modules/sales/records/${editingId}`, {
           method: 'PUT',
           body: JSON.stringify({ ...salesForm, products: salesCart })
         });
      } else {
        await apiJson('/api/modules/sales/records', {
          method: 'POST',
          body: JSON.stringify({ ...salesForm, products: salesCart })
        });
      }
      setSalesCart([]);
      setSalesForm({ date: new Date().toISOString().slice(0, 10), customer: '', paymentMethod: 'Efectivo', status: 'Cerrada', notes: '' });
      setSalesProductSelect({ productName: '', quantity: 1 });
      setSalesModalOpen(false);
      setEditingId(null);
      await refreshCurrentView();
      alert('Venta registrada con éxito.');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAddToCart() {
    if (!salesProductSelect.productName || salesProductSelect.quantity <= 0) {
      setError('Selecciona un producto y cantidad válida.');
      return;
    }
    const product = productsList.find(p => p.data?.name === salesProductSelect.productName);
    if (!product) return;
    
    const unitPrice = Number(product.data?.salePrice || 0);
    const existing = salesCart.find(item => item.productName === salesProductSelect.productName);
    
    if (existing) {
      setSalesCart(salesCart.map(item => item.productName === salesProductSelect.productName ? { ...item, quantity: item.quantity + Number(salesProductSelect.quantity) } : item));
    } else {
      setSalesCart([...salesCart, { productName: salesProductSelect.productName, quantity: Number(salesProductSelect.quantity), unitPrice }]);
    }
    setError('');
  }

  function renderSalesView(config) {
    const cartTotal = salesCart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const validProducts = productsList.map(p => p.data).filter(p => p && p.name);

    return (
      <>
        <p className="module-plain-description">{config.subtitle}</p>

        <section className="module-layout">
          <div className="button-row" style={{ marginBottom: 16, gridColumn: '1 / -1' }}>
            <button type="button" className="primary" onClick={() => { setSalesModalOpen(true); setSalesCart([]); setEditingId(null); setError(''); }}>
              Nueva Venta
            </button>
            <button type="button" className="secondary" onClick={() => handleExport(config.key)}>
              Descargar Excel
            </button>
            <button type="button" className="secondary" onClick={handleSalesPdfExport}>
              Descargar PDF
            </button>
          </div>

          {(salesModalOpen || editingId) ? (
            <div className="modal-overlay" onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSalesModalOpen(false);
                setEditingId(null);
              }
            }}>
              <div className="modal-card" style={{ maxWidth: '800px' }}>
                <form className="card module-form" style={{ margin: 0 }} onSubmit={handleSalesSubmit}>
                  <div className="card-header">
                    <div>
                      <p className="card-title">{editingId ? 'Editar Venta' : 'Nueva Venta (Punto de Venta)'}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => { setSalesModalOpen(false); setEditingId(null); }}>Cerrar</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="sales-subpanel" style={{ padding: 16, borderRadius: 12 }}>
                      <p className="card-subtitle" style={{ marginBottom: 12 }}>Agregar Producto</p>
                      <label>
                        Producto
                        <select value={salesProductSelect.productName} onChange={(e) => setSalesProductSelect(s => ({ ...s, productName: e.target.value }))}>
                          <option value="">-- Seleccionar --</option>
                          {validProducts.map(p => <option key={p.name} value={p.name}>{p.name} ({formatMoney(p.salePrice)})</option>)}
                        </select>
                      </label>
                      <label style={{ marginTop: 12 }}>
                        Cantidad
                        <input type="number" min="1" value={salesProductSelect.quantity} onChange={(e) => setSalesProductSelect(s => ({ ...s, quantity: e.target.value }))} />
                      </label>
                      <button type="button" className="secondary" style={{ marginTop: 16, width: '100%' }} onClick={handleAddToCart}>Agregar al Carrito</button>
                    </div>

                    <div className="sales-subpanel" style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
                      <p className="card-subtitle" style={{ marginBottom: 12 }}>Carrito de Compra</p>
                      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200 }}>
                        {salesCart.length === 0 ? <p className="muted" style={{ fontSize: '0.9rem' }}>El carrito está vacío.</p> : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                            {salesCart.map((item, i) => (
                              <li key={i} className="sales-cart-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8 }}>
                                <div>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{item.productName}</div>
                                  <div style={{ fontSize: '0.8rem', color: '#9fb0d6' }}>{item.quantity} x {formatMoney(item.unitPrice)}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <strong style={{ color: '#4ea7ff' }}>{formatMoney(item.quantity * item.unitPrice)}</strong>
                                  <button type="button" className="text-button danger" style={{ fontSize: '0.8rem' }} onClick={() => setSalesCart(salesCart.filter((_, index) => index !== i))}>X</button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #232d3f', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        <span>TOTAL:</span>
                        <span style={{ color: '#ffcf70' }}>{formatMoney(cartTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label>Fecha <input type="date" value={salesForm.date} onChange={e => setSalesForm(s => ({ ...s, date: e.target.value }))} required /></label>
                    <label>Cliente <input type="text" placeholder="Mostrador" value={salesForm.customer} onChange={e => setSalesForm(s => ({ ...s, customer: e.target.value }))} /></label>
                    <label>Método de Pago <select value={salesForm.paymentMethod} onChange={e => setSalesForm(s => ({ ...s, paymentMethod: e.target.value }))}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select></label>
                    <label>Estado <select value={salesForm.status} onChange={e => setSalesForm(s => ({ ...s, status: e.target.value }))}><option>Cerrada</option><option>Pendiente</option><option>Anulada</option></select></label>
                  </div>
                  <label style={{ marginTop: 14 }}>Observaciones <textarea rows="2" value={salesForm.notes} onChange={e => setSalesForm(s => ({ ...s, notes: e.target.value }))}></textarea></label>

                  {error ? <p className="error-message">{error}</p> : null}

                  <div className="button-row" style={{ marginTop: 24 }}>
                    <button type="submit" className="primary">Completar Venta</button>
                    <button type="button" className="secondary" onClick={() => { setSalesCart([]); setError(''); }}>Limpiar Carrito</button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          <section className="card record-list" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div>
                <p className="card-title">{config.listLabel}</p>
              </div>
            </div>

            {loading ? <p className="muted">Cargando...</p> : null}
            {!loading && records.length === 0 ? <p className="muted">Aun no hay registros.</p> : null}

            {!loading && records.length > 0 ? (
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>ID Venta</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Artículos</th>
                      <th>Total</th>
                      <th>Método Pago</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => {
                      const data = row.data || {};
                      const total = data.products?.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) || 0;
                      return (
                        <tr key={row.id}>
                          <td><strong>#{row.id}</strong></td>
                          <td>{formatDateValue(data.date)}</td>
                          <td>{data.customer || 'Mostrador'}</td>
                          <td>{data.products?.length || 0} prod.</td>
                          <td><strong>{formatMoney(total)}</strong></td>
                          <td>{data.paymentMethod}</td>
                          <td><span className={`inventory-status ${data.status === 'Anulada' ? 'danger' : data.status === 'Pendiente' ? 'warning' : 'ok'}`}>{data.status}</span></td>
                          <td>
                            <div className="row-actions">
                              <button type="button" className="text-button" onClick={() => { 
                                startEditRecord(config.key, row); 
                                setSalesForm({ date: data.date || '', customer: data.customer || '', paymentMethod: data.paymentMethod || 'Efectivo', status: data.status || 'Cerrada', notes: data.notes || '' });
                                setSalesCart(data.products || []);
                                setSalesModalOpen(true);
                              }}>Ver / Editar</button>
                              <button type="button" className="text-button danger" onClick={() => handleDeleteRecord(config.key, row.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </section>
      </>
    );
  }

  function renderModuleRecords(moduleKey) {
    const config = getModuleConfig(moduleKey);

    if (moduleKey === 'inventory_control') {
      return renderInventoryControlView(config);
    }
    if (moduleKey === 'products') {
      return renderProductsView(config);
    }
    if (moduleKey === 'sales') {
      return renderSalesView(config);
    }

    return (
      <>
        <p className="module-plain-description">{config.subtitle}</p>

        <section className="module-layout">
          <form className="card module-form" onSubmit={(event) => handleModuleSubmit(moduleKey, event)}>
            <div className="card-header">
              <div>
                <p className="card-title">{editingId ? `Editar ${config.label.toLowerCase()}` : config.actionLabel}</p>
              </div>
              <span className="badge accent">{config.label}</span>
            </div>

            <div className="form-grid">{config.fields.map((field) => renderField(moduleKey, field))}</div>

            {error ? <p className="error-message">{error}</p> : null}

            <div className="button-row">
              <button type="submit" className="primary">
                {editingId ? 'Guardar cambios' : config.actionLabel}
              </button>
              <button type="button" className="secondary" onClick={() => clearModuleForm(moduleKey)}>
                Limpiar
              </button>
              <button type="button" className="secondary" onClick={() => handleExport(moduleKey)}>
                Descargar Excel
              </button>
              <button type="button" className="secondary" onClick={handleInventoryPdfExport}>
                Descargar PDF
              </button>
              <label className="secondary file-button">
                Cargar Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => handleImport(moduleKey, event.target.files?.[0])}
                />
              </label>
            </div>
          </form>

          <section className="card record-list">
            <div className="card-header">
              <div>
                <p className="card-title">{config.listLabel}</p>
                <p className="card-subtitle">Vista independiente para consultar y administrar registros.</p>
              </div>
            </div>

            {loading ? <p className="muted">Cargando {config.label.toLowerCase()}...</p> : null}

            {!loading && records.length === 0 ? <p className="muted">Aun no hay registros.</p> : null}

            <div className="record-stack">
              {records.map((record) => (
                <article key={record.id} className="record-card document-card">
                  <div className="record-topline">
                    <div>
                      <h3>{config.displayLabel(record.data)}</h3>
                      <p>ID {record.id} · {record.created_at}</p>
                    </div>
                  </div>

                  <dl className="record-grid">
                    {Object.entries(record.data)
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                  </dl>

                  <div className="idea-actions">
                    <button type="button" className="text-button" onClick={() => startEditRecord(moduleKey, record)}>
                      Editar
                    </button>
                    <button type="button" className="text-button danger" onClick={() => handleDeleteRecord(moduleKey, record.id)}>
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </>
    );
  }

  function renderDocumentsView() {
    const moduleOptions = MODULE_ORDER.filter((moduleKey) => ['products', 'inventory_control', 'sales', 'reports'].includes(moduleKey));

    return (
      <>
        <p className="module-plain-description">{getModuleConfig('documents').subtitle}</p>

        <section className="module-layout documents-layout">
          <form className="card module-form" onSubmit={handleDocumentUpload}>
            <div className="card-header">
              <div>
                <p className="card-title">Documentos y archivos</p>
              </div>
              <span className="badge accent">Documentos</span>
            </div>

          <label>
            Modulo relacionado
            <select value={documentForm.module} onChange={(event) => setDocumentForm((current) => ({ ...current, module: event.target.value }))}>
              {moduleOptions.map((moduleKey) => (
                <option key={moduleKey} value={moduleKey}>
                  {getModuleConfig(moduleKey).label}
                </option>
              ))}
            </select>
          </label>

          <label>
            ID de registro relacionado
            <input value={documentForm.record_id} onChange={(event) => setDocumentForm((current) => ({ ...current, record_id: event.target.value }))} placeholder="Opcional" />
          </label>

          <label>
            Descripcion
            <textarea rows="4" value={documentForm.description} onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))} placeholder="Factura, imagen, guia, reporte..." />
          </label>

          <label>
            Archivo
            <input type="file" onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
          </label>

          {error ? <p className="error-message">{error}</p> : null}

            <div className="button-row">
              <button type="submit" className="primary">Cargar archivo</button>
              <button type="button" className="secondary" onClick={loadDocuments}>Actualizar lista</button>
            </div>
          </form>

        <section className="card record-list">
          <div className="card-header">
            <div>
              <p className="card-title">{getModuleConfig('documents').listLabel}</p>
              <p className="card-subtitle">Descarga los archivos desde el almacenamiento local.</p>
            </div>
          </div>

          {loading ? <p className="muted">Cargando documentos...</p> : null}

          {!loading && documents.length === 0 ? <p className="muted">Aun no hay documentos cargados.</p> : null}

          <div className="record-stack">
            {documents.map((document) => (
              <article key={document.id} className="record-card document-card">
                <div className="record-topline">
                  <div>
                    <h3>{document.original_name}</h3>
                    <p>{document.module} · {Math.round((Number(document.size) || 0) / 1024)} KB</p>
                  </div>
                  <span className="badge">{document.mime_type}</span>
                </div>

                {document.description ? <p className="notes">{document.description}</p> : <p className="notes muted">Sin descripcion.</p>}

                <div className="idea-actions">
                  <button type="button" className="text-button" onClick={() => handleDownloadDocument(document.id, document.original_name)}>
                    Descargar
                  </button>
                  <button type="button" className="text-button danger" onClick={() => handleDeleteRecord('documents', document.id)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
          </section>
        </section>
      </>
    );
  }

  function renderDashboardView() {
    const chartFilterOptions = {
      bar: [
        { value: 'registros', label: 'Registros por módulo' },
        { value: 'productos_estado', label: 'Productos por estado' },
        { value: 'ventas_metodo', label: 'Ventas por método de pago' },
        { value: 'ventas_estado', label: 'Ventas por estado' },
        { value: 'reportes', label: 'Reportes por tipo' }
      ],
      line: [
        { value: 'sales_total', label: 'Total vendido por fecha' },
        { value: 'sales_count', label: 'Cantidad de ventas porcto' }
      ],
      pie: [
        { value: 'product_category', label: 'Productos por categoría' },
        { value: 'product_status', label: 'Productos por estado' },
        { value: 'sales_payment', label: 'Ventas por método de pago' },
        { value: 'sales_status', label: 'Ventas por estado' }
      ]
    };
    const activeFilter = chartFilters[chartMode];
    const activeFilterLabel = (chartFilterOptions[chartMode].find((option) => option.value === activeFilter) || chartFilterOptions[chartMode][0]).label;
    const lineGran = chartFilters.lineGranularity || 'month';
    const lineRange = chartFilters.lineRange || 'all';
    const rangeLabelMap = { all: 'Todo', 7: 'Últimos 7 días', 30: 'Últimos 30 días', 90: 'Últimos 90 días', 365: 'Últimos 365 días' };

    const activeChart =
      chartMode === 'bar'
        ? <BarChart data={dashboardInsights.barData} active />
        : chartMode === 'line'
          ? <LineChart data={dashboardInsights.lineData} active />
          : <PieChart data={dashboardInsights.pieData} active />;

    return (
      <>
        <p className="module-plain-description">{getModuleConfig('dashboard').subtitle}</p>

        <section className="dashboard-layout clean-dashboard">
          <section className="card dashboard-alerts-panel">
            <div className="card-header">
              <div>
                <p className="card-title">Alertas de inventario</p>
                <p className="card-subtitle">Señales rápidas para evitar compras de más, compras de menos y vencimientos.</p>
              </div>
              <span className="badge accent">Control</span>
            </div>

            <div className="alert-grid">
              <article className="alert-card danger">
                <span>Vencidos</span>
                <strong>{inventoryAlerts.expired.length}</strong>
                <p>{inventoryAlerts.expired[0]?.product ? `Revisar ${inventoryAlerts.expired[0].product}` : 'Sin productos vencidos detectados.'}</p>
              </article>
              <article className="alert-card warning">
                <span>Caducan en 30 días</span>
                <strong>{inventoryAlerts.expiringSoon.length}</strong>
                <p>{inventoryAlerts.expiringSoon[0]?.product ? `Priorizar ${inventoryAlerts.expiringSoon[0].product}` : 'No hay productos próximos a vencer.'}</p>
              </article>
              <article className="alert-card warning">
                <span>Stock bajo</span>
                <strong>{inventoryAlerts.lowStock.length}</strong>
                <p>{inventoryAlerts.lowStock[0]?.product ? `Falta reponer ${inventoryAlerts.lowStock[0].product}` : 'El stock se ve estable.'}</p>
              </article>
              <article className="alert-card">
                <span>Mayor inversión</span>
                <strong>{inventoryAlerts.highestInvestment ? formatMoney(inventoryAlerts.highestInvestment.investmentTotal) : formatMoney(0)}</strong>
                <p>{inventoryAlerts.highestInvestment?.product ? inventoryAlerts.highestInvestment.product : 'No hay registros de inversión.'}</p>
              </article>
            </div>
          </section>

          <section className="dashboard-charts card">
          <div className="card-header charts-header">
            <div>
              <p className="card-title">Dashboard con graficos</p>
              <p className="card-subtitle">Cada grafico tiene su propio filtro para mostrar exactamente la informacion que corresponde.</p>
            </div>
              <div className="chart-filters">
              <label>
                Vista
                <select value={chartMode} onChange={(event) => setChartMode(event.target.value)}>
                  <option value="bar">Barra</option>
                  <option value="line">Linea</option>
                  <option value="pie">Torta</option>
                </select>
              </label>
              <label>
                Filtro
                <select
                  value={activeFilter}
                  onChange={(event) => setChartFilters((current) => ({
                    ...current,
                    [chartMode]: event.target.value
                  }))}
                >
                  {chartFilterOptions[chartMode].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
                {chartMode === 'line' ? (
                  <>
                    <label>
                      Periodo
                      <select value={lineGran} onChange={(event) => updateChartFilters({ lineGranularity: event.target.value })}>
                        <option value="day">Dia</option>
                        <option value="week">Semana</option>
                        <option value="month">Mes</option>
                        <option value="year">Año</option>
                      </select>
                    </label>
                    <label>
                      Rango
                      <select value={lineRange} onChange={(event) => updateChartFilters({ lineRange: event.target.value })}>
                        <option value="all">Todo</option>
                        <option value="7">7 días</option>
                        <option value="30">30 días</option>
                        <option value="90">90 días</option>
                        <option value="365">365 días</option>
                      </select>
                    </label>

                    <div className="range-presets">
                      <button type="button" className={`range-btn ${lineRange === '7' ? 'active' : ''}`} onClick={() => updateChartFilters({ lineRange: '7' })}>7</button>
                      <button type="button" className={`range-btn ${lineRange === '30' ? 'active' : ''}`} onClick={() => updateChartFilters({ lineRange: '30' })}>30</button>
                      <button type="button" className={`range-btn ${lineRange === '90' ? 'active' : ''}`} onClick={() => updateChartFilters({ lineRange: '90' })}>90</button>
                      <button type="button" className={`range-btn ${lineRange === '365' ? 'active' : ''}`} onClick={() => updateChartFilters({ lineRange: '365' })}>365</button>
                      <button type="button" className={`range-btn ${lineRange === 'all' ? 'active' : ''}`} onClick={() => updateChartFilters({ lineRange: 'all' })}>Todo</button>
                    </div>
                  </>
                ) : null}
            </div>
          </div>

          <p className="chart-active-context">
            Mostrando: <strong>{chartMode === 'bar' ? dashboardInsights.meta.barLabel : chartMode === 'line' ? dashboardInsights.meta.lineLabel : dashboardInsights.meta.pieLabel}</strong> · Filtro activo: <strong>{activeFilterLabel}</strong>{chartMode === 'line' ? <> · Periodo: <strong>{lineGran}</strong> · Rango: <strong>{rangeLabelMap[lineRange]}</strong></> : null}
          </p>

          <div className="chart-grid single-chart">
            {activeChart}
          </div>
          </section>
        </section>
      </>
    );
  }



  function renderHomeView() {
    // Calcular estadísticas dinámicas para la tarjeta de bienvenida
    const salesData = (dashboardData.sales || []).map(r => r.data).filter(Boolean);
    const lastSaleDate = salesData.length > 0 
      ? salesData.map(s => new Date(s.date || s.createdAt || 0)).sort((a, b) => b - a)[0] 
      : null;
    const formattedLastSale = lastSaleDate && !isNaN(lastSaleDate) 
      ? lastSaleDate.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) 
      : 'Sin ventas recientes';

    const lastCloseRaw = localStorage.getItem('LAST_DAY_CLOSE');
    const lastCloseDate = lastCloseRaw ? new Date(lastCloseRaw) : null;
    const formattedLastClose = lastCloseDate && !isNaN(lastCloseDate)
      ? lastCloseDate.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
      : 'No registrado';

    const uniqueClients = new Set(salesData.map(s => (s.customer || '').trim().toLowerCase()).filter(c => c)).size;

    return (
      <>
        <p className="module-plain-description">Bienvenido a la sucursal de Temuco. Revisa el resumen general y navega a cada módulo desde el panel lateral.</p>

        <section className="dashboard-layout home-layout">
          <section className="card home-welcome">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div>
                <p className="card-title">Bienvenido a la sucursal de Temuco</p>
                <p className="card-subtitle">Gestion local de inventario, ventas y abastecimiento.</p>
              </div>
              <span className="badge accent">Inicio</span>
            </div>

            <div className="home-dynamic-stats">
              <div className="home-stat-box">
                <span className="stat-icon">🛍️</span>
                <div>
                  <p className="stat-label">Última Venta</p>
                  <p className="stat-value">{formattedLastSale}</p>
                </div>
              </div>
              <div className="home-stat-box">
                <span className="stat-icon">🔒</span>
                <div>
                  <p className="stat-label">Último Cierre Local</p>
                  <p className="stat-value">{formattedLastClose}</p>
                </div>
              </div>
              <div className="home-stat-box">
                <span className="stat-icon">👥</span>
                <div>
                  <p className="stat-label">Clientes Únicos</p>
                  <p className="stat-value">{uniqueClients}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="card home-summary">
            <div className="card-header">
              <div>
                <p className="card-title">Resumen general</p>
                <p className="card-subtitle">Indicadores clave del negocio.</p>
              </div>
            </div>

            <div className="stats-grid compact">
              {dashboardCards.map((card) => (
                <article key={card.label} className="stat-card">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </div>
          </section>
        </section>
      </>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Inventario local</p>
          <h2>Admin</h2>
        </div>

        <nav className="nav-list">
          {MODULE_ORDER.map((moduleKey) => {
            const IconComponent = MODULE_ICONS[moduleKey];
            return (
              <button
                key={moduleKey}
                type="button"
                className={`nav-item ${activeView === moduleKey ? 'active' : ''}`}
                onClick={() => {
                  setEditingId(null);
                  setActiveView(moduleKey);
                }}
              >
                {IconComponent && <IconComponent size={20} />}
                <span className="nav-item-label">{MODULE_LABELS[moduleKey]}</span>
              </button>
            );
          })}
        </nav>

        <button type="button" className="secondary logout-button" onClick={logout}>
          Cerrar sesion
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar card">
          <div>
            <p className="card-title">{activeModule?.title}</p>
            <p className="card-subtitle">{activeModule?.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="primary" onClick={handleDayCloseExport}>Cierre del dia (Excel + PDF)</button>
            <span className={`badge ${dayClosePrepared ? 'success' : 'accent'}`}>
              {dayClosePrepared ? 'Cierre listo' : 'Sesion activa'}
            </span>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}

        {activeView === 'home' ? renderHomeView() : null}
        {activeView === 'dashboard' ? renderDashboardView() : null}
        {activeView === 'documents' ? renderDocumentsView() : null}
        {activeView === 'settings' ? (
          <SettingsPanel settings={settings} saveSettings={saveSettings} adminUser={adminUser} saveAdmin={saveAdmin} />
        ) : activeView !== 'home' && activeView !== 'dashboard' && activeView !== 'documents' ? renderModuleRecords(activeView) : null}
      </section>

      {isRestockModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <form onSubmit={handleRestockSubmit}>
              <div className="card-header">
                <div>
                  <p className="card-title">Reabastecer inventario</p>
                  <p className="card-subtitle">Selecciona un producto y la cantidad a añadir.</p>
                </div>
              </div>
              <label>
                Producto
                <select
                  value={restockForm.productName}
                  onChange={(e) => setRestockForm(current => ({ ...current, productName: e.target.value }))}
                >
                  <option value="">Selecciona un producto</option>
                  {inventoryRows.map(row => (
                    <option key={row.id} value={row.product}>{row.product}</option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad a añadir
                <input
                  type="number"
                  min="1"
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm(current => ({ ...current, quantity: e.target.value }))
                  }
                  placeholder="Ej: 50"
                />
              </label>
              {restockMessage ? <p className="muted">{restockMessage}</p> : null}
              <div className="button-row">
                <button type="submit" className="primary">Confirmar reabastecimiento</button>
                <button type="button" className="secondary" onClick={() => setRestockModalOpen(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function App() {
  const [logged, setLogged] = useState(isLoggedIn());

  if (!logged) {
    return <LoginScreen onLogin={() => setLogged(true)} />;
  }

  return <AppShell />;
}
