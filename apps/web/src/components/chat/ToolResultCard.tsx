import { PriceCard } from '@/components/tools/PriceCard';
import { ScanCard } from '@/components/tools/ScanCard';
import { SwapQuoteCard } from '@/components/tools/SwapQuoteCard';
import {
  TokenTradeCard,
  isTokenTradeData,
} from '@/components/tools/TokenTradeCard';
import { useChat } from '@/hooks/useChat';
import type { ToolResult } from '@/types';
import {
  isPriceResultLike,
  isScanResultLike,
  isSwapExecuteResultLike,
} from '@/types/toolResults';

interface ToolResultCardProps {
  toolId?: string | undefined;
  toolParams?: unknown;
  result?: ToolResult | undefined;
  content: string;
}

export function ToolResultCard({
  toolId,
  toolParams,
  result,
  content,
}: ToolResultCardProps) {
  const { sendMessage } = useChat();

  if (!result) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  if (toolId === 'swap.execute' && isSwapExecuteResultLike(result.data)) {
    return (
      <SwapQuoteCard
        result={result.data}
        summary={result.text ?? content}
        toolParams={toolParams}
      />
    );
  }

  if (toolId === 'price.get' && isPriceResultLike(result.data)) {
    return <PriceCard result={result.data} summary={result.text ?? content} />;
  }

  // scan.contract → show TokenTradeCard (with buy/sell buttons) instead of plain ScanCard
  if (toolId === 'scan.contract' && isTokenTradeData(result.data)) {
    return (
      <TokenTradeCard
        result={result.data}
        onBuy={(address, amountBnb) => {
          sendMessage(`买入 ${amountBnb} BNB 的 ${address}`);
        }}
        onSell={(address, percent) => {
          sendMessage(`卖出 ${percent}% 的 ${address}`);
        }}
      />
    );
  }

  // Fallback plain scan card (if data doesn't have trade fields)
  if (toolId === 'scan.contract' && isScanResultLike(result.data)) {
    return <ScanCard result={result.data} summary={result.text ?? content} />;
  }

  return <p className="whitespace-pre-wrap break-words">{content}</p>;
}
