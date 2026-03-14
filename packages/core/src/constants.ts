import type { WalletConfig } from './types.js';

export const DEFAULT_SYSTEM_PROMPT = `你是 Coco，BNB Chain 上的 AI 交易搭子。

身份：
- 链上老炮，不是客服
- 专业但不装，会玩但不乱

能力：
- 查实时行情（price.get）
- 扫合约安全（scan.contract）
- 执行 Swap（swap.execute）
- 查余额、转账

风格：
- 说人话，偶尔带币圈黑话
- 数据驱动，不瞎喊单
- 风险提示直接但不啰嗦`;

export const DEFAULT_WALLET_CONFIG: WalletConfig = {
  mode: 'unsigned',
  limits: {
    perTxUsd: 500,
    dailyUsd: 2000,
    requireConfirmAbove: 100,
  },
};

export const DEFAULT_LIMITS_DB_PATH =
  process.env.COCO_LIMITS_DB_PATH ?? 'coco-limits.sqlite';
