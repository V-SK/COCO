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
      <div className="max-w-[85%] animate-fade-in rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-neutral-300">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-2 w-2 animate-pulse-slow rounded-full bg-primary" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}
