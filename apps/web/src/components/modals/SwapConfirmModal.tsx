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
      className="text-xs text-primary transition hover:text-primary-hover"
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">确认交易</h2>
          <button
            type="button"
            disabled={disableClose}
            onClick={() => {
              clearPendingSwap();
            }}
            className="rounded-lg px-2.5 py-1 text-xs text-neutral-400 transition hover:bg-surface hover:text-white disabled:opacity-40"
          >
            关闭
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          <div className="rounded-xl bg-background px-4 py-3">
            <p className="text-xs text-neutral-500">支出</p>
            <p className="mt-1.5 text-lg font-medium text-white">
              {pendingSwap.quote.amountIn} {pendingSwap.quote.tokenIn.symbol}
            </p>
          </div>
          <div className="rounded-xl bg-background px-4 py-3">
            <p className="text-xs text-neutral-500">获得</p>
            <p className="mt-1.5 text-lg font-medium text-white">
              {pendingSwap.quote.amountOut} {pendingSwap.quote.tokenOut.symbol}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-background px-3 py-2.5">
            <p className="text-xs text-neutral-500">汇率</p>
            <p className="mt-1 text-white">
              1 {pendingSwap.quote.tokenIn.symbol} ≈ {rate}{' '}
              {pendingSwap.quote.tokenOut.symbol}
            </p>
          </div>
          <div className="rounded-xl bg-background px-3 py-2.5">
            <p className="text-xs text-neutral-500">滑点</p>
            <p className="mt-1 text-white">{slippage}</p>
          </div>
          <div className="rounded-xl bg-background px-3 py-2.5">
            <p className="text-xs text-neutral-500">价格影响</p>
            <p className="mt-1 text-white">{priceImpact}</p>
          </div>
          <div className="rounded-xl bg-background px-3 py-2.5">
            <p className="text-xs text-neutral-500">Gas</p>
            <p className="mt-1 text-white">钱包确认时计算</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-background px-3 py-2.5 text-xs text-neutral-400">
          <p>
            To:{' '}
            <span className="break-all text-neutral-300">
              {pendingSwap.tx.to}
            </span>
          </p>
          <p className="mt-1">
            Value:{' '}
            <span className="text-neutral-300">
              {pendingSwap.tx.value ?? '0'}
            </span>
          </p>
        </div>

        {txStatus === 'success' && txHash ? (
          <div className="mt-3 rounded-xl bg-success/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="success">已确认</Badge>
              <span className="font-medium text-success">交易成功</span>
            </div>
            <p className="mt-2 break-all text-xs text-neutral-300">{txHash}</p>
            <div className="mt-1.5">
              <BscScanTxLink txHash={txHash} />
            </div>
          </div>
        ) : null}

        {txError ? (
          <div className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="error">失败</Badge>
              <span className="font-medium text-error">交易失败</span>
            </div>
            <p className="mt-2 text-xs text-neutral-300">{txError}</p>
          </div>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={disableClose}
            onClick={() => {
              clearPendingSwap();
            }}
            className="flex-1 rounded-xl bg-surface py-3 text-sm text-neutral-300 transition hover:bg-surface-hover hover:text-white disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!isConnected || disableClose || txStatus === 'success'}
            onClick={() => {
              void execute(pendingSwap.tx);
            }}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-black transition hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
          >
            {txStatus === 'signing'
              ? '等待签名...'
              : txStatus === 'pending'
                ? '确认中...'
                : txStatus === 'success'
                  ? '已完成'
                  : '签名并发送'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
