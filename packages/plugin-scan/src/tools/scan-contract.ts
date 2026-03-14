import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { goPlusService } from '../index.js';

const ScanContractSchema = z.object({
  address: z.string().describe('Contract address on BNB Chain'),
});

type ScanContractParams = z.infer<typeof ScanContractSchema>;

export const scanContractTool: CocoTool<ScanContractParams> = {
  id: 'scan.contract',
  triggers: ['scan', 'contract', 'security', '审计', '安全'],
  description: 'Scan a BNB Chain contract for token risks using GoPlus.',
  schema: ScanContractSchema,
  async execute(ctx, params): Promise<ToolResult> {
    const result = await goPlusService.scan(params.address, ctx.chainId);
    const riskText =
      result.risks.length > 0 ? result.risks.join(', ') : '未发现明显高危项';

    return {
      success: true,
      data: result,
      text: `合约 ${params.address} 的 Trust Score 为 ${result.trustScore}/100，风险概览：${riskText}。`,
    };
  },
};
