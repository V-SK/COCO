/**
 * Dynamic tool router — selects relevant tools based on message content
 * instead of flooding the LLM with all 90+ tool definitions.
 *
 * This keeps the LLM context small and dramatically improves function-calling
 * reliability on smaller models (e.g. Qwen 72B).
 */

interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Tools that are ALWAYS available regardless of message content. */
const CORE_TOOLS = new Set([
  'scan.contract',
  'price.get',
  'swap.quote',
  'swap.execute',
  'wallet.get-balance',
]);

/**
 * Tool groups — each group has trigger patterns and a list of tool IDs.
 * When a user message matches any pattern, all tools in that group become available.
 */
const TOOL_GROUPS: Array<{
  patterns: RegExp[];
  tools: string[];
}> = [
  // Contract / token analysis
  {
    patterns: [/0x[a-fA-F0-9]{40}/, /合约|contract|扫描|scan|分析|安全|审计|honeypot|蜜罐/i],
    tools: ['scan.contract', 'price.get', 'dex.token-info', 'trust-score.get-trust-score'],
  },
  // Trading / swap
  {
    patterns: [/买|卖|swap|交易|exchange|trade|兑换|buy|sell|购买|出售/i],
    tools: ['swap.quote', 'swap.execute', 'dex-agg.get-best-quote', 'dex-agg.execute-swap', 'wallet.get-balance'],
  },
  // Price / market data
  {
    patterns: [/价格|price|行情|涨|跌|market|k线|走势/i],
    tools: ['price.get', 'dex.token-info'],
  },
  // Wallet
  {
    patterns: [/余额|balance|钱包|wallet|转账|transfer|地址|address/i],
    tools: ['wallet.get-balance', 'wallet.transfer', 'custody.get-address'],
  },
  // News
  {
    patterns: [/新闻|news|消息|资讯|sentiment|舆情/i],
    tools: ['news.get-news', 'news.search-news', 'news.get-sentiment'],
  },
  // Whale / on-chain alerts
  {
    patterns: [/鲸鱼|whale|大户|监控|alert|提醒|watch/i],
    tools: ['whale-alert.get-whale-moves', 'whale-alert.add-alert', 'chain-events.watch-address'],
  },
  // History
  {
    patterns: [/历史|history|记录|交易记录|tx/i],
    tools: ['history.get-tx-history', 'history.get-token-txs'],
  },
  // Copy trade
  {
    patterns: [/跟单|copy.?trade|跟踪|follow/i],
    tools: ['copy-trade.follow-wallet', 'copy-trade.list-followed', 'copy-trade.get-wallet-trades'],
  },
  // Auto trade / strategy
  {
    patterns: [/自动|auto.?trade|策略|strategy|止损|止盈|stop.?loss|take.?profit/i],
    tools: ['auto-trade.start-strategy', 'auto-trade.stop-strategy', 'auto-trade.get-positions', 'auto-trade.set-stop-loss', 'auto-trade.set-take-profit'],
  },
  // NFT
  {
    patterns: [/nft|nfa/i],
    tools: ['nft.get-nfts', 'nft.get-nft-detail', 'nft.transfer-nft', 'nfa.mint-identity', 'nfa.get-identity'],
  },
  // Report
  {
    patterns: [/报告|report|分析报告|总结/i],
    tools: ['report.generate-report'],
  },
];

/** Maximum number of tools to send to LLM in a single request. */
const MAX_TOOLS = 15;

/**
 * Select relevant tools for the current message.
 * Also considers recent conversation context (last assistant message with tool_calls).
 */
export function selectTools(
  allTools: ToolDef[],
  userMessage: string,
  recentToolIds?: string[],
): ToolDef[] {
  const selected = new Set<string>(CORE_TOOLS);

  // Add tools from matching groups
  for (const group of TOOL_GROUPS) {
    if (group.patterns.some((p) => p.test(userMessage))) {
      for (const toolId of group.tools) {
        selected.add(toolId);
      }
    }
  }

  // If a tool was just called, keep related tools available for follow-up
  if (recentToolIds) {
    for (const id of recentToolIds) {
      selected.add(id);
      // Find the group this tool belongs to and include siblings
      for (const group of TOOL_GROUPS) {
        if (group.tools.includes(id)) {
          for (const toolId of group.tools) {
            selected.add(toolId);
          }
        }
      }
    }
  }

  // Filter allTools to only selected ones, respecting MAX_TOOLS
  const filtered = allTools.filter((t) => selected.has(t.function.name));
  return filtered.slice(0, MAX_TOOLS);
}
