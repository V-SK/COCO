import { useEffect, useState } from 'react';
import splashImg from '/coco-splash.jpg?url';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

  useEffect(() => {
    // Fade in complete → hold
    const t1 = setTimeout(() => setPhase('visible'), 600);
    // Start fade out
    const t2 = setTimeout(() => setPhase('exit'), 2400);
    // Done
    const t3 = setTimeout(onFinish, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500"
      style={{ opacity: phase === 'exit' ? 0 : 1 }}
    >
      {/* Character image */}
      <div
        className="relative flex-1 flex items-center justify-center w-full transition-all duration-700"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <img
          src={splashImg}
          alt=""
          className="h-full max-h-[70vh] w-auto object-contain"
        />
        {/* Gold glow effect */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 70%, rgba(240,185,11,0.12) 0%, transparent 60%)',
            animation: 'splashGlow 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Text section */}
      <div
        className="pb-16 text-center transition-all duration-700"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(12px)' : 'translateY(0)',
          transitionDelay: '200ms',
        }}
      >
        <h1 className="text-3xl font-bold tracking-wider text-white">
          Coco <span className="text-primary">AI</span>
        </h1>
        <p className="mt-2 text-xs tracking-widest text-neutral-500">
          YOUR INTELLIGENT CRYPTO COMPANION
        </p>
      </div>

      {/* Floating particles (CSS) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/30"
            style={{
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              left: `${10 + Math.random() * 80}%`,
              top: `${20 + Math.random() * 60}%`,
              animation: `splashParticle ${2 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes splashParticle {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 0.8; transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
