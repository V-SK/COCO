import type { ChainId } from '@/hooks/useTrendingPools';

const CHAINS: { id: ChainId; label: string; color: string }[] = [
  { id: 'bsc', label: 'BSC', color: '#F0B90B' },
  { id: 'eth', label: 'ETH', color: '#627EEA' },
  { id: 'solana', label: 'SOL', color: '#9945FF' },
  { id: 'base', label: 'BASE', color: '#0052FF' },
];

export function ChainFilter({
  active,
  onChange,
}: {
  active: ChainId;
  onChange: (chain: ChainId) => void;
}) {
  return (
    <div className="flex gap-2">
      {CHAINS.map((chain) => {
        const isActive = active === chain.id;
        return (
          <button
            key={chain.id}
            type="button"
            onClick={() => onChange(chain.id)}
            className={`
              relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5
              text-xs font-semibold
              transition-all duration-300 ease-out
              ${
                isActive
                  ? 'scale-105 text-white shadow-lg'
                  : 'scale-100 bg-surface/40 text-neutral-400 hover:bg-surface/70 hover:text-neutral-200'
              }
            `}
            style={
              isActive
                ? {
                    background: `linear-gradient(135deg, ${chain.color}25, ${chain.color}15)`,
                    border: `1px solid ${chain.color}50`,
                    boxShadow: `0 0 12px ${chain.color}20`,
                  }
                : { border: '1px solid transparent' }
            }
          >
            {/* Active glow dot */}
            {isActive && (
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: chain.color }}
              />
            )}
            <span>{chain.label}</span>
          </button>
        );
      })}
    </div>
  );
}
