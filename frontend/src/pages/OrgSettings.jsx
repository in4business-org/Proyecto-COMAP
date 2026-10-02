import { Link } from 'react-router-dom'
import { Users, UserPlus, Shield, Building2, Key } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '../context/AuthContext'

// `href` apunta al panel de administración; esas tarjetas sólo quedan activas
// para administradores, el resto sigue en "próximamente".
const sections = [
  {
    icon: Users,
    title: 'Miembros',
    description: 'Ver y administrar los usuarios que forman parte de la organización.',
    href: '/admin',
  },
  {
    icon: UserPlus,
    title: 'Invitaciones',
    description: 'Invitar nuevos usuarios y gestionar invitaciones pendientes.',
    href: '/admin',
  },
  {
    icon: Shield,
    title: 'Roles y permisos',
    description: 'Definir niveles de acceso y permisos para cada rol dentro de la organización.',
    href: '/admin',
  },
  {
    icon: Building2,
    title: 'Datos de la organización',
    description: 'Información general, razón social y configuración de la cuenta.',
  },
  {
    icon: Key,
    title: 'Integraciones',
    description: 'Conectar servicios externos y gestionar claves de API.',
  },
]

function SectionCard({ icon: Icon, title, description, activa }) {
  return (
    <Card
      className={
        activa
          ? 'h-full transition-colors hover:bg-accent/50'
          : 'opacity-60 cursor-not-allowed select-none h-full'
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-accent">
            <Icon
              size={15}
              className={activa ? 'text-primary' : 'text-muted-foreground'}
              strokeWidth={1.8}
            />
          </div>
          <CardTitle className="text-[14px]">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-[12.5px]">{description}</CardDescription>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
          {activa ? 'Ir al panel' : 'Próximamente'}
        </p>
      </CardContent>
    </Card>
  )
}

export default function OrgSettings() {
  const { isAdmin } = useAuth()

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-accent border border-border">
          <Users size={18} className="text-primary" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organización</h1>
          <p className="text-sm text-muted-foreground">Administrá usuarios, roles y configuración de la organización.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => {
          const activa = Boolean(section.href) && isAdmin
          return activa ? (
            <Link key={section.title} to={section.href} className="block">
              <SectionCard {...section} activa />
            </Link>
          ) : (
            <SectionCard key={section.title} {...section} activa={false} />
          )
        })}
      </div>
    </div>
  )
}
