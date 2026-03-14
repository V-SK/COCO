import { randomUUID } from 'node:crypto';
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
import { pricePlugin } from '@coco/plugin-price';
import { scanPlugin } from '@coco/plugin-scan';
import { swapPlugin } from '@coco/plugin-swap';
import { walletPlugin } from '@coco/plugin-wallet';
import express, { type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';

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

async function registerDefaultPlugins(runtime: CocoRuntime) {
  await runtime.registerPlugin(pricePlugin);
  await runtime.registerPlugin(scanPlugin);
  await runtime.registerPlugin(swapPlugin);
  await runtime.registerPlugin(walletPlugin);
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

  const app = express();
  app.use(express.json());

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

        const ctx = buildContext(
          runtime,
          payload.sessionId,
          runtime.config.chain.id,
          payload.walletAddress,
        );

        for await (const event of runtime.chat(ctx, payload.message)) {
          socket.send(safeJsonStringify(event));
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
