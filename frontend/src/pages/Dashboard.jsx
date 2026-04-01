import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dashboard as dashApi } from '@/lib/api'

// Module-level cache: volver al Dashboard reutiliza los datos sin re-fetch
let _dashCache = null;
let _dashCacheTime = 0;
const DASH_TTL = 3 * 60 * 1000; // 3 minutos
import { Building2, FolderOpen, AlertCircle, Calendar, Clock, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function addYears(dateStr, years) {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function daysFromNow(date) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - now) / (1000 * 60 * 60 * 24))
}

function fmtShort(date) {
  return new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: 'short' }).format(date)
}

function dotColor(days) {
  if (days < 0) return 'bg-destructive'
  if (days <= 30) return 'bg-warning'
  if (days <= 90) return 'bg-primary/60'
  return 'bg-muted-foreground/25'
}

export default function Dashboard() {
  const [empresas, setEmpresas] = useState([])
  const [proyectosMap, setProyectosMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = Date.now()
    if (_dashCache && (now - _dashCacheTime) < DASH_TTL) {
      setEmpresas(_dashCache.empresas)
      setProyectosMap(_dashCache.proyectosMap)
      setLoading(false)
      return
    }
    dashApi.load()
      .then((emps) => {
        const map = {}
        emps.forEach(e => { map[e.id] = e.proyectos || [] })
        setEmpresas(emps)
        setProyectosMap(map)
        _dashCache = { empresas: emps, proyectosMap: map }
        _dashCacheTime = Date.now()
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allProyectos = useMemo(() =>
    Object.entries(proyectosMap).flatMap(([empId, projs]) =>
      projs.map(p => ({ ...p, empresaId: empId }))
    ), [proyectosMap])

  // ── List events: -2 weeks to +12 months ──────────────────────────────────
  const timelineEvents = useMemo(() => {
    const pastLimit = new Date(); pastLimit.setDate(pastLimit.getDate() - 14)
    const futureLimit = new Date(); futureLimit.setMonth(futureLimit.getMonth() + 12)

    const events = []
    allProyectos.forEach(p => {
      if (!p.fecha_presentacion || !p.duracion_seguimiento) return
      const empresa = empresas.find(e => String(e.id) === String(p.empresaId))
      const mesAnio = new Intl.DateTimeFormat('es-UY', { month: 'short', year: 'numeric' })
        .format(new Date(p.fecha_presentacion))
      const sublabel = empresa?.nombre ? `${empresa.nombre} · ${mesAnio}` : `Proyecto ${mesAnio}`

      for (let yr = 1; yr <= p.duracion_seguimiento; yr++) {
        const date = addYears(p.fecha_presentacion, yr)
        if (date >= pastLimit && date <= futureLimit) {
          events.push({ key: `${p.id}-yr${yr}`, date, year: yr, total: p.duracion_seguimiento, sublabel, empresa, proyecto: p })
        }
      }
    })
    return events.sort((a, b) => a.date - b.date)
  }, [allProyectos, empresas])

  // ── Strip events: -3 months to +6 months ─────────────────────────────────
  const strip = useMemo(() => {
    const start = new Date(); start.setMonth(start.getMonth() - 3); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setMonth(end.getMonth() + 6); end.setHours(23, 59, 59, 999)
    const totalMs = end - start

    const pct = (date) => Math.max(0, Math.min(100, (date - start) / totalMs * 100))

    const events = []
    allProyectos.forEach(p => {
      if (!p.fecha_presentacion || !p.duracion_seguimiento) return
      const empresa = empresas.find(e => String(e.id) === String(p.empresaId))
      for (let yr = 1; yr <= p.duracion_seguimiento; yr++) {
        const date = addYears(p.fecha_presentacion, yr)
        if (date >= start && date <= end) {
          const days = daysFromNow(date)
          events.push({
            key: `${p.id}-yr${yr}`,
            date,
            pct: pct(date),
            days,
            tooltip: `${empresa?.nombre || 'Proyecto'} · Control año ${yr} · ${fmtShort(date)}`,
            empresa,
            proyecto: p,
          })
        }
      }
    })

    // Month markers within window
    const months = []
    const cursor = new Date(start)
    cursor.setDate(1)
    cursor.setMonth(cursor.getMonth() + 1)
    while (cursor <= end) {
      const p = pct(new Date(cursor))
      if (p > 2 && p < 98) {
        months.push({
          key: cursor.toISOString(),
          pct: p,
          label: new Intl.DateTimeFormat('es-UY', { month: 'short' }).format(cursor),
        })
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }

    return { events, months, todayPct: pct(new Date()) }
  }, [allProyectos, empresas])

  // ── Derived counts ────────────────────────────────────────────────────────
  const upcomingCount = useMemo(() =>
    timelineEvents.filter(e => { const d = daysFromNow(e.date); return d >= 0 && d <= 90 }).length,
    [timelineEvents])

  const recentProyectos = useMemo(() =>
    [...allProyectos]
      .filter(p => p.fecha_creacion)
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .slice(0, 7),
    [allProyectos])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Inicio</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Resumen general de la plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Building2,   label: 'Empresas',                   value: empresas.length,    urgent: false },
          { icon: FolderOpen,  label: 'Proyectos',                  value: allProyectos.length, urgent: false },
          { icon: AlertCircle, label: 'Controles en próximos 90d',  value: upcomingCount,       urgent: upcomingCount > 0 },
        ].map(({ icon: Icon, label, value, urgent }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', urgent ? 'bg-warning/10' : 'bg-accent')}>
                  <Icon size={16} strokeWidth={1.8} className={urgent ? 'text-warning' : 'text-primary'} />
                </div>
                <div>
                  <p className="text-[10.5px] text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
                  <p className="text-[22px] font-semibold text-foreground leading-tight">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Horizontal timeline strip */}
      <Card>
        <CardContent className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} strokeWidth={1.8} className="text-muted-foreground" />
            <span className="text-[13px] font-semibold text-foreground/80">Vista general</span>
            <span className="ml-auto text-[10.5px] text-muted-foreground/50">3 meses atrás · hoy · 6 meses adelante</span>
          </div>

          {/* Strip */}
          <div className="relative h-14 select-none">
            {/* Horizontal axis line */}
            <div className="absolute top-5 left-0 right-0 h-px bg-border" />

            {/* Month markers */}
            {strip.months.map(m => (
              <div key={m.key} className="absolute top-0 bottom-0 flex flex-col" style={{ left: `${m.pct}%` }}>
                <div className="absolute top-5 w-px h-2 bg-border/50 -translate-x-px" />
                <span className="absolute bottom-0 text-[10px] text-muted-foreground/40 -translate-x-1/2 whitespace-nowrap">
                  {m.label}
                </span>
              </div>
            ))}

            {/* Today marker */}
            <div className="absolute top-0 bottom-0" style={{ left: `${strip.todayPct}%` }}>
              <div className="absolute top-1 bottom-4 w-px bg-primary/40 -translate-x-px" />
              <span className="absolute top-0 text-[9.5px] font-semibold text-primary/60 -translate-x-1/2 whitespace-nowrap tracking-wide uppercase">
                Hoy
              </span>
            </div>

            {/* Event dots */}
            {strip.events.map(e => (
              <Link
                key={e.key}
                to={`/empresas/${e.empresa?.id}/proyectos/${e.proyecto.id}`}
                title={e.tooltip}
                className="absolute top-5 -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${e.pct}%` }}
              >
                <div className={cn(
                  'w-3.5 h-3.5 rounded-full border-2 border-card transition-transform group-hover:scale-125',
                  dotColor(e.days),
                )} />
              </Link>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-1 pt-3 border-t border-border/50">
            {[
              { color: 'bg-destructive',      label: 'Vencido' },
              { color: 'bg-warning',           label: 'Urgente (≤30d)' },
              { color: 'bg-primary/60',        label: 'Próximo (≤90d)' },
              { color: 'bg-muted-foreground/25', label: 'Planificado' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />
                <span className="text-[10.5px] text-muted-foreground/50">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* List + Recent */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* Timeline list */}
        <Card>
          <CardHeader className="p-5 pb-0">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <Calendar size={14} strokeWidth={1.8} className="text-muted-foreground" />
              <CardTitle className="text-[13px] font-semibold text-foreground/80">Próximos controles</CardTitle>
              <span className="ml-auto text-[10.5px] text-muted-foreground/50">Próximos 12 meses</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {timelineEvents.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/50 py-10 text-center">Sin controles en el período.</p>
            ) : (
              <div className="divide-y divide-border">
                {timelineEvents.map(event => {
                  const days = daysFromNow(event.date)
                  const isOverdue = days < 0
                  const isUrgent = days >= 0 && days <= 30
                  const isSoon   = days > 30 && days <= 90

                  return (
                    <Link
                      key={event.key}
                      to={`/empresas/${event.empresa?.id}/proyectos/${event.proyecto.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors"
                    >
                      <div className="w-12 shrink-0 text-right">
                        <span className="text-[11.5px] font-medium text-foreground/60 leading-tight block">
                          {fmtShort(event.date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/35">
                          {event.date.getFullYear()}
                        </span>
                      </div>

                      <div className="shrink-0">
                        <div className={cn('w-2 h-2 rounded-full', dotColor(days))} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-foreground/80 truncate leading-tight">
                          {event.sublabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                          Control año {event.year} de {event.total}
                        </p>
                      </div>

                      <span className={cn(
                        'shrink-0 text-[10.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                        isOverdue ? 'bg-destructive/10 text-destructive'
                          : isUrgent ? 'bg-warning/10 text-warning'
                          : 'bg-accent text-muted-foreground/70',
                      )}>
                        {isOverdue ? `Hace ${Math.abs(days)}d` : days === 0 ? 'Hoy' : `En ${days}d`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent projects */}
        <Card>
          <CardHeader className="p-5 pb-0">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <Clock size={14} strokeWidth={1.8} className="text-muted-foreground" />
              <CardTitle className="text-[13px] font-semibold text-foreground/80">Proyectos recientes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentProyectos.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/50 py-10 text-center">Sin proyectos aún.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentProyectos.map(p => {
                  const empresa = empresas.find(e => String(e.id) === String(p.empresaId))
                  const mesAnio = p.fecha_presentacion
                    ? new Intl.DateTimeFormat('es-UY', { month: 'short', year: 'numeric' }).format(new Date(p.fecha_presentacion))
                    : String(p.anio_presentacion)
                  const label = p.expediente || mesAnio

                  return (
                    <Link
                      key={p.id}
                      to={`/empresas/${p.empresaId}/proyectos/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/40 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-md bg-accent border border-border flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-primary/70">
                          {empresa?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-foreground/80 truncate leading-tight">{label}</p>
                        <p className="text-[11px] text-muted-foreground/50 truncate">{empresa?.nombre}</p>
                      </div>
                      <ChevronRight size={13} className="text-muted-foreground/25 group-hover:text-muted-foreground/55 transition-colors shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
