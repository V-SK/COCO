import type { CocoPlugin } from '@coco/core';
import { GoPlusService } from './goplus.js';
import { scanContractTool } from './tools/scan-contract.js';

export let goPlusService = new GoPlusService();

export function setGoPlusService(service: GoPlusService): void {
  goPlusService = service;
}

export const scanPlugin: CocoPlugin = {
  id: 'scan',
  name: 'Coco Scan',
  version: '1.0.0',
  description: 'GoPlus contract risk scanning',
  async setup() {
    setGoPlusService(new GoPlusService());
  },
  tools: [scanContractTool],
};

export default scanPlugin;
