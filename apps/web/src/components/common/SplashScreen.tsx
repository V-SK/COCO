import { useEffect, useState } from 'react';
import splashImg from '/coco-splash.jpg?url';

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  size: 2 + ((i * 7 + 3) % 4),
  left: 8 + ((i * 23 + 11) % 84),
  top: 15 + ((i * 17 + 5) % 70),
  dur: 2.5 + ((i * 13) % 20) / 10,
  delay: ((i * 11) % 20) / 10,
}));

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 600);
    const t2 = setTimeout(() => setPhase('exit'), 2400);
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
      {/* Top glow effect */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-[40%]"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(240,185,11,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Character image — centered */}
      <div
        className="relative flex items-center justify-center transition-all duration-700"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <img
          src={splashImg}
          alt=""
          className="h-auto max-h-[55vh] w-auto object-contain"
          style={{
            maskImage: 'radial-gradient(ellipse 90% 85% at 50% 45%, black 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 85% at 50% 45%, black 55%, transparent 100%)',
          }}
        />
        {/* Character glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(240,185,11,0.15) 0%, transparent 70%)',
            animation: 'splashGlow 3s ease-in-out infinite',
          }}
        />
      </div>

      {/* Text section */}
      <div
        className="mt-8 text-center transition-all duration-700"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(16px)' : 'translateY(0)',
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

      {/* Bottom glow effect */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[30%]"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(240,185,11,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Floating particles (deterministic positions) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              top: `${p.top}%`,
              background: 'radial-gradient(circle, rgba(240,185,11,0.6) 0%, rgba(240,185,11,0) 70%)',
              boxShadow: '0 0 4px rgba(240,185,11,0.3)',
              animation: `splashParticle ${p.dur}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes splashParticle {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50% { opacity: 0.9; transform: translateY(-16px); }
        }
      `}</style>
    </div>
  );
}
