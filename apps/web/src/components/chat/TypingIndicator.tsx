export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 px-4 py-2">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-sm">🐕</span>
      </div>
      {/* Dots */}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface/60 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/70 animate-bounce"
            style={{
              animationDelay: `${i * 150}ms`,
              animationDuration: '0.8s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
