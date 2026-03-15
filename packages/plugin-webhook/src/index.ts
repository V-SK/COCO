import { randomUUID } from 'node:crypto';
import type { CocoPlugin, CocoTool } from '@coco/core';
import { z } from 'zod';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  type: 'generic' | 'slack' | 'discord' | 'feishu' | 'dingtalk';
  headers?: Record<string, string> | undefined;
  secret?: string | undefined;
}

export interface WebhookConfig {
  timeout?: number | undefined;
  retries?: number | undefined;
  endpoints?: WebhookEndpoint[] | undefined;
}

function formatPayload(
  type: WebhookEndpoint['type'],
  payload: { title?: string; content: string; data?: unknown },
) {
  if (type === 'slack') {
    return {
      text: payload.title ?? payload.content,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: payload.content } },
      ],
    };
  }
  if (type === 'discord') {
    return {
      content: payload.content,
      embeds: payload.title
        ? [{ title: payload.title, description: payload.content }]
        : [],
    };
  }
  if (type === 'feishu') {
    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: payload.title ?? 'Coco Notification',
          },
        },
        elements: [{ tag: 'markdown', content: payload.content }],
      },
    };
  }
  if (type === 'dingtalk') {
    return {
      msgtype: 'markdown',
      markdown: {
        title: payload.title ?? 'Coco Notification',
        text: payload.content,
      },
    };
  }
  return payload;
}

let endpoints = new Map<string, WebhookEndpoint>();

export function createWebhookPlugin(config: WebhookConfig = {}): CocoPlugin {
  const sendSchema = z.object({
    endpointId: z.string().optional(),
    url: z.string().optional(),
    type: z
      .enum(['generic', 'slack', 'discord', 'feishu', 'dingtalk'])
      .optional(),
    payload: z.object({
      title: z.string().optional(),
      content: z.string(),
      data: z.unknown().optional(),
    }),
  });
  const registerSchema = z.object({
    name: z.string(),
    url: z.string(),
    type: z.enum(['generic', 'slack', 'discord', 'feishu', 'dingtalk']),
    headers: z.record(z.string()).optional(),
  });
  const listSchema = z.object({});

  const tools: CocoTool[] = [
    {
      id: 'webhook.send-webhook',
      triggers: ['webhook', 'send'],
      description: 'Send a webhook payload.',
      schema: sendSchema,
      async execute(_ctx, params: z.infer<typeof sendSchema>) {
        const endpoint =
          (params.endpointId ? endpoints.get(params.endpointId) : undefined) ??
          (params.url
            ? {
                id: randomUUID(),
                name: 'ephemeral',
                url: params.url,
                type: params.type ?? 'generic',
              }
            : undefined);
        if (!endpoint) {
          return {
            success: false,
            error: 'Webhook endpoint is required.',
            code: 'webhook_endpoint_missing',
          };
        }

        const payloadInput: {
          title?: string;
          content: string;
          data?: unknown;
        } = {
          content: params.payload.content,
        };
        if (params.payload.title) {
          payloadInput.title = params.payload.title;
        }
        if (params.payload.data !== undefined) {
          payloadInput.data = params.payload.data;
        }

        const payload = formatPayload(endpoint.type, payloadInput);
        const retries = config.retries ?? 3;
        let lastError: string | undefined;
        for (let attempt = 0; attempt < retries; attempt += 1) {
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...endpoint.headers,
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            return {
              success: true,
              data: { endpointId: endpoint.id, status: response.status },
            };
          }
          lastError = `Webhook failed with status ${response.status}.`;
        }
        return {
          success: false,
          error: lastError ?? 'Webhook failed.',
          code: 'webhook_send_failed',
        };
      },
    },
    {
      id: 'webhook.register-endpoint',
      triggers: ['webhook', 'register'],
      description: 'Register a named webhook endpoint.',
      schema: registerSchema,
      async execute(_ctx, params: z.infer<typeof registerSchema>) {
        const endpoint: WebhookEndpoint = {
          id: randomUUID(),
          name: params.name,
          url: params.url,
          type: params.type,
          headers: params.headers,
        };
        endpoints.set(endpoint.id, endpoint);
        return { success: true, data: endpoint };
      },
    },
    {
      id: 'webhook.list-endpoints',
      triggers: ['webhook', 'list'],
      description: 'List registered webhook endpoints.',
      schema: listSchema,
      async execute() {
        return { success: true, data: Array.from(endpoints.values()) };
      },
    },
  ];

  return {
    id: 'webhook',
    name: 'Coco Webhook',
    version: '1.2.0',
    description: 'Webhook sending and endpoint registration',
    async setup() {
      endpoints = new Map(
        (config.endpoints ?? []).map((endpoint) => [endpoint.id, endpoint]),
      );
    },
    tools,
  };
}

export const webhookPlugin = createWebhookPlugin();

export default webhookPlugin;
