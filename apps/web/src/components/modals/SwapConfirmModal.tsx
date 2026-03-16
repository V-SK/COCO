import { Badge } from '@/components/common/Badge';
import { BottomSheet } from '@/components/modals/BottomSheet';
import { useSwapExecute } from '@/hooks/useSwapExecute';
import { useSwapStore } from '@/stores/swapStore';
import { useAccount } from 'wagmi';

function BscScanTxLink({ txHash }: { txHash: string }) {
  return (
    <a
      href={`https://bscscan.com/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="text-primary transition hover:text-primary-hover"
    >
      在 BscScan 查看
    </a>
  );
}

export function SwapConfirmModal() {
  const { isConnected } = useAccount();
  const pendingSwap = useSwapStore((state) => state.pendingSwap);
  const txStatus = useSwapStore((state) => state.txStatus);
  const txHash = useSwapStore((state) => state.txHash);
  const txError = useSwapStore((state) => state.txError);
  const clearPendingSwap = useSwapStore((state) => state.clearPendingSwap);
  const { execute } = useSwapExecute();

  if (!pendingSwap) {
    return null;
  }

  const disableClose = txStatus === 'signing' || txStatus === 'pending';
  const slippage =
    typeof pendingSwap.quote.slippageBps === 'number'
      ? `${(pendingSwap.quote.slippageBps / 100).toFixed(2)}%`
      : '—';
  const priceImpact =
    typeof pendingSwap.quote.priceImpact === 'number'
      ? `${pendingSwap.quote.priceImpact.toFixed(2)}%`
      : '—';
  const amountIn = Number(pendingSwap.quote.amountIn);
  const amountOut = Number(pendingSwap.quote.amountOut);
  const rate =
    Number.isFinite(amountIn) && amountIn > 0 && Number.isFinite(amountOut)
      ? (amountOut / amountIn).toFixed(6)
      : '—';

  return (
    <BottomSheet
      open={Boolean(pendingSwap)}
      onClose={() => {
        if (!disableClose) {
          clearPendingSwap();
        }
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Confirm Swap
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">确认交易</h2>
          </div>
          <button
            type="button"
            disabled={disableClose}
            onClick={() => {
              clearPendingSwap();
            }}
            className="rounded-full border border-border px-3 py-1 text-sm text-slate-300 transition hover:border-border-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            关闭
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              支出
            </p>
            <p className="mt-2 text-lg font-medium text-white">
              {pendingSwap.quote.amountIn} {pendingSwap.quote.tokenIn.symbol}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              获得
            </p>
            <p className="mt-2 text-lg font-medium text-white">
              {pendingSwap.quote.amountOut} {pendingSwap.quote.tokenOut.symbol}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              汇率
            </p>
            <p className="mt-2 text-white">
              1 {pendingSwap.quote.tokenIn.symbol} ≈ {rate}{' '}
              {pendingSwap.quote.tokenOut.symbol}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              滑点
            </p>
            <p className="mt-2 text-white">{slippage}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              价格影响
            </p>
            <p className="mt-2 text-white">{priceImpact}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Gas 预估
            </p>
            <p className="mt-2 text-white">钱包确认时计算</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            To
          </p>
          <p className="mt-2 break-all text-white">{pendingSwap.tx.to}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            Value
          </p>
          <p className="mt-2 text-white">{pendingSwap.tx.value ?? '0'}</p>
        </div>

        {txStatus === 'success' && txHash ? (
          <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <Badge variant="success">已确认</Badge>
              <p className="font-medium text-success">交易已确认</p>
            </div>
            <p className="mt-2 break-all">{txHash}</p>
            <div className="mt-2">
              <BscScanTxLink txHash={txHash} />
            </div>
          </div>
        ) : null}

        {txError ? (
          <div className="mt-4 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <Badge variant="error">失败</Badge>
              <p className="font-medium text-error">交易失败</p>
            </div>
            <p className="mt-2">{txError}</p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={disableClose}
            onClick={() => {
              clearPendingSwap();
            }}
            className="rounded-2xl border border-border px-4 py-3 text-sm text-slate-300 transition hover:border-border-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!isConnected || disableClose || txStatus === 'success'}
            onClick={() => {
              void execute(pendingSwap.tx);
            }}
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-black transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {txStatus === 'signing'
              ? '等待签名...'
              : txStatus === 'pending'
                ? '交易确认中...'
                : txStatus === 'success'
                  ? '已完成'
                  : '签名并发送'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
