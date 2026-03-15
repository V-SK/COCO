import { randomUUID } from 'node:crypto';
import type { CocoPlugin, CocoRuntime, CocoTool } from '@coco/core';
import { optionalImport } from '@coco/core';
import Database from 'better-sqlite3';
import { z } from 'zod';

export interface CronConfig {
  storage?: 'memory' | 'sqlite' | 'file' | undefined;
  storagePath?: string | undefined;
  timezone?: string | undefined;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  action:
    | { type: 'tool_call'; toolId: string; params: unknown }
    | { type: 'message'; content: string };
  enabled: boolean;
  lastRun?: Date | undefined;
  nextRun?: Date | undefined;
  createdAt: Date;
}

class TaskStore {
  readonly #memory = new Map<string, ScheduledTask>();
  readonly #db?: Database.Database;

  constructor(config: CronConfig) {
    if ((config.storage ?? 'sqlite') === 'sqlite') {
      this.#db = new Database(config.storagePath ?? 'coco-cron.sqlite');
      this.#db.exec(`
        create table if not exists cron_tasks (
          id text primary key,
          payload text not null
        );
      `);
    }
  }

  list(): ScheduledTask[] {
    if (this.#db) {
      return this.#db
        .prepare('select payload from cron_tasks')
        .all()
        .map(
          (row) =>
            JSON.parse((row as { payload: string }).payload) as ScheduledTask,
        );
    }
    return Array.from(this.#memory.values());
  }

  save(task: ScheduledTask): void {
    if (this.#db) {
      this.#db
        .prepare(
          'insert or replace into cron_tasks (id, payload) values (?, ?)',
        )
        .run(task.id, JSON.stringify(task));
      return;
    }
    this.#memory.set(task.id, task);
  }

  delete(taskId: string): void {
    if (this.#db) {
      this.#db.prepare('delete from cron_tasks where id = ?').run(taskId);
      return;
    }
    this.#memory.delete(taskId);
  }
}

class CronScheduler {
  readonly #store: TaskStore;
  readonly #runtime: CocoRuntime;
  readonly #jobs = new Map<
    string,
    { stop?: () => void; destroy?: () => void }
  >();
  readonly #config: CronConfig;

  constructor(runtime: CocoRuntime, config: CronConfig) {
    this.#runtime = runtime;
    this.#store = new TaskStore(config);
    this.#config = config;
  }

  list(): ScheduledTask[] {
    return this.#store.list();
  }

  async schedule(task: ScheduledTask): Promise<void> {
    this.#store.save(task);
    const cronModule = await optionalImport<{
      schedule: (
        expression: string,
        callback: () => void | Promise<void>,
        options?: Record<string, unknown>,
      ) => { stop: () => void; destroy: () => void };
    }>('node-cron');

    if (!cronModule) {
      return;
    }

    const job = cronModule.schedule(
      task.cronExpression,
      async () => {
        await this.run(task.id);
      },
      { timezone: this.#config.timezone ?? 'UTC' },
    );

    this.#jobs.set(task.id, job);
  }

  async run(taskId: string): Promise<void> {
    const task = this.list().find((entry) => entry.id === taskId);
    if (!task || !task.enabled) {
      return;
    }

    if (task.action.type === 'message') {
      const ctx = {
        sessionId: `cron:${task.id}`,
        chainId: this.#runtime.config.chain.id,
        runtime: this.#runtime,
        metadata: {
          source: 'cron',
          taskId: task.id,
        },
      };
      for await (const _event of this.#runtime.chat(ctx, task.action.content)) {
      }
    } else {
      await this.#runtime.invokeTool(
        task.action.toolId,
        {
          sessionId: `cron:${task.id}`,
          chainId: this.#runtime.config.chain.id,
          runtime: this.#runtime,
          metadata: {
            source: 'cron',
            taskId: task.id,
          },
        },
        task.action.params,
      );
    }

    task.lastRun = new Date();
    this.#store.save(task);
  }

  cancel(taskId: string): void {
    const job = this.#jobs.get(taskId);
    job?.stop?.();
    job?.destroy?.();
    this.#jobs.delete(taskId);
    this.#store.delete(taskId);
  }

  async restore(): Promise<void> {
    for (const task of this.list().filter((item) => item.enabled)) {
      await this.schedule(task);
    }
  }
}

let scheduler: CronScheduler | undefined;

export function createCronPlugin(config: CronConfig = {}): CocoPlugin {
  const scheduleSchema = z.object({
    name: z.string(),
    cron: z.string(),
    action: z.union([
      z.object({
        type: z.literal('tool_call'),
        toolId: z.string(),
        params: z.unknown(),
      }),
      z.object({
        type: z.literal('message'),
        content: z.string(),
      }),
    ]),
  });
  const listSchema = z.object({
    filter: z.enum(['all', 'enabled', 'disabled']).optional(),
  });
  const idSchema = z.object({
    taskId: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'cron.schedule-task',
      triggers: ['cron', 'schedule'],
      description: 'Schedule a recurring task.',
      schema: scheduleSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof scheduleSchema>) {
        const task: ScheduledTask = {
          id: randomUUID(),
          name: params.name,
          cronExpression: params.cron,
          action:
            params.action.type === 'tool_call'
              ? {
                  type: 'tool_call',
                  toolId: params.action.toolId,
                  params: params.action.params,
                }
              : {
                  type: 'message',
                  content: params.action.content,
                },
          enabled: true,
          createdAt: new Date(),
        };
        await scheduler?.schedule(task);
        return { success: true, data: task };
      },
    },
    {
      id: 'cron.list-tasks',
      triggers: ['cron', 'tasks'],
      description: 'List scheduled tasks.',
      schema: listSchema,
      async execute(_ctx, params: z.infer<typeof listSchema>) {
        const tasks = scheduler?.list() ?? [];
        return {
          success: true,
          data: tasks.filter((task) =>
            params.filter === 'enabled'
              ? task.enabled
              : params.filter === 'disabled'
                ? !task.enabled
                : true,
          ),
        };
      },
    },
    {
      id: 'cron.cancel-task',
      triggers: ['cron', 'cancel'],
      description: 'Cancel a scheduled task.',
      schema: idSchema,
      async execute(_ctx, params: z.infer<typeof idSchema>) {
        scheduler?.cancel(params.taskId);
        return { success: true, data: { taskId: params.taskId } };
      },
    },
    {
      id: 'cron.run-task',
      triggers: ['cron', 'run'],
      description: 'Run a scheduled task immediately.',
      schema: idSchema,
      async execute(_ctx, params: z.infer<typeof idSchema>) {
        await scheduler?.run(params.taskId);
        return {
          success: true,
          data: { taskId: params.taskId, status: 'ran' },
        };
      },
    },
  ];

  return {
    id: 'cron',
    name: 'Coco Cron',
    version: '1.2.0',
    description: 'Task scheduling and heartbeat execution',
    async setup(runtime) {
      scheduler = new CronScheduler(runtime, config);
      await scheduler.restore();
    },
    async teardown() {
      scheduler = undefined;
    },
    tools,
  };
}

export const cronPlugin = createCronPlugin();

export default cronPlugin;
