import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { admin as adminApi, empresas as empApi, proyectos as projApi } from '@/lib/api'
import { CAMPOS_EMPRESA, problemaRut } from '@/lib/empresa'
import { avisarCambio } from '@/lib/eventos'
import { useAuth } from '../context/AuthContext'
import { OpcionesContribuyente } from './empresa/DatosEmpresaDialog'
import { CamposProyecto } from './empresa/ProyectoDialogs'

const PASOS = [
  { titulo: 'Quién es', sub: 'RUT y nombre' },
  { titulo: 'Contacto', sub: 'Domicilios, teléfono, mail' },
  { titulo: 'Actividad', sub: 'Giro, CIIU, balance' },
  { titulo: 'Personas', sub: 'Quién carga información' },
  { titulo: 'Primer proyecto', sub: 'Año y años de control' },
]

const PERMISOS = {
  carga: { label: 'Carga documentos y comprobantes', rol: 'user', escritura: ['checklist', 'facturas', 'simulador'] },
  lectura: { label: 'Sólo mira', rol: 'user', escritura: [] },
  admin: { label: 'Administra la empresa', rol: 'admin_empresa', escritura: [] },
}

const titulo = 'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'
const limpiarRut = (v) => String(v || '').replace(/[\s.-]/g, '')
const campo = (k) => CAMPOS_EMPRESA.find((c) => c.key === k)

function Campo({ k, form, setForm, ayuda, ...props }) {
  const c = campo(k)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`ne-${k}`}>{c.label}{props.required && ' *'}</Label>
      <Input id={`ne-${k}`} type={c.tipo || 'text'} value={form[k] || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} {...props} />
      {(ayuda ?? c.ayuda) && <p className="text-[12px] text-muted-foreground">{ayuda ?? c.ayuda}</p>}
    </div>
  )
}

