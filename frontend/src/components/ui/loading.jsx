import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export function Spinner({ className, size = 20, ...props }) {
  return <Loader2 className={cn('animate-spin text-muted-foreground', className)} size={size} {...props} />
}

export function LoadingState({ message = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Spinner size={28} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {Icon && (
        <div className="rounded-xl bg-muted p-4">
          <Icon size={28} className="text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
