import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'danger' | 'success' | 'warning' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        {
          'border-transparent bg-neutral-100 text-neutral-900': variant === 'default',
          'border-transparent bg-primary-500 text-white shadow hover:bg-primary-600': variant === 'primary',
          'border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200': variant === 'secondary',
          'border-transparent bg-accent-500 text-white shadow hover:bg-accent-600': variant === 'accent',
          'border-transparent bg-danger-50 text-danger-600': variant === 'danger',
          'border-transparent bg-success-50 text-success-600': variant === 'success',
          'border-transparent bg-warning-50 text-warning-600': variant === 'warning',
          'text-neutral-900 border-neutral-200': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}
