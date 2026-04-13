import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Helpers ───────────────────────────────────────────────

function formatMonto(monto, moneda) {
  if (monto == null) return '—';
  const formatted = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0 }).format(monto);
  return `${moneda || ''} ${formatted}`.trim();
}

function fmtUI(n) {
  return n == null ? '--' : `UI ${Math.round(n).toLocaleString('es-UY')}`;
}

function fmtPct(n, total) {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '--';
}

function getYearFromFechaEjecucion(fe) {
  if (!fe) return null;
  const parts = fe.split('/');
  if (parts.length === 3) return parseInt(parts[2]);
  return parseInt(fe.substring(0, 4));
}

function fmtEjercicio(fecha_ejecucion, anioBase) {
  if (!fecha_ejecucion || !anioBase) return '—';
  const year = getYearFromFechaEjecucion(fecha_ejecucion);
  if (!year) return '—';
  const n = year - anioBase;
  return n === 0 ? `Ejercicio 0 - ${anioBase}` : `Ejercicio ${n}`;
}

// ── Pantallas de estado ───────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Cargando proyecto...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-sm w-full mx-4 p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-2">
        <div className="text-2xl">🔒</div>
        <p className="font-semibold text-sm">Acceso no disponible</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ── Comprobantes Tab ──────────────────────────────────────

