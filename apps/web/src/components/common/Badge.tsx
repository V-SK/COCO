import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'primary';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variant === 'default' && 'bg-background text-neutral-300',
        variant === 'success' && 'bg-success/10 text-success',
        variant === 'warning' && 'bg-warning/10 text-warning',
        variant === 'error' && 'bg-error/10 text-error',
        variant === 'primary' && 'bg-primary/15 text-primary',
      )}
    >
      {children}
    </span>
  );
}
