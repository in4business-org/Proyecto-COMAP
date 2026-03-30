import { Users, UserPlus, Shield, Building2, Key } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const sections = [
  {
    icon: Users,
    title: 'Miembros',
    description: 'Ver y administrar los usuarios que forman parte de la organización.',
  },
  {
    icon: UserPlus,
    title: 'Invitaciones',
    description: 'Invitar nuevos usuarios y gestionar invitaciones pendientes.',
  },
  {
    icon: Shield,
    title: 'Roles y permisos',
    description: 'Definir niveles de acceso y permisos para cada rol dentro de la organización.',
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

export default function OrgSettings() {
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
