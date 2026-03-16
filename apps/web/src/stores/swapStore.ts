import type { SwapQuoteLike, UnsignedTxLike } from '@/types/toolResults';
import { create } from 'zustand';

interface PendingSwap {
  quote: SwapQuoteLike;
  tx: UnsignedTxLike;
}

interface SwapState {
  pendingSwap: PendingSwap | null;
  txStatus: 'idle' | 'signing' | 'pending' | 'success' | 'failed';
  txHash: string | null;
  txError: string | null;
  setPendingSwap: (swap: PendingSwap) => void;
  clearPendingSwap: () => void;
  setTxStatus: (status: SwapState['txStatus']) => void;
  setTxHash: (hash: string | null) => void;
  setTxError: (error: string | null) => void;
}

export const useSwapStore = create<SwapState>((set) => ({
  pendingSwap: null,
  txStatus: 'idle',
  txHash: null,
  txError: null,
  setPendingSwap: (swap) => {
    set({
      pendingSwap: swap,
      txStatus: 'idle',
      txHash: null,
      txError: null,
    });
  },
  clearPendingSwap: () => {
    set({
      pendingSwap: null,
      txStatus: 'idle',
      txHash: null,
      txError: null,
    });
  },
  setTxStatus: (status) => {
    set({ txStatus: status });
  },
  setTxHash: (hash) => {
    set({ txHash: hash });
  },
  setTxError: (error) => {
    set({ txError: error });
  },
}));
