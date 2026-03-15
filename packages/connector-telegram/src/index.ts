import type { ChatEvent, CocoRuntime } from '@coco/core';

export interface TelegramConnectorConfig {
  botToken: string;
  webhookUrl?: string | undefined;
  allowedUsers?: string[] | undefined;
  adminUsers?: string[] | undefined;
}

export interface SendOptions {
  parseMode?: 'Markdown' | 'HTML' | undefined;
  disableNotification?: boolean | undefined;
}

export interface TelegramConnector {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  sendMessage: (
    chatId: string,
    text: string,
    options?: SendOptions | undefined,
  ) => Promise<void>;
  dispatchMessage: (
    chatId: string,
    sessionId: string,
    message: string,
    walletAddress?: string | undefined,
  ) => Promise<ChatEvent[]>;
}

export async function createTelegramConnector(
  runtime: CocoRuntime,
  config: TelegramConnectorConfig,
): Promise<TelegramConnector> {
  const endpoint = `https://api.telegram.org/bot${config.botToken}`;

  return {
    async start() {
      runtime.logger.info(
        { webhook: config.webhookUrl ?? null },
        'Telegram connector ready',
      );
    },
    async stop() {
      runtime.logger.info('Telegram connector stopped');
    },
    async sendMessage(chatId, text, options) {
      await fetch(`${endpoint}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode,
          disable_notification: options?.disableNotification,
        }),
      });
    },
    async dispatchMessage(chatId, sessionId, message, walletAddress) {
      if (
        config.allowedUsers?.length &&
        !config.allowedUsers.includes(chatId)
      ) {
        return [
          {
            type: 'error',
            error: 'User is not allowlisted.',
            code: 'telegram_user_blocked',
          },
        ];
      }

      const events: ChatEvent[] = [];
      const ctx = {
        sessionId,
        walletAddress,
        chainId: runtime.config.chain.id,
        runtime,
        metadata: {
          channel: 'telegram',
          chatId,
          isAdmin: config.adminUsers?.includes(chatId) ?? false,
        },
      };

      for await (const event of runtime.chat(ctx, message)) {
        events.push(event);
      }

      return events;
    },
  };
}
