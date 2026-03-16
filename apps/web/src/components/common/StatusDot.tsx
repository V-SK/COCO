import { cn } from '@/utils/cn';

interface StatusDotProps {
  status: 'success' | 'warning' | 'error' | 'idle';
  label?: string | undefined;
}

export function StatusDot({ status, label }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          'inline-flex h-2.5 w-2.5 rounded-full',
          status === 'success' && 'animate-pulse-slow bg-success',
          status === 'warning' && 'animate-pulse-slow bg-warning',
          status === 'error' && 'animate-pulse-slow bg-error',
          status === 'idle' && 'bg-neutral-500',
        )}
      />
      {label ? <span className="text-sm text-neutral-300">{label}</span> : null}
    </span>
  );
}
