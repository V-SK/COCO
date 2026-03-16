interface ToolLoadingProps {
  toolId: string;
}

const LABELS: Record<string, string> = {
  'price.get': '正在查询价格...',
  'scan.contract': '正在扫描合约...',
  'swap.execute': '正在生成交易报价...',
  'wallet.balance': '正在查询余额...',
  'wallet.transfer': '正在准备转账...',
  'news.get': '正在获取新闻...',
  'trust-score.check': '正在计算信任评分...',
  'whale-alert.scan': '正在扫描鲸鱼动向...',
  'auto-trade.start': '正在启动自动交易...',
  'auto-trade.status': '正在查询交易状态...',
  'copy-trade.start': '正在设置跟单...',
  'copy-trade.status': '正在查询跟单状态...',
  'dex-agg.quote': '正在聚合DEX报价...',
  'quant-signal.get': '正在计算量化信号...',
  'report.generate': '正在生成报告...',
  'alerts.create': '正在创建提醒...',
  'history.get': '正在查询历史记录...',
  'nft.detail': '正在查询NFT信息...',
  'nft.transfer': '正在准备NFT转账...',
  'knowledge.search': '正在检索知识库...',
  'memory.recall': '正在回忆...',
  'browser.navigate': '正在浏览网页...',
  'shell.exec': '正在执行命令...',
  'cron.create': '正在创建定时任务...',
  'vision.analyze': '正在分析图片...',
  'tts.speak': '正在生成语音...',
  'sql.query': '正在查询数据库...',
  'orchestrator.delegate': '正在协调子代理...',
  'chain-events.watch': '正在监听链上事件...',
  'webhook.send': '正在发送通知...',
  'polymarket.discover': '正在搜索预测市场...',
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
