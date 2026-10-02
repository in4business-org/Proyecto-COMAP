import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Bell, Shield, User, Palette, LogOut } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '../context/AuthContext'

const sections = [
  {
    icon: User,
    title: 'Perfil',
    description: 'Nombre, correo electrónico y datos personales.',
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    description: 'Preferencias de alertas y notificaciones del sistema.',
  },
  {
    icon: Shield,
    title: 'Seguridad',
    description: 'Contraseña, autenticación de dos factores y sesiones activas.',
  },
  {
    icon: Palette,
    title: 'Apariencia',
    description: 'Tema, idioma y preferencias de visualización.',
  },
]

export default function UserSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [saliendo, setSaliendo] = useState(false)

  const email = user?.email || ''
  const nombre = user?.name || user?.['cognito:username'] || email

  const handleLogout = async () => {
    setSaliendo(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-accent border border-border">
          <Settings size={18} className="text-primary" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">Gestioná tus preferencias personales y de cuenta.</p>
        </div>
      </div>

      {/* Sesión actual */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-accent">
              <User size={15} className="text-primary" strokeWidth={1.8} />
            </div>
            <CardTitle className="text-[14px]">Sesión actual</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{nombre}</p>
              {email && email !== nombre && (
                <p className="text-[12px] text-muted-foreground truncate">{email}</p>
              )}
            </div>
            <Button
              onClick={handleLogout}
              disabled={saliendo}
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <LogOut size={14} />
              {saliendo ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="opacity-60 cursor-not-allowed select-none">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-accent">
                  <Icon size={15} className="text-muted-foreground" strokeWidth={1.8} />
                </div>
                <CardTitle className="text-[14px]">{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-[12.5px]">{description}</CardDescription>
              <p className="mt-3 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                Próximamente
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
