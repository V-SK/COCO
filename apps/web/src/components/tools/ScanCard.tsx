import { Badge } from '@/components/common/Badge';
import { useUiStore } from '@/stores/uiStore';
import type { ScanResultLike } from '@/types/toolResults';

interface ScanCardProps {
  result: ScanResultLike;
  summary?: string | undefined;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ScanCard({ result, summary }: ScanCardProps) {
  const showToast = useUiStore((state) => state.showToast);
  const scoreColor =
    result.trustScore >= 80
      ? 'bg-success'
      : result.trustScore >= 50
        ? 'bg-warning'
        : 'bg-error';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400">Contract Scan</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">
            {formatAddress(result.address)}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(result.address);
              showToast('合约地址已复制', 'success');
            }}
            className="rounded-md px-2 py-1 text-xs text-neutral-400 transition hover:bg-background/60 hover:text-white"
          >
            复制
          </button>
          <a
            href={`https://bscscan.com/address/${result.address}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-2 py-1 text-xs text-primary transition hover:bg-primary/10"
          >
            BscScan
          </a>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-neutral-400">安全评分</span>
          <Badge
            variant={
              result.trustScore >= 80
                ? 'success'
                : result.trustScore >= 50
                  ? 'warning'
                  : 'error'
            }
          >
            {result.trustScore}/100
          </Badge>
        </div>
        <div className="h-1.5 rounded-full bg-background/60">
          <div
            className={`h-1.5 rounded-full transition-all ${scoreColor}`}
            style={{ width: `${Math.max(6, result.trustScore)}%` }}
          />
        </div>
      </div>

      {result.risks.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-400">风险项</p>
          {result.risks.map((risk) => (
            <div
              key={risk}
              className="rounded-lg bg-error/10 px-3 py-2 text-xs text-neutral-200"
            >
              {risk}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-success/10 px-3 py-2 text-xs text-neutral-200">
          未发现明显高危项
        </div>
      )}

      {summary ? (
        <p className="text-xs leading-5 text-neutral-400">{summary}</p>
      ) : null}
    </div>
  );
}
