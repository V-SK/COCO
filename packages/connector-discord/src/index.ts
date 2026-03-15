import type { ChatEvent, CocoRuntime } from '@coco/core';

export interface DiscordConnectorConfig {
  botToken: string;
  allowedChannels?: string[] | undefined;
  adminUsers?: string[] | undefined;
}

export interface DiscordConnector {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  sendMessage: (channelId: string, text: string) => Promise<void>;
  dispatchMessage: (
    channelId: string,
    userId: string,
    sessionId: string,
    message: string,
    walletAddress?: string | undefined,
  ) => Promise<ChatEvent[]>;
}

export async function createDiscordConnector(
  runtime: CocoRuntime,
  config: DiscordConnectorConfig,
): Promise<DiscordConnector> {
  return {
    async start() {
      runtime.logger.info('Discord connector ready');
    },
    async stop() {
      runtime.logger.info('Discord connector stopped');
    },
    async sendMessage(_channelId, text) {
      runtime.logger.info({ text }, 'Discord sendMessage invoked');
    },
    async dispatchMessage(
      channelId,
      userId,
      sessionId,
      message,
      walletAddress,
    ) {
      if (
        config.allowedChannels?.length &&
        !config.allowedChannels.includes(channelId)
      ) {
        return [
          {
            type: 'error',
            error: 'Channel is not allowlisted.',
            code: 'discord_channel_blocked',
          },
        ];
      }

      const ctx = {
        sessionId,
        userId,
        walletAddress,
        chainId: runtime.config.chain.id,
        runtime,
        metadata: {
          channel: 'discord',
          channelId,
          isAdmin: config.adminUsers?.includes(userId) ?? false,
        },
      };

      const events: ChatEvent[] = [];
      for await (const event of runtime.chat(ctx, message)) {
        events.push(event);
      }

      return events;
    },
  };
}