/** Personas a invitar: mail, nombre y qué pueden hacer */
function Personas({ personas, setPersonas, resultados }) {
  const cambiar = (i, k, v) => setPersonas((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)))
  return (
    <div className="space-y-3">
      {personas.map((p, i) => {
        const r = resultados[p.email?.trim().toLowerCase()]
        return (
          <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor={`p-email-${i}`}>Mail</Label>
              <Input id={`p-email-${i}`} type="email" value={p.email} disabled={!!r?.ok} onChange={(e) => cambiar(i, 'email', e.target.value)} placeholder="persona@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`p-nombre-${i}`}>Nombre <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id={`p-nombre-${i}`} value={p.nombre} disabled={!!r?.ok} onChange={(e) => cambiar(i, 'nombre', e.target.value)} />
            </div>
            <div className="flex items-end gap-1">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`p-permiso-${i}`}>Puede</Label>
                <select
                  id={`p-permiso-${i}`}
                  value={p.permiso}
                  disabled={!!r?.ok}
                  onChange={(e) => cambiar(i, 'permiso', e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm cursor-pointer"
                >
                  {Object.entries(PERMISOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {!r?.ok && (
                <Button variant="ghost" size="icon" onClick={() => setPersonas((ps) => ps.filter((_, j) => j !== i))} aria-label="Sacar a esta persona">
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
            {r && (
              <p className={cn('sm:col-span-3 text-[12px]', r.ok ? 'text-success' : 'text-destructive')}>
                {r.ok ? <><Check size={12} className="inline" aria-hidden="true" /> {r.texto}</> : r.texto}
              </p>
            )}
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={() => setPersonas((ps) => [...ps, { email: '', nombre: '', permiso: 'carga' }])}>
        <Plus size={14} aria-hidden="true" /> Agregar una persona
      </Button>
    </div>
  )
}

/** Alta de empresa en 5 pasos. Sólo RUT y nombre son obligatorios. */
export default function NuevaEmpresa() {
  const navigate = useNavigate()
  const { isMaster } = useAuth()
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState({ rut: '', nombre: '', tipo_contribuyente: 'No sé' })
  const [empresaId, setEmpresaId] = useState(null)
  const [existentes, setExistentes] = useState([])
  const [personas, setPersonas] = useState([{ email: '', nombre: '', permiso: 'carga' }])
  const [resultados, setResultados] = useState({})
  const [proyecto, setProyecto] = useState({ fecha_presentacion: '', anio_presentacion: new Date().getFullYear(), duracion_seguimiento: 5 })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  // Para avisar mientras se escribe si el RUT ya está cargado
  useEffect(() => { empApi.list().then(setExistentes).catch(() => setExistentes([])) }, [])

  const rut = limpiarRut(form.rut)
  const problema = rut.length >= 12 ? problemaRut(rut) : null
  const yaExiste = useMemo(() => existentes.find((e) => limpiarRut(e.rut) === rut && e.id !== empresaId), [existentes, rut, empresaId])
  const puedeGuardar = !problemaRut(rut) && form.nombre.trim() && !yaExiste

  if (!isMaster) return <Navigate to="/empresas" replace />

  const datosEmpresa = () => Object.fromEntries(
    CAMPOS_EMPRESA.filter((c) => !['rut'].includes(c.key)).map((c) => [c.key, form[c.key] || null])
  )

  /** Crea la empresa la primera vez y después la actualiza */
  const guardarEmpresa = async () => {
    if (!empresaId) {
      const { empresa_id } = await empApi.create(rut, form.nombre.trim(), datosEmpresa())
      setEmpresaId(empresa_id)
      avisarCambio('empresas')
      return empresa_id
    }
    await empApi.update(empresaId, datosEmpresa())
    avisarCambio('empresas')
    return empresaId
  }

  const invitar = async (id) => {
    const nuevos = { ...resultados }
    for (const p of personas) {
      const email = p.email.trim().toLowerCase()
      if (!email || nuevos[email]?.ok) continue
      const permiso = PERMISOS[p.permiso]
      const acceso = { empresaId: id, escritura: permiso.escritura }
      try {
        await adminApi.crearUsuario({ email, nombre: p.nombre.trim() || undefined, rol: permiso.rol, enviarMail: true, accesos: [acceso] })
        nuevos[email] = { ok: true, texto: 'Le mandamos un mail para que entre.' }
      } catch (err) {
        if (err.status !== 409) { nuevos[email] = { ok: false, texto: err.message }; continue }
        // Ya tenía cuenta: le sumamos esta empresa sin tocar las otras
        try {
          const actuales = await adminApi.getAccesos(email)
          await adminApi.setAccesos(email, [...actuales.filter((a) => a.empresaId !== id), acceso])
          nuevos[email] = { ok: true, texto: 'Ya tenía cuenta: le agregamos esta empresa.' }
        } catch (err2) {
          nuevos[email] = { ok: false, texto: err2.message }
        }
      }
    }
    setResultados(nuevos)
    return Object.values(nuevos).every((r) => r.ok)
  }

  const ejecutar = async (fn) => {
    setGuardando(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      if (err.status === 409 && err.data?.empresa_id) {
        setError({ texto: err.message, link: `/empresas/${err.data.empresa_id}` })
      } else {
        setError({ texto: err.message })
      }
      return false
    } finally {
      setGuardando(false)
    }
  }

  const seguir = () => ejecutar(async () => {
    if (paso <= 2) await guardarEmpresa()
    if (paso === 3) {
      const id = empresaId || (await guardarEmpresa())
      if (!(await invitar(id))) return false
    }
    if (paso === 4) {
      const id = empresaId || (await guardarEmpresa())
      const anio = parseInt(proyecto.anio_presentacion)
      if (!anio) throw new Error('Poné el año de presentación')
      const { proyecto_id } = await projApi.create(id, anio, parseInt(proyecto.duracion_seguimiento) || 0, proyecto.fecha_presentacion || null)
      avisarCambio('proyectos', id)
      navigate(`/empresas/${id}/proyectos/${proyecto_id}/checklist`)
      return true
    }
    setPaso((p) => p + 1)
    return true
  })

  const terminarDespues = () => ejecutar(async () => {
    const id = await guardarEmpresa()
    navigate(`/empresas/${id}`)
    return true
  })

  const siguienteTexto = paso < 4 ? `Seguir: ${PASOS[paso + 1].titulo.toLowerCase()}` : 'Crear proyecto e ir al checklist'
  const rutEstado = !form.rut ? null : problema ? 'error' : yaExiste ? 'existe' : rut.length === 12 ? 'ok' : null

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-xl font-medium">Nueva empresa</h1>
        <p className="text-[13px] text-muted-foreground">Son 5 pasos cortos. Lo único obligatorio es el RUT y el nombre: el resto lo podés completar después.</p>
      </header>

      <ol aria-label="Pasos" className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {PASOS.map((p, i) => {
          const actual = i === paso
          const hecho = i < paso
          const puedeIr = empresaId && i !== paso
          return (
            <li key={p.titulo}>
              <button
                type="button"
                disabled={!puedeIr}
                onClick={() => setPaso(i)}
                aria-current={actual ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  actual ? 'border-primary bg-card shadow-sm' : 'border-border bg-transparent',
                  puedeIr && 'hover:bg-card cursor-pointer',
                  !puedeIr && !actual && 'cursor-default'
                )}
              >
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold', actual ? 'bg-primary text-primary-foreground' : hecho ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                  {hecho ? <Check size={13} aria-label="Hecho" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[13px] truncate', actual ? 'font-semibold' : 'text-muted-foreground')}>{p.titulo}</span>
                  <span className="hidden sm:block text-[11px] text-muted-foreground truncate">{p.sub}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <Card className="p-5 sm:p-6 space-y-5">
          <h2 className={titulo}>Paso {paso + 1} · {PASOS[paso].titulo}</h2>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error.texto}{error.link && <> · <Link to={error.link} className="font-medium underline">Ir a esa empresa</Link></>}</span>
            </p>
          )}

          {paso === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ne-rut">RUT *</Label>
                <div className="relative">
                  <Input
                    id="ne-rut"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.rut}
                    disabled={!!empresaId}
                    onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                    aria-invalid={rutEstado === 'error' || rutEstado === 'existe'}
                    aria-describedby="ne-rut-ayuda"
                    className={cn('font-mono pr-32', rutEstado === 'ok' && 'border-success', (rutEstado === 'error' || rutEstado === 'existe') && 'border-destructive')}
                  />
                  {rutEstado === 'ok' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[12px] font-semibold text-success">
                      <Check size={14} aria-hidden="true" /> RUT válido
                    </span>
                  )}
                </div>
                <p id="ne-rut-ayuda" className={cn('text-[12px]', rutEstado === 'error' || rutEstado === 'existe' ? 'text-destructive' : 'text-muted-foreground')}>
                  {rutEstado === 'error' && problema}
                  {rutEstado === 'existe' && <>Esta empresa ya está cargada como «{yaExiste.nombre}». <Link to={`/empresas/${yaExiste.id}`} className="font-medium underline">Ir a la empresa</Link></>}
                  {(!rutEstado || rutEstado === 'ok') && '12 números, sin puntos ni guiones. Si la empresa ya está cargada, te avisamos y te llevamos a ella.'}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo k="nombre" form={form} setForm={setForm} required ayuda="El que vas a ver en la lista de empresas." />
                <Campo k="razon_social" form={form} setForm={setForm} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Tipo de contribuyente</p>
                <OpcionesContribuyente value={form.tipo_contribuyente} onChange={(v) => setForm((f) => ({ ...f, tipo_contribuyente: v }))} name="ne-tipo" />
                <p className="text-[12px] text-muted-foreground">¿No sabés? Dejalo así y lo vemos con la gestora.</p>
              </div>
            </>
          )}

          {paso === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo k="domicilio_fiscal" form={form} setForm={setForm} />
              <Campo k="domicilio_constituido" form={form} setForm={setForm} />
              <Campo k="telefono" form={form} setForm={setForm} inputMode="tel" />
              <Campo k="email" form={form} setForm={setForm} />
            </div>
          )}

          {paso === 2 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Campo k="giro" form={form} setForm={setForm} /></div>
              <Campo k="codigo_ciiu" form={form} setForm={setForm} />
              <Campo k="fecha_balance" form={form} setForm={setForm} ayuda="Se usa en el cuadro de inversiones." />
            </div>
          )}

          {paso === 3 && (
            <>
              <p className="text-[13px] text-muted-foreground">
                Las personas que agregues reciben un mail para entrar y cargar lo suyo. Podés saltear este paso y sumarlas después desde Administración.
              </p>
              <Personas personas={personas} setPersonas={setPersonas} resultados={resultados} />
            </>
          )}

          {paso === 4 && (
            <>
              <p className="text-[13px] text-muted-foreground">Un proyecto es una presentación a la COMAP. Al crearlo te llevamos directo al checklist de documentos.</p>
              <CamposProyecto form={proyecto} setForm={setProyecto} idPrefijo="ne-proy" />
            </>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            {paso === 0 && !empresaId ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/empresas')}>Cancelar</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>Volver</Button>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {paso === 4 && empresaId && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/empresas/${empresaId}`)}>Terminar sin proyecto</Button>
              )}
              {paso < 4 && (
                <Button variant="outline" size="sm" onClick={terminarDespues} disabled={!puedeGuardar || guardando}>Guardar y terminar después</Button>
              )}
              <Button size="sm" onClick={seguir} disabled={!puedeGuardar || guardando}>
                {guardando ? <Spinner size={14} className="text-primary-foreground" /> : null}
                {siguienteTexto} {!guardando && <ArrowRight size={14} aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </Card>

        <aside className="space-y-3">
          <h2 className={titulo}>Tené a mano</h2>
          <Card className="p-4">
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted-foreground">
              <li>El RUT de la empresa</li>
              <li>Domicilio fiscal y constituido</li>
              <li>Teléfono y mail de contacto</li>
              <li>Giro y código CIIU (están en la constancia de DGI)</li>
              <li>Fecha del próximo balance</li>
              <li>Los mails de quienes van a cargar información</li>
            </ul>
          </Card>
          <h2 className={cn(titulo, 'pt-2')}>Después de esto</h2>
          <Card className="space-y-2.5 p-4 text-[13px] text-muted-foreground">
            <p><span className="font-semibold text-primary">1.</span> Creás el proyecto y respondés 5 preguntas sobre la empresa.</p>
            <p><span className="font-semibold text-primary">2.</span> Te mostramos sólo los documentos que le corresponden.</p>
            <p><span className="font-semibold text-primary">3.</span> Las personas invitadas reciben un mail para entrar y cargar lo suyo.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
