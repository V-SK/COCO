import { useSwapStore } from '@/stores/swapStore';
import type { UnsignedTxLike } from '@/types/toolResults';
import { useEffect } from 'react';
import type { Address, Hex } from 'viem';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isHexString(value: string | undefined): value is Hex {
  return typeof value === 'string' && value.startsWith('0x');
}

export function useSwapExecute() {
  const txHash = useSwapStore((state) => state.txHash);
  const txStatus = useSwapStore((state) => state.txStatus);
  const setTxStatus = useSwapStore((state) => state.setTxStatus);
  const setTxHash = useSwapStore((state) => state.setTxHash);
  const setTxError = useSwapStore((state) => state.setTxError);
  const { sendTransactionAsync } = useSendTransaction();
  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash ? (txHash as Hex) : undefined,
    query: {
      enabled: Boolean(txHash) && txStatus === 'pending',
    },
  });

  useEffect(() => {
    if (txStatus === 'pending' && receiptQuery.isSuccess) {
      setTxStatus('success');
    }
  }, [receiptQuery.isSuccess, setTxStatus, txStatus]);

  useEffect(() => {
    if (txStatus === 'pending' && receiptQuery.error) {
      setTxStatus('failed');
      setTxError(
        toErrorMessage(receiptQuery.error, '等待链上确认时发生错误。'),
      );
    }
  }, [receiptQuery.error, setTxError, setTxStatus, txStatus]);

  async function execute(tx: UnsignedTxLike) {
    if (!isHexString(tx.to)) {
      setTxStatus('failed');
      setTxError('交易目标地址格式无效。');
      return;
    }

    setTxError(null);
    setTxHash(null);
    setTxStatus('signing');

    try {
      const hash = await sendTransactionAsync({
        to: tx.to as Address,
        data: isHexString(tx.data) ? tx.data : undefined,
        value: tx.value ? BigInt(tx.value) : undefined,
      });

      setTxHash(hash);
      setTxStatus('pending');
    } catch (error) {
      setTxStatus('failed');
      setTxError(toErrorMessage(error, '交易发送失败。'));
    }
  }

  return {
    execute,
    isReceiptLoading: receiptQuery.isLoading,
  };
}
