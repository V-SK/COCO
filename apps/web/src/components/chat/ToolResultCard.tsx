import { PriceCard } from '@/components/tools/PriceCard';
import { ScanCard } from '@/components/tools/ScanCard';
import { SwapQuoteCard } from '@/components/tools/SwapQuoteCard';
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

  if (toolId === 'scan.contract' && isScanResultLike(result.data)) {
    return <ScanCard result={result.data} summary={result.text ?? content} />;
  }

  return <p className="whitespace-pre-wrap break-words">{content}</p>;
}