function ComprobantesTab({ facturas, token, cotizacion, anioBase, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const toUI = useCallback((monto, moneda) => {
    if (monto == null || !cotizacion) return null;
    const pesos = moneda === 'USD' ? monto * cotizacion.valor_usd : monto;
    return pesos / cotizacion.valor_ui;
  }, [cotizacion]);

  const kpis = useMemo(() => {
    if (!facturas.length || !cotizacion) return null;
    const withMonto = facturas.filter(f => f.monto != null);
    if (!withMonto.length) return null;

    const totalUI = withMonto.reduce((s, f) => s + (toUI(f.monto, f.moneda) ?? 0), 0);
    const facturaUI = withMonto.filter(f => f.tipo_comprobante === 'Factura')
      .reduce((s, f) => s + (toUI(f.monto, f.moneda) ?? 0), 0);
    const presupuestoUI = withMonto.filter(f => f.tipo_comprobante === 'Presupuesto')
      .reduce((s, f) => s + (toUI(f.monto, f.moneda) ?? 0), 0);

    const catMap = {};
    withMonto.forEach(f => {
      const cat = f.categoria || 'Sin categoría';
      catMap[cat] = (catMap[cat] || 0) + (toUI(f.monto, f.moneda) ?? 0);
    });
    const porCategoria = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, ui]) => ({ cat, ui }));

    const anioMap = {};
    withMonto.forEach(f => {
      const parts = (f.fecha || '').split('/');
      if (parts.length === 3) {
        const key = parts[2];
        if (!anioMap[key]) anioMap[key] = { anio: key, factura: 0, presupuesto: 0 };
        const ui = toUI(f.monto, f.moneda) ?? 0;
        if (f.tipo_comprobante === 'Factura') anioMap[key].factura += ui;
        else anioMap[key].presupuesto += ui;
      }
    });
    const porAnio = Object.values(anioMap)
      .sort((a, b) => a.anio.localeCompare(b.anio))
      .map(d => ({ ...d, label: d.anio }));

    return { totalUI, facturaUI, presupuestoUI, porCategoria, porAnio, total: facturas.length, conMonto: withMonto.length };
  }, [facturas, cotizacion, toUI]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('periodo', 'presentacion');
      const res = await fetch(`${BASE}/cliente/${token}/comprobantes`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const n = data.facturas?.length ?? 1;
      setUploadMsg(`${n} comprobante${n !== 1 ? 's' : ''} procesado${n !== 1 ? 's' : ''} correctamente`);
      onUploadSuccess();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="border border-dashed border-border rounded-xl p-5 text-center space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <div>
          <p className="text-sm font-medium">Subir comprobante</p>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, imagen — el sistema extrae los datos automáticamente</p>
        </div>
        {uploadMsg && <p className="text-xs text-green-600 dark:text-green-400">{uploadMsg}</p>}
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Seleccionar archivo
            </>
          )}
        </button>
      </div>

      {/* Métricas */}
      {kpis && (
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm space-y-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Resumen de inversión
          </h2>

          {/* Tarjetas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total inversión', val: fmtUI(kpis.totalUI), sub: `${kpis.total} comprobante${kpis.total !== 1 ? 's' : ''}` },
              { label: 'Facturas', val: fmtUI(kpis.facturaUI), sub: fmtPct(kpis.facturaUI, kpis.totalUI) + ' del total', color: 'text-primary' },
              { label: 'Presupuestos', val: fmtUI(kpis.presupuestoUI), sub: fmtPct(kpis.presupuestoUI, kpis.totalUI) + ' del total', color: 'text-yellow-600 dark:text-yellow-400' },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="bg-card border border-border/60 rounded-lg p-3">
                <p className={`text-[14px] font-medium truncate ${color || 'text-foreground'}`}>{val}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
                {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Gráfico por año */}
          {kpis.porAnio.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por año (UI)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={kpis.porAnio} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value, name) => [fmtUI(value), name === 'factura' ? 'Factura' : 'Presupuesto']}
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                    cursor={{ fill: 'var(--muted)', fillOpacity: 0.3 }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{value === 'factura' ? 'Factura' : 'Presupuesto'}</span>}
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 6 }}
                  />
                  <Bar dataKey="factura" name="factura" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="presupuesto" name="presupuesto" fill="var(--warning, #f59e0b)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Desglose por categoría */}
          {kpis.porCategoria.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por categoría (UI)</p>
              <div className="space-y-1.5">
                {kpis.porCategoria.map(({ cat, ui }) => {
                  const pct = (ui / kpis.porCategoria[0].ui) * 100;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-40 shrink-0 truncate">{cat}</span>
                      <div className="flex-1 bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-foreground w-28 text-right shrink-0">{fmtUI(ui)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      {facturas.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No hay comprobantes registrados aún.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Proveedor</th>
                <th className="text-left py-2 pr-4 font-medium">Descripción</th>
                <th className="text-left py-2 pr-4 font-medium">Categoría</th>
                <th className="text-left py-2 pr-4 font-medium">N° Comprobante</th>
                <th className="text-left py-2 pr-4 font-medium">Fecha</th>
                <th className="text-right py-2 pr-4 font-medium">Monto</th>
                <th className="text-left py-2 font-medium">Ejercicio</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-4">{f.proveedor || '—'}</td>
                  <td className="py-2 pr-4 text-muted-foreground max-w-50 truncate" title={f.descripcion || ''}>{f.descripcion || '—'}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{f.categoria || '—'}</td>
                  <td className="py-2 pr-4">{f.numero_factura || '—'}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{f.fecha || '—'}</td>
                  <td className="py-2 pr-4 text-right font-medium">{formatMonto(f.monto, f.moneda)}</td>
                  <td className="py-2 text-muted-foreground">{fmtEjercicio(f.fecha_ejecucion, anioBase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Checklist Tab (solo lectura) ──────────────────────────

function ChecklistTab({ checklist }) {
  const secciones = [];
  const seccionMap = {};
  for (const item of checklist.filter(i => i.estado !== 'no_aplica')) {
    if (!seccionMap[item.seccion]) {
      seccionMap[item.seccion] = [];
      secciones.push(item.seccion);
    }
    seccionMap[item.seccion].push(item);
  }

  return (
    <div className="space-y-6">
      {secciones.map(seccion => (
        <div key={seccion}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {seccion}
          </h3>
          <div className="space-y-2">
            {seccionMap[seccion].map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  item.estado === 'completado'
                    ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20'
                    : 'border-border bg-card'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.estado === 'completado' ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{item.id}. {item.descripcion}</p>
                  {item.nota && (
                    <p className="text-xs text-muted-foreground">{item.nota}</p>
                  )}
                  {item.nota_usuario && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">Nota: {item.nota_usuario}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {item.estado === 'completado' ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Completado
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Pendiente
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────

export default function ClienteView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('comprobantes');

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/cliente/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;

  const { empresa, proyecto, progreso, checklist, facturas } = data;

  // Armar objeto cotizacion desde los datos del proyecto
  const cotizacion = (proyecto.cotizacion_ui && proyecto.cotizacion_usd)
    ? { valor_ui: proyecto.cotizacion_ui, valor_usd: proyecto.cotizacion_usd }
    : null;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Portal de cliente</p>
            <h1 className="text-base font-semibold leading-tight">{empresa.nombre}</h1>
          </div>
          {proyecto.expediente && (
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
              {proyecto.expediente}
            </span>
          )}
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Info del proyecto */}
        <div className="flex flex-wrap gap-4 text-sm">
          {proyecto.anio_presentacion && (
            <div>
              <span className="text-muted-foreground">Año presentación: </span>
              <span className="font-medium">{proyecto.anio_presentacion}</span>
            </div>
          )}
          {proyecto.fecha_presentacion && (
            <div>
              <span className="text-muted-foreground">Fecha presentación: </span>
              <span className="font-medium">{proyecto.fecha_presentacion}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b flex gap-0">
          <button
            onClick={() => setActiveTab('comprobantes')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'comprobantes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Comprobantes
            {facturas.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {facturas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'checklist'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Checklist
            <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {progreso.completados}/{progreso.total}
            </span>
          </button>
        </div>

        {/* Contenido de la tab */}
        {activeTab === 'comprobantes' && (
          <ComprobantesTab
            facturas={facturas}
            token={token}
            cotizacion={cotizacion}
            anioBase={proyecto.anio_presentacion}
            onUploadSuccess={loadData}
          />
        )}
        {activeTab === 'checklist' && (
          <ChecklistTab checklist={checklist} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          Portal de cliente — COMAP
        </div>
      </footer>
    </div>
  );
}
