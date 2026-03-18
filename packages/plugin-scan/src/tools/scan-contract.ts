import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { goPlusService } from '../index.js';

const ScanContractSchema = z.object({
  address: z.string().describe('Contract address on BNB Chain'),
});

type ScanContractParams = z.infer<typeof ScanContractSchema>;

interface DexPair {
  baseToken: { name: string; symbol: string };
  priceUsd: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number; h1?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  txns?: { h24?: { buys: number; sells: number }; h1?: { buys: number; sells: number } };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  dexId?: string;
}

function fmt(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(10);
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function sign(n: number): string {
  return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
}

export const scanContractTool: CocoTool<ScanContractParams> = {
  id: 'scan.contract',
  triggers: ['scan', 'contract', 'security', '审计', '安全', '分析'],
  description: 'Full token analysis: security scan + DEX price + liquidity + holder distribution. Returns a formatted report.',
  schema: ScanContractSchema,
  async execute(ctx, params): Promise<ToolResult> {
    const address = params.address.trim();

    // 1. GoPlus security scan
    const scan = await goPlusService.scan(address, ctx.chainId);
    const raw = scan.raw as Record<string, unknown>;

    // 2. DexScreener price data
    let dex: DexPair | null = null;
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const dexData = (await dexRes.json()) as { pairs?: DexPair[] };
      if (dexData.pairs && dexData.pairs.length > 0) {
        // Pick highest liquidity pair
        dex = dexData.pairs.sort(
          (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
        )[0] ?? null;
      }
    } catch { /* DexScreener optional */ }

    // 3. Build formatted report
    const lines: string[] = [];
    const tokenName = (raw['token_name'] as string) ?? dex?.baseToken?.name ?? 'Unknown';
    const tokenSymbol = (raw['token_symbol'] as string) ?? dex?.baseToken?.symbol ?? '???';

    lines.push(`📋 ${tokenName} (${tokenSymbol}) 合约分析报告`);
    lines.push(`合约: ${address}`);
    lines.push('');

    // Security
    lines.push(`🔒 安全评分: ${scan.trustScore}/100`);
    const isOpenSource = raw['is_open_source'] === '1' ? '✅ 是' : '❌ 否';
    const isHoneypot = raw['is_honeypot'] === '1' ? '🚨 是！' : '✅ 否';
    const canMint = raw['is_mintable'] === '1' ? '⚠️ 可增发' : '✅ 不可增发';
    const ownerRenounced = raw['owner_address'] === '0x0000000000000000000000000000000000000000' ? '✅ 已放弃' : '⚠️ 未放弃';
    lines.push(`  开源: ${isOpenSource} | 蜜罐: ${isHoneypot} | ${canMint} | 所有权: ${ownerRenounced}`);
    if (scan.risks.length > 0) {
      lines.push(`  ⚠️ 风险项: ${scan.risks.join(', ')}`);
    }
    lines.push('');

    // Tax
    const buyTax = raw['buy_tax'] ? `${(Number(raw['buy_tax']) * 100).toFixed(1)}%` : '0%';
    const sellTax = raw['sell_tax'] ? `${(Number(raw['sell_tax']) * 100).toFixed(1)}%` : '0%';
    lines.push(`💰 买卖税率: 买入 ${buyTax} | 卖出 ${sellTax}`);
    if (Number(raw['buy_tax']) > 0.1 || Number(raw['sell_tax']) > 0.1) {
      lines.push('  🚨 高税率警告！超过 10%');
    }
    lines.push('');

    // Holder distribution from GoPlus
    const holders = raw['holders'] as Array<{ address: string; percent: string; is_locked?: number; is_contract?: number }> | undefined;
    const holderCount = raw['holder_count'] as string | undefined;
    if (holders && holders.length > 0) {
      const top10 = holders.slice(0, 10);
      const top10Pct = top10.reduce((sum, h) => sum + Number(h.percent) * 100, 0);
      lines.push(`🐋 持仓分布: 前10持仓占 ${top10Pct.toFixed(2)}% | 总持有人 ${holderCount ?? 'N/A'}`);
      const topHolderStr = top10.slice(0, 5).map((h, i) =>
        `  ${i + 1}. ${(Number(h.percent) * 100).toFixed(2)}%${h.is_locked === 1 ? ' 🔒锁仓' : ''}${h.is_contract === 1 ? ' 📄合约' : ''}`
      ).join('\n');
      lines.push(topHolderStr);
    } else {
      lines.push(`🐋 持有人: ${holderCount ?? 'N/A'}`);
    }
    lines.push('');

    // Price & Liquidity from DexScreener
    if (dex) {
      const price = Number(dex.priceUsd) || 0;
      const liq = dex.liquidity?.usd ?? 0;
      const vol24 = dex.volume?.h24 ?? 0;
      const change24 = dex.priceChange?.h24;
      const change1h = dex.priceChange?.h1;
      const fdv = dex.fdv ?? 0;
      const mcap = dex.marketCap ?? 0;

      lines.push(`📊 价格: $${fmt(price)}${change24 != null ? ` | 24h: ${sign(change24)}` : ''}${change1h != null ? ` | 1h: ${sign(change1h)}` : ''}`);
      lines.push(`  流动性: ${fmtUsd(liq)} | 24h交易量: ${fmtUsd(vol24)}`);
      lines.push(`  FDV: ${fmtUsd(fdv)} | 市值: ${fmtUsd(mcap)}`);

      // Buy/sell pressure
      const buys24 = dex.txns?.h24?.buys ?? 0;
      const sells24 = dex.txns?.h24?.sells ?? 0;
      const total24 = buys24 + sells24;
      if (total24 > 0) {
        const buyPct = ((buys24 / total24) * 100).toFixed(1);
        lines.push(`  24h买/卖: ${buys24}/${sells24} (买入占${buyPct}%)`);
      }

      // Pair age
      if (dex.pairCreatedAt) {
        const ageMs = Date.now() - dex.pairCreatedAt;
        const ageDays = Math.floor(ageMs / 86_400_000);
        lines.push(`  交易对创建: ${ageDays}天前 | DEX: ${dex.dexId ?? 'PancakeSwap'}`);
      }
    } else {
      lines.push('📊 价格: 未找到 DEX 交易对');
    }
    lines.push('');

    // Risk summary
    const riskItems: string[] = [];
    if (scan.trustScore < 60) riskItems.push('🔴 安全评分偏低');
    if (Number(raw['buy_tax']) > 0.05 || Number(raw['sell_tax']) > 0.05) riskItems.push('🔴 存在买卖税');
    if (raw['is_honeypot'] === '1') riskItems.push('🔴 蜜罐风险！');
    if (raw['can_take_back_ownership'] === '1') riskItems.push('🟡 所有者可收回权限');
    if (dex && (dex.liquidity?.usd ?? 0) < 50000) riskItems.push('🟡 流动性不足 $50K');
    if (dex && (dex.liquidity?.usd ?? 0) < 10000) riskItems.push('🔴 流动性极低');
    if (holders) {
      const top1Pct = Number(holders[0]?.percent ?? 0) * 100;
      if (top1Pct > 20) riskItems.push(`🔴 第一大持仓占 ${top1Pct.toFixed(1)}%`);
    }

    if (riskItems.length > 0) {
      lines.push('⚠️ 风险提示:');
      riskItems.forEach(r => lines.push(`  ${r}`));
    } else {
      lines.push('✅ 未发现明显风险');
    }
    lines.push('');

    // Recommendation
    let recommendation = '🎯 操作建议: ';
    if (raw['is_honeypot'] === '1' || scan.trustScore < 30) {
      recommendation += '❌ 不建议买入 — 存在严重安全风险';
    } else if (scan.trustScore < 60 || Number(raw['sell_tax']) > 0.1 || (dex && (dex.liquidity?.usd ?? 0) < 10000)) {
      recommendation += '⚠️ 不建议买入 — 风险较高，需谨慎';
    } else if (scan.trustScore < 80 || (dex && (dex.liquidity?.usd ?? 0) < 50000)) {
      recommendation += '🟡 谨慎观望 — 安全面基本合格但需关注流动性';
    } else {
      recommendation += '✅ 可以考虑 — 安全评分高，流动性充足。注意控制仓位，DYOR';
    }
    lines.push(recommendation);

    const report = lines.join('\n');

    return {
      success: true,
      data: {
        trustScore: scan.trustScore,
        risks: scan.risks,
        tokenName,
        tokenSymbol,
        price: dex ? Number(dex.priceUsd) : null,
        liquidity: dex?.liquidity?.usd ?? null,
        volume24h: dex?.volume?.h24 ?? null,
        holderCount: holderCount ?? null,
        recommendation,
      },
      text: report,
    };
  },
};
