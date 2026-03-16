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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Scan
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">
            {formatAddress(result.address)}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(result.address);
              showToast('合约地址已复制', 'success');
            }}
            className="text-sm text-slate-300 transition hover:text-white"
          >
            复制
          </button>
          <a
            href={`https://bscscan.com/address/${result.address}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary transition hover:text-primary-hover"
          >
            BscScan
          </a>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">安全评分</span>
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
        <div className="h-2 rounded-full bg-background">
          <div
            className={`h-2 rounded-full ${scoreColor}`}
            style={{ width: `${Math.max(6, result.trustScore)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          风险项
        </p>
        {result.risks.length > 0 ? (
          result.risks.map((risk) => (
            <div
              key={risk}
              className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-slate-200"
            >
              {risk}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-slate-200">
            未发现明显高危项
          </div>
        )}
      </div>

      {summary ? (
        <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-slate-300">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
