import { Badge } from '@/components/common/Badge';

interface ToolLoadingProps {
  toolId: string;
}

const LABELS: Record<string, string> = {
  'price.get': '正在查询价格...',
  'scan.contract': '正在扫描合约...',
  'swap.execute': '正在生成交易报价...',
};

export function ToolLoading({ toolId }: ToolLoadingProps) {
  const label = LABELS[toolId] ?? '正在执行工具...';

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-background-secondary px-4 py-3 text-sm text-slate-300 shadow-lg shadow-black/10 animate-fade-in animate-slide-up sm:max-w-[80%]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2.5 w-2.5 animate-pulse-slow rounded-full bg-primary" />
          <span>{label}</span>
          <Badge variant="primary">工具中</Badge>
        </div>
      </div>
    </div>
  );
}
