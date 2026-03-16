import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string | undefined;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-2xl bg-surface/80', className)} />
  );
}
