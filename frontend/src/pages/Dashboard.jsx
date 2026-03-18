import { Building2 } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 shadow-sm">
        <Building2 size={28} className="text-primary/70" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Bienvenido</h1>
      <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed text-[13px]">
        Selecciona una empresa o proyecto desde el menú lateral para ver sus detalles y comenzar a trabajar.
      </p>
    </div>
  )
}
