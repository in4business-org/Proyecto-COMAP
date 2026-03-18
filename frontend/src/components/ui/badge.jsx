import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-primary/15 text-primary border-primary/20',
  secondary: 'bg-secondary text-secondary-foreground border-secondary',
  success: 'bg-success/15 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/20',
  destructive: 'bg-destructive/15 text-destructive border-destructive/20',
  outline: 'border-border text-foreground',
}

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
