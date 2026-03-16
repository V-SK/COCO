import { cn } from '@/utils/cn';

interface CocoLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function CocoLogo({
  size = 32,
  className,
  animate = false,
}: CocoLogoProps) {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        className,
      )}
    >
      <img
        src="/logo-icon-transparent.png"
        alt="Coco AI"
        width={size}
        height={size}
        className="object-contain"
      />
      {animate ? (
        <div
          className="absolute animate-pulse-slow rounded-full bg-teal-400/30"
          style={{
            width: size * 0.35,
            height: size * 0.35,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ) : null}
    </div>
  );
}
