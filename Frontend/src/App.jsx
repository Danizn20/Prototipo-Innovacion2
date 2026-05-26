import { useEffect, useMemo, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { apiJson, downloadFile, uploadFormData } from './api.js';
import { AUTH_CREDENTIALS, getDefaultForm, getInitialForms, getModuleConfig, MODULE_LABELS, MODULE_ORDER } from './moduleConfig.js';

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

function buildInventoryRow(record) {
  const data = record.data || {};
  const quantity = Number(data.quantity || 0);
  const purchaseValue = Number(data.purchaseValue || 0);
  const saleValue = Number(data.saleValue || 0);
  const marketValue = Number(data.marketValue || 0);
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
  const isLowStock = quantity <= 20;
  const isExpired = daysToExpiry !== null && daysToExpiry < 0;
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30;

  return {
    ...record,
    product: data.product || '',
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
  const [activeView, setActiveView] = useState('home');
  const [summary, setSummary] = useState(null);
  const [dashboardData, setDashboardData] = useState({ products: [], sales: [], suppliers: [], product_values: [], inventory_control: [] });
  const [records, setRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [forms, setForms] = useState(getInitialForms());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionHasChanges, setSessionHasChanges] = useState(false);
  const [dayClosePrepared, setDayClosePrepared] = useState(false);
  const [documentForm, setDocumentForm] = useState({ module: 'products', record_id: '', description: '', file: null });
  const [chartMode, setChartMode] = useState('bar');
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

    const data = await apiJson(`/api/modules/${moduleKey}/records`);
    setRecords(data);
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

    // color-blind friendly palette
    const colorScale = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00'];

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
    const reports = dashboardData.reports.map((r) => r.data || {});
    if (chartFilters.bar === 'productos_estado') {
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
        { label: 'Productos', value: products.length, color: '#ffb64d' },
        { label: 'Proveedores', value: suppliers.length, color: '#4ea7ff' },
        { label: 'Ventas', value: sales.length, color: '#6ad1ff' },
        { label: 'Reportes', value: reports.length, color: '#f5d6c4' },
        { label: 'Inventario', value: inventoryControl.length, color: '#f2c7ad' },
        { label: 'Stock bajo', value: inventoryRows.filter(row => Number(row.quantity || 0) <= 20).length, color: '#ff8f4d' },
        { label: 'Ventas totales', value: summary.totalSales || 0, color: '#ffcf70' },
        { label: 'Registros', value: records.length, color: '#f5d6c4' },
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

  const inventoryRows = useMemo(() => records.map(buildInventoryRow), [records]);

  const [inventoryFilters, setInventoryFilters] = useState({ query: '', status: 'all', expiry: 'all', sort: 'expiryDate' });

  const visibleInventoryRows = useMemo(() => {
    const now = new Date();
    const soonThreshold = 30;

    const filtered = inventoryRows.filter((row) => {
      const query = inventoryFilters.query.trim().toLowerCase();
      const matchesQuery = !query || [row.product, row.notes].some((value) => String(value || '').toLowerCase().includes(query));
      const isLowStock = Number(row.quantity || 0) <= 20;
      const expiryDate = row.expiryDate ? new Date(row.expiryDate) : null;
      const daysToExpiry = expiryDate && !Number.isNaN(expiryDate.getTime())
        ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= soonThreshold && daysToExpiry >= 0;
      const isExpired = daysToExpiry !== null && daysToExpiry < 0;

      const matchesStatus = inventoryFilters.status === 'all'
        || (inventoryFilters.status === 'low_stock' && isLowStock)
        || (inventoryFilters.status === 'healthy' && !isLowStock)
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
        bars += `<rect x="${x}" y="${y}" width="${bw}" height="${barHeight}" fill="${item.color || '#ccc'}" rx="8"/>`;
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
        <div className="bar-chart">
          {data.map((item) => (
            <div key={item.label} className="bar-item">
              <div
                className="bar-fill"
                style={{ height: `${Math.max((item.value / maxValue) * 100, 8)}%`, background: item.color }}
                onMouseMove={(e) => onBarHover(e, item)}
                onMouseLeave={onLeave}
              />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{total ? `${Math.round((Number(item.value || 0) / total) * 100)}%` : '0%'}</em>
            </div>
          ))}
        </div>
        {tooltip.visible ? (
          <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>
        ) : null}
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
    const points = data.map((item, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (Number(item.value || 0) / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    });

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
        return `${x},${y}`;
      });

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

      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#071226'/><text x='${exportPadding}' y='34' font-size='18' font-weight='700' fill='#ffffff'>Grafico de linea - Total: ${totalV}</text><polyline points='${pathPoints.join(' ')}' fill='none' stroke='url(#lineExportGradient)' stroke-width='4'/><defs><linearGradient id='lineExportGradient' x1='0' x2='1' y1='0' y2='0'><stop offset='0%' stop-color='#ffb64d'/><stop offset='100%' stop-color='#4ea7ff'/></linearGradient></defs>${pointsLayer}</svg>`;
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
          {points.length > 1 ? (
            <path
              d={`M ${points.join(' L ')} L ${padding + (data.length - 1) * stepX},${height - padding} L ${padding},${height - padding} Z`}
              fill="url(#lineAreaGradient)"
            />
          ) : null}
          <polyline points={points.join(' ')} />
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
    let accumulated = 0;
    const radius = 82;
    const circumference = 2 * Math.PI * radius;
    const svgRef = useRef();
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

    async function exportPieAsPng() {
      const w = 700;
      const h = 420;
      const cx = 180;
      const cy = 210;
      const r = 110;
      const totalV = data.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0) || 1;
      const circumference = 2 * Math.PI * r;
      let strokeOffset = circumference;
      let slices = '';
      let legend = '';

      data.forEach((item, index) => {
        const value = Number(item.value || 0);
        const pct = Math.round((value / totalV) * 100);
        const dash = (value / totalV) * circumference;
        slices += `<circle cx='${cx}' cy='${cy}' r='${r}' fill='none' stroke='${item.color || '#ccc'}' stroke-width='46' stroke-dasharray='${dash} ${circumference - dash}' stroke-dashoffset='${strokeOffset}'/>`;
        strokeOffset -= dash;
        legend += `<rect x='390' y='${100 + (index * 40)}' width='16' height='16' rx='4' fill='${item.color || '#ccc'}'/><text x='414' y='${113 + (index * 40)}' font-size='13' fill='#ffffff'>${item.label}: ${value} (${pct}%)</text>`;
      });

      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#071226'/><text x='42' y='34' font-size='18' font-weight='700' fill='#ffffff'>Grafico de torta - Total: ${totalV}</text><circle cx='${cx}' cy='${cy}' r='${r}' fill='none' stroke='#10203d' stroke-width='46'/>${slices}<text x='${cx}' y='${cy - 4}' text-anchor='middle' font-size='24' font-weight='700' fill='#ffffff'>${totalV}</text><text x='${cx}' y='${cy + 20}' text-anchor='middle' font-size='12' fill='#dbe7ff'>Total</text>${legend}</svg>`;
      await exportSvgStringToPng(svg, `torta-${Date.now()}.png`, w, h);
    }

    function onSegmentHover(e, item) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltip({ visible: true, x: e.clientX - rect.left + 8, y: e.clientY - rect.top + 8, text: `${item.label}: ${item.value} (${Math.round((item.value/total)*100)}%)` });
    }

    function hideTooltip() { setTooltip((t) => ({ ...t, visible: false })); }

    return (
      <div className={`chart-card ${active ? 'active' : ''}`}>
        <div className="chart-title-row">
          <strong>Torta</strong>
          <span>Participacion porcentual</span>
          <div style={{ marginLeft: 12 }}>
            <button type="button" className="export-btn" onClick={exportPieAsPng}>Exportar</button>
          </div>
        </div>
        <div className="pie-layout">
          <svg ref={svgRef} viewBox="0 0 220 220" className="pie-chart">
            <circle cx="110" cy="110" r={radius} className="pie-base" />
            {data.map((item) => {
              const dash = (item.value / total) * circumference;
              const offset = circumference - accumulated;
              accumulated += dash;
              return (
                <circle key={item.label} cx="110" cy="110" r={radius} style={{ stroke: item.color, strokeDasharray: `${dash} ${circumference - dash}`, strokeDashoffset: offset }} onMouseMove={(e) => onSegmentHover(e, item)} onMouseLeave={hideTooltip} />
              );
            })}
            <text x="110" y="103" textAnchor="middle" className="pie-center-value">{total}</text>
            <text x="110" y="123" textAnchor="middle" className="pie-center-label">Total</text>
          </svg>
          {tooltip.visible ? (<div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>) : null}
          <div className="pie-legend">
            {data.map((item) => (
              <div key={item.label} className="pie-legend-item">
                <span style={{ background: item.color }} />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.value} · {Math.round((item.value / total) * 100)}%</p>
                </div>
              </div>
            ))}
          </div>
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
      await downloadFile(`/api/modules/${moduleKey}/export`, `${moduleKey}.xlsx`);
    } catch (requestError) {
      setError(requestError.message);
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

    doc.save(`inventario-${Date.now()}.pdf`);
  }

  async function handleDayCloseExport() {
    try {
      const inventoryRaw = await apiJson('/api/modules/inventory_control/records');
      const inventoryBuilt = inventoryRaw.map(buildInventoryRow);
      const summaryBuilt = computeInventorySummaryFromRows(inventoryBuilt);

      await downloadFile('/api/modules/inventory_control/export', `inventario-cierre-${Date.now()}.xlsx`);
      handleInventoryPdfExport(inventoryBuilt, summaryBuilt);

      setDayClosePrepared(true);
      setSessionHasChanges(false);
      alert('Cierre del dia completado: se exportaron Excel y PDF.');
    } catch (requestError) {
      setError(requestError.message || 'No fue posible completar el cierre del dia.');
    }
  }

  function renderInventoryControlView(config) {
    const tableRows = visibleInventoryRows;

    return (
      <>
        <p className="module-plain-description">{config.subtitle}</p>

        <section className="module-layout inventory-layout">
          <form className="card module-form" onSubmit={(event) => handleModuleSubmit(config.key, event)}>
            <div className="card-header">
              <div>
                <p className="card-title">{editingId ? 'Editar registro de inventario' : config.actionLabel}</p>
              </div>
              <span className="badge accent">{config.label}</span>
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
              <button type="button" className="secondary" onClick={() => setRestockModalOpen(true)}>
                Reabastecimiento
              </button>
              <button type="button" className="secondary" onClick={() => handleExport(config.key)}>
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
                  onChange={(event) => handleImport(config.key, event.target.files?.[0])}
                />
              </label>
            </div>
          </form>

          <section className="card record-list inventory-record-list">
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
                  <option value="healthy">Stock normal</option>
                  <option value="low_stock">Stock bajo</option>
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
                      <th>Compra</th>
                      <th>Venta</th>
                      <th>Caducidad</th>
                      <th>Ingreso</th>
                      <th>Cantidad</th>
                      <th>Mercado</th>
                      <th>Inversión</th>
                      <th>Ingreso estimado</th>
                      <th>Margen</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} className={row.isExpired ? 'inventory-row-expired' : row.isExpiringSoon ? 'inventory-row-soon' : row.isLowStock ? 'inventory-row-low' : ''}>
                        <td>
                          <strong>{row.product || 'Producto'}</strong>
                          <span className="muted">ID {row.id}</span>
                        </td>
                        <td>{formatMoney(row.purchaseValue)}</td>
                        <td>{formatMoney(row.saleValue)}</td>
                        <td>{formatDateValue(row.expiryDate)}</td>
                        <td>{formatDateValue(row.entryDate)}</td>
                        <td>{row.quantity}</td>
                        <td>{formatMoney(row.marketValue)}</td>
                        <td>{formatMoney(row.investmentTotal)}</td>
                        <td>{formatMoney(row.incomeTotal)}</td>
                        <td>{formatMoney(row.projectedMargin)}</td>
                        <td>
                          <div className="row-actions">
                            <span className={`inventory-status ${row.isExpired ? 'danger' : row.isExpiringSoon ? 'warning' : row.isLowStock ? 'warning' : 'ok'}`}>
                              {row.isExpired ? 'Vencido' : row.isExpiringSoon ? 'Caduca pronto' : row.isLowStock ? 'Stock bajo' : 'Normal'}
                            </span>
                            <button type="button" className="text-button" onClick={() => startEditRecord(config.key, row)}>
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

  function renderModuleRecords(moduleKey) {
    const config = getModuleConfig(moduleKey);

    if (moduleKey === 'inventory_control') {
      return renderInventoryControlView(config);
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
              <button type="button" className="secondary" onClick={() => setRestockModalOpen(true)}>
                Reabastecimiento
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
    const moduleOptions = MODULE_ORDER.filter((moduleKey) => ['products', 'suppliers', 'product_values', 'inventory_control', 'sales', 'reports'].includes(moduleKey));

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
    return (
      <>
        <p className="module-plain-description">Bienvenido a la sucursal de Temuco. Revisa el resumen general y navega a cada módulo desde el panel lateral.</p>

        <section className="dashboard-layout home-layout">
          <section className="card home-welcome">
            <div className="card-header">
              <div>
                <p className="card-title">Bienvenido a la sucursal de Temuco</p>
                <p className="card-subtitle">Gestion local de inventario, ventas y abastecimiento.</p>
              </div>
              <span className="badge accent">Inicio</span>
            </div>

            <div className="dashboard-illustration-wrap">
              <ShoppingIllustration />
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
          {MODULE_ORDER.map((moduleKey) => (
            <button
              key={moduleKey}
              type="button"
              className={`nav-item ${activeView === moduleKey ? 'active' : ''}`}
              onClick={() => {
                setEditingId(null);
                setActiveView(moduleKey);
              }}
            >
              <span className="nav-item-label">{MODULE_LABELS[moduleKey]}</span>
            </button>
          ))}
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
                  onChange={(e) => setRestockForm(current => ({ ...current, productName: e.target.value }))
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
                  onChange={(e) => setRestockForm(current => ({ ...current, quantity: e.target.value }))}
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
