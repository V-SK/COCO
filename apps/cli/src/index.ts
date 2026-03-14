import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createWebConnector } from '@coco/connector-web';
import {
  type ChatEvent,
  type CocoContext,
  createRuntime,
  safeJsonStringify,
} from '@coco/core';
import { pricePlugin } from '@coco/plugin-price';
import { scanPlugin } from '@coco/plugin-scan';
import { swapPlugin } from '@coco/plugin-swap';
import { walletPlugin } from '@coco/plugin-wallet';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function buildBaseConfig() {
  return {
    llm: {
      provider: (process.env.COCO_LLM_PROVIDER ?? 'openai') as
        | 'openai'
        | 'vllm'
        | 'anthropic',
      baseUrl: requiredEnv('COCO_LLM_BASE_URL'),
      apiKey: process.env.COCO_LLM_API_KEY,
      model: requiredEnv('COCO_LLM_MODEL'),
    },
    chain: {
      id: Number(process.env.COCO_CHAIN_ID ?? '56'),
      rpcUrl: requiredEnv('COCO_RPC_URL'),
    },
    wallet: {
      mode: (process.env.COCO_WALLET_MODE ?? 'unsigned') as
        | 'unsigned'
        | 'delegated'
        | 'session-key'
        | 'custodial',
      privateKey: process.env.COCO_WALLET_PRIVATE_KEY_ENV,
      sessionKey: process.env.COCO_SESSION_KEY_SIGNER
        ? {
            signer: process.env.COCO_SESSION_KEY_SIGNER,
            validUntil: Number(process.env.COCO_SESSION_KEY_VALID_UNTIL ?? '0'),
            permissions: (
              process.env.COCO_SESSION_KEY_PERMISSIONS ?? 'swap,transfer'
            )
              .split(',')
              .filter(Boolean) as Array<'swap' | 'transfer'>,
          }
        : undefined,
      limits: {
        perTxUsd: Number(process.env.COCO_WALLET_LIMIT_PER_TX ?? '500'),
        dailyUsd: Number(process.env.COCO_WALLET_LIMIT_DAILY ?? '2000'),
        requireConfirmAbove: Number(
          process.env.COCO_WALLET_LIMIT_CONFIRM_ABOVE ?? '100',
        ),
      },
    },
  };
}

async function registerPlugins(runtime: ReturnType<typeof createRuntime>) {
  await runtime.registerPlugin(pricePlugin);
  await runtime.registerPlugin(scanPlugin);
  await runtime.registerPlugin(swapPlugin);
  await runtime.registerPlugin(walletPlugin);
}

function printEvent(event: ChatEvent) {
  if (event.type === 'text') {
    process.stdout.write(event.content);
    return;
  }

  process.stdout.write(`\n${safeJsonStringify(event)}\n`);
}

async function runChat() {
  const runtime = createRuntime(buildBaseConfig());
  await registerPlugins(runtime);

  const sessionId = randomUUID();
  const walletAddress = process.env.COCO_WALLET_ADDRESS;
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const message = await rl.question('coco> ');
      if (message.trim().toLowerCase() === 'exit') {
        break;
      }

      const ctx: CocoContext = {
        sessionId,
        walletAddress,
        chainId: runtime.config.chain.id,
        runtime,
        metadata: {},
      };

      for await (const event of runtime.chat(ctx, message)) {
        printEvent(event);
      }
      process.stdout.write('\n');
    }
  } finally {
    rl.close();
    await runtime.limitLedger.close?.();
  }
}

async function runServe() {
  const connector = await createWebConnector({
    ...buildBaseConfig(),
    host: process.env.COCO_HOST ?? '0.0.0.0',
    port: Number(process.env.COCO_PORT ?? '3000'),
  });
  await connector.start();
}

async function main() {
  const command = process.argv[2];
  if (command === 'serve') {
    await runServe();
    return;
  }

  if (command === 'chat') {
    await runChat();
    return;
  }

  process.stderr.write('Usage: coco <chat|serve>\n');
  process.exitCode = 1;
}

void main();
