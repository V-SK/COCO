import { randomUUID, randomBytes } from 'node:crypto';
import { type Server as HttpServer, createServer } from 'node:http';
import {
  type ChatEvent,
  type CocoContext,
  type CocoPlugin,
  type CocoRuntime,
  type CocoRuntimeConfig,
  type RuntimeDependencies,
  createRuntime,
  safeJsonStringify,
} from '@coco/core';
import { alertsPlugin } from '@coco/plugin-alerts';
import { autoTradePlugin } from '@coco/plugin-auto-trade';
import { createBrowserPlugin } from '@coco/plugin-browser';
import { chainEventsPlugin } from '@coco/plugin-chain-events';
import { copyTradePlugin } from '@coco/plugin-copy-trade';
import { cronPlugin } from '@coco/plugin-cron';
import { dexAggPlugin } from '@coco/plugin-dex-agg';
import { historyPlugin } from '@coco/plugin-history';
import { knowledgePlugin } from '@coco/plugin-knowledge';
import { memoryPlugin } from '@coco/plugin-memory';
import { newsPlugin } from '@coco/plugin-news';
import { nfaPlugin } from '@coco/plugin-nfa';
import { nftPlugin } from '@coco/plugin-nft';
import { orchestratorPlugin } from '@coco/plugin-orchestrator';
import { polymarketPlugin } from '@coco/plugin-polymarket';
import { pricePlugin } from '@coco/plugin-price';
import { quantSignalPlugin } from '@coco/plugin-quant-signal';
import { reportPlugin } from '@coco/plugin-report';
import { scanPlugin } from '@coco/plugin-scan';
import { sqlPlugin } from '@coco/plugin-sql';
import { swapPlugin } from '@coco/plugin-swap';
import { trustScorePlugin } from '@coco/plugin-trust-score';
import { ttsPlugin } from '@coco/plugin-tts';
import { visionPlugin } from '@coco/plugin-vision';
import { walletPlugin } from '@coco/plugin-wallet';
import { webhookPlugin } from '@coco/plugin-webhook';
import { whaleAlertPlugin } from '@coco/plugin-whale-alert';
import express, { type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { ChatStore } from './chat-store.js';
import { createCustodyTools } from './custody-tools.js';

// ── Security: removed dangerous plugins from web connector ──
// shellPlugin       — arbitrary command execution on host
// computerUsePlugin — desktop mouse/keyboard control
// twitterConnectorPlugin — should not be user-accessible
//
// Browser plugin is kept but sandboxed to safe domains only.
// These plugins remain available in CLI 'chat' mode for admin use.

export interface WebConnectorConfig extends CocoRuntimeConfig {
  host?: string;
  port?: number;
}

export interface WebConnector {
  app: express.Express;
  runtime: CocoRuntime;
  server: HttpServer;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  chat: (
    sessionId: string,
    walletAddress: string | undefined,
    message: string,
    onEvent: (event: ChatEvent) => void,
  ) => Promise<void>;
}

// ── Sandboxed browser: only crypto-related sites ──────────────
const safeBrowserPlugin = createBrowserPlugin({
  headless: true,
  allowedHosts: [
    'www.coingecko.com',
    'coinmarketcap.com',
    'bscscan.com',
    'etherscan.io',
    'dexscreener.com',
    'pancakeswap.finance',
    'app.uniswap.org',
    'debank.com',
    'defillama.com',
    'tradingview.com',
  ],
  timeout: 15_000,
});

async function registerDefaultPlugins(runtime: CocoRuntime) {
  // ── Safe plugins for public users ──
  await runtime.registerPlugin(nfaPlugin);
  await runtime.registerPlugin(pricePlugin);
  await runtime.registerPlugin(scanPlugin);
  await runtime.registerPlugin(swapPlugin);
  await runtime.registerPlugin(walletPlugin);
  await runtime.registerPlugin(newsPlugin);
  await runtime.registerPlugin(whaleAlertPlugin);
  await runtime.registerPlugin(chainEventsPlugin);
  await runtime.registerPlugin(quantSignalPlugin);
  await runtime.registerPlugin(trustScorePlugin);
  await runtime.registerPlugin(autoTradePlugin);
  await runtime.registerPlugin(copyTradePlugin);
  await runtime.registerPlugin(dexAggPlugin);
  await runtime.registerPlugin(alertsPlugin);
  await runtime.registerPlugin(reportPlugin);
  await runtime.registerPlugin(polymarketPlugin);
  await runtime.registerPlugin(safeBrowserPlugin);
  await runtime.registerPlugin(cronPlugin);
  await runtime.registerPlugin(memoryPlugin);
  await runtime.registerPlugin(visionPlugin);
  await runtime.registerPlugin(knowledgePlugin);
  await runtime.registerPlugin(ttsPlugin);
  await runtime.registerPlugin(sqlPlugin);
  await runtime.registerPlugin(orchestratorPlugin);
  await runtime.registerPlugin(webhookPlugin);
  await runtime.registerPlugin(historyPlugin);
  await runtime.registerPlugin(nftPlugin);

  // ── REMOVED from web connector (security) ──
  // shellPlugin       — users must NOT execute host commands
  // computerUsePlugin — users must NOT control the desktop
  // twitterConnectorPlugin — not user-facing
}

function buildContext(
  runtime: CocoRuntime,
  sessionId: string,
  chainId: number,
  walletAddress?: string,
): CocoContext {
  return {
    sessionId,
    walletAddress,
    chainId,
    runtime,
    metadata: {},
  };
}

export async function createWebConnector(
  config: WebConnectorConfig,
  plugins?: CocoPlugin[],
  dependencies?: RuntimeDependencies,
): Promise<WebConnector> {
  const runtime = createRuntime(config, dependencies);
  if (plugins && plugins.length > 0) {
    for (const plugin of plugins) {
      await runtime.registerPlugin(plugin);
    }
  } else {
    await registerDefaultPlugins(runtime);
  }

  // ── Chat persistence store ──────────────────────────────────
  const chatDbPath = process.env['COCO_CHAT_DB_PATH'] ?? './data/coco-chat.sqlite';
  let custodySecret = process.env['COCO_CUSTODY_SECRET'] ?? '';
  if (!custodySecret || custodySecret.length < 64) {
    custodySecret = randomBytes(32).toString('hex');
    runtime.logger.warn('COCO_CUSTODY_SECRET not set or too short — generated ephemeral key (wallets will be unrecoverable after restart!)');
  }
  const chatStore = new ChatStore(chatDbPath, custodySecret);
  runtime.logger.info({ chatDbPath }, 'Chat store initialized');

  // ── Register custody tools ──────────────────────────────────
  const custodyTools = createCustodyTools(chatStore);
  for (const tool of custodyTools) {
    runtime.tools.set(tool.id, tool);
  }
  runtime.logger.info('Custody wallet tools registered');

  // ── Security: remove browser.execute-js even from sandboxed browser ──
  runtime.tools.delete('browser.execute-js');
  runtime.logger.info('Removed browser.execute-js from public tools');

  const app = express();
  app.use(express.json());

  // CORS – allow web frontends
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      chainId: runtime.config.chain.id,
      walletMode: runtime.config.wallet.mode,
      plugins: Array.from(runtime.plugins.keys()),
    });
  });

  app.get('/tools', (_req: Request, res: Response) => {
    res.json({
      tools: runtime.getToolDefinitions(),
    });
  });

  app.post('/sessions', (req: Request, res: Response) => {
    const provided = req.body?.sessionId;
    const sessionId =
      typeof provided === 'string' && provided.length > 0
        ? provided
        : randomUUID();
    res.json({ sessionId });
  });

  // ── Chat history endpoint ──────────────────────────────────
  app.get('/sessions/:id/messages', (req: Request, res: Response) => {
    const sessionId = req.params['id'] as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing session id' });
      return;
    }
    const limit = Math.min(Number(req.query['limit']) || 50, 200);
    const before = req.query['before'] ? Number(req.query['before']) : undefined;
    const rows = chatStore.getMessages(sessionId, limit, before);
    // Return in chronological order (DB returns DESC)
    res.json({ messages: rows.reverse() });
  });

  const server = createServer(app);
  const wsServer = new WebSocketServer({
    server,
    path: '/ws',
  });

  wsServer.on('connection', (socket) => {
    socket.on('message', async (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage.toString()) as {
          type?: string;
          sessionId?: string;
          walletAddress?: string;
          message?: string;
          msgId?: string;
        };

        if (payload.type !== 'chat' || !payload.sessionId || !payload.message) {
          socket.send(
            safeJsonStringify({
              type: 'error',
              error: 'Invalid websocket payload.',
              code: 'invalid_ws_payload',
            }),
          );
          return;
        }

        const userMsgId = payload.msgId ?? randomUUID();
        const now = Date.now();

        // Persist user message
        chatStore.saveMessage({
          id: userMsgId,
          sessionId: payload.sessionId,
          role: 'user',
          content: payload.message,
          createdAt: now,
        });

        const ctx = buildContext(
          runtime,
          payload.sessionId,
          runtime.config.chain.id,
          payload.walletAddress,
        );

        let assistantText = '';
        for await (const event of runtime.chat(ctx, payload.message)) {
          socket.send(safeJsonStringify(event));
          if (event.type === 'text') {
            assistantText += event.content;
          }
        }

        // Persist assistant reply
        if (assistantText) {
          chatStore.saveMessage({
            id: randomUUID(),
            sessionId: payload.sessionId,
            role: 'assistant',
            content: assistantText,
            createdAt: Date.now(),
          });
        }
      } catch (error) {
        socket.send(
          safeJsonStringify({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Unknown websocket error',
            code: 'ws_chat_failed',
          }),
        );
      }
    });
  });

  return {
    app,
    runtime,
    server,
    async start() {
      const host = config.host ?? '0.0.0.0';
      const port = config.port ?? 3000;
      await new Promise<void>((resolve) => {
        server.listen(port, host, () => {
          runtime.logger.info({ host, port }, 'Connector listening');
          resolve();
        });
      });
    },
    async stop() {
      wsServer.close();
      chatStore.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      await runtime.limitLedger.close?.();
    },
    async chat(sessionId, walletAddress, message, onEvent) {
      const ctx = buildContext(
        runtime,
        sessionId,
        runtime.config.chain.id,
        walletAddress,
      );
      for await (const event of runtime.chat(ctx, message)) {
        onEvent(event);
      }
    },
  };
}
