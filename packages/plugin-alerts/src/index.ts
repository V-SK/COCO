import { randomUUID } from 'node:crypto';
import type { CocoPlugin, CocoRuntime, CocoTool } from '@coco/core';
import Database from 'better-sqlite3';
import { z } from 'zod';

export interface NotifyChannel {
  type: 'telegram' | 'discord' | 'email' | 'slack' | 'webhook';
  config: {
    chatId?: string | undefined;
    channelId?: string | undefined;
    email?: string | undefined;
    webhookUrl?: string | undefined;
    slackWebhook?: string | undefined;
  };
}

export interface Alert {
  id: string;
  name: string;
  type: 'price' | 'balance' | 'event' | 'custom';
  condition: {
    symbol?: string | undefined;
    address?: string | undefined;
    operator: '>' | '<' | '>=' | '<=' | '==' | 'change%';
    value: string | number;
  };
  action: {
    notify: NotifyChannel[];
    execute?: { toolId: string; params: unknown } | undefined;
  };
  enabled: boolean;
  triggered: boolean;
  lastTriggeredAt?: Date | undefined;
  cooldown?: number | undefined;
}

class AlertStore {
  readonly #db: Database.Database;

  constructor(path: string) {
    this.#db = new Database(path);
    this.#db.exec(`
      create table if not exists alerts (
        id text primary key,
        payload text not null
      );
    `);
  }

  list(): Alert[] {
    return this.#db
      .prepare('select payload from alerts')
      .all()
      .map((row) => JSON.parse((row as { payload: string }).payload) as Alert);
  }

  save(alert: Alert) {
    this.#db
      .prepare('insert or replace into alerts (id, payload) values (?, ?)')
      .run(alert.id, JSON.stringify(alert));
  }

  delete(id: string) {
    this.#db.prepare('delete from alerts where id = ?').run(id);
  }
}

class AlertsService {
  readonly #runtime: CocoRuntime;
  readonly #store: AlertStore;

  constructor(runtime: CocoRuntime, storagePath: string) {
    this.#runtime = runtime;
    this.#store = new AlertStore(storagePath);
  }

  create(alert: Omit<Alert, 'id' | 'enabled' | 'triggered'>) {
    const record: Alert = {
      ...alert,
      id: randomUUID(),
      enabled: true,
      triggered: false,
    };
    this.#store.save(record);
    return record;
  }

  list() {
    return this.#store.list();
  }

  delete(id: string) {
    this.#store.delete(id);
  }

  async notify(alert: Alert, payload: Record<string, unknown>) {
    for (const channel of alert.action.notify) {
      if (channel.type === 'webhook' && channel.config.webhookUrl) {
        await fetch(channel.config.webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: alert.name,
            content: JSON.stringify(payload),
          }),
        });
      }
    }

    if (alert.action.execute) {
      await this.#runtime.invokeTool(
        alert.action.execute.toolId,
        {
          sessionId: `alert:${alert.id}`,
          chainId: this.#runtime.config.chain.id,
          runtime: this.#runtime,
          metadata: { alertId: alert.id, alertPayload: payload },
        },
        alert.action.execute.params,
      );
    }
  }
}

let alertsService: AlertsService | undefined;

export function createAlertsPlugin(
  storagePath = 'coco-alerts.sqlite',
): CocoPlugin {
  const notifySchema = z.object({
    type: z.enum(['telegram', 'discord', 'email', 'slack', 'webhook']),
    config: z.object({
      chatId: z.string().optional(),
      channelId: z.string().optional(),
      email: z.string().optional(),
      webhookUrl: z.string().optional(),
      slackWebhook: z.string().optional(),
    }),
  });
  const createSchema = z.object({
    name: z.string(),
    type: z.enum(['price', 'balance', 'event', 'custom']),
    condition: z.object({
      symbol: z.string().optional(),
      address: z.string().optional(),
      operator: z.enum(['>', '<', '>=', '<=', '==', 'change%']),
      value: z.union([z.string(), z.number()]),
    }),
    notify: z.array(notifySchema),
    execute: z
      .object({
        toolId: z.string(),
        params: z.unknown(),
      })
      .optional(),
    cooldown: z.number().optional(),
  });
  const listSchema = z.object({
    type: z.enum(['price', 'balance', 'event', 'custom']).optional(),
    enabled: z.boolean().optional(),
  });
  const deleteSchema = z.object({
    alertId: z.string(),
  });
  const testSchema = z.object({
    alertId: z.string(),
    payload: z.record(z.unknown()).optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'alerts.create-alert',
      triggers: ['alert', 'create'],
      description: 'Create a stored alert rule.',
      schema: createSchema,
      async execute(_ctx, params: z.infer<typeof createSchema>) {
        return {
          success: true,
          data: alertsService?.create({
            name: params.name,
            type: params.type,
            condition: params.condition,
            action: {
              notify: params.notify,
              execute: params.execute
                ? {
                    toolId: params.execute.toolId,
                    params: params.execute.params,
                  }
                : undefined,
            },
            cooldown: params.cooldown,
          }),
        };
      },
    },
    {
      id: 'alerts.list-alerts',
      triggers: ['alert', 'list'],
      description: 'List stored alerts.',
      schema: listSchema,
      async execute(_ctx, params: z.infer<typeof listSchema>) {
        const alerts = alertsService?.list() ?? [];
        return {
          success: true,
          data: alerts.filter(
            (alert) =>
              (params.type ? alert.type === params.type : true) &&
              (params.enabled != null
                ? alert.enabled === params.enabled
                : true),
          ),
        };
      },
    },
    {
      id: 'alerts.delete-alert',
      triggers: ['alert', 'delete'],
      description: 'Delete an alert.',
      schema: deleteSchema,
      async execute(_ctx, params: z.infer<typeof deleteSchema>) {
        alertsService?.delete(params.alertId);
        return { success: true, data: { alertId: params.alertId } };
      },
    },
    {
      id: 'alerts.test-notify',
      triggers: ['alert', 'notify', 'test'],
      description: 'Trigger a test notification for an alert.',
      schema: testSchema,
      async execute(_ctx, params: z.infer<typeof testSchema>) {
        const alert = alertsService
          ?.list()
          .find((entry) => entry.id === params.alertId);
        if (!alert) {
          return {
            success: false,
            error: 'Alert not found.',
            code: 'alert_not_found',
          };
        }
        await alertsService?.notify(alert, params.payload ?? { ok: true });
        return { success: true, data: { alertId: params.alertId } };
      },
    },
  ];

  return {
    id: 'alerts',
    name: 'Coco Alerts',
    version: '1.2.0',
    description: 'Persistent alerts and notification dispatch',
    async setup(runtime) {
      alertsService = new AlertsService(runtime, storagePath);
    },
    async teardown() {
      alertsService = undefined;
    },
    tools,
  };
}

export const alertsPlugin = createAlertsPlugin();

export default alertsPlugin;
