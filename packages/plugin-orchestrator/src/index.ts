import { randomUUID } from 'node:crypto';
import type { CocoPlugin, CocoRuntime, CocoTool } from '@coco/core';
import { z } from 'zod';

export interface OrchestratorConfig {
  maxAgents?: number | undefined;
  timeout?: number | undefined;
  pattern?: 'supervisor' | 'pipeline' | 'swarm' | undefined;
}

export interface AgentSpec {
  id: string;
  name: string;
  systemPrompt: string;
  tools: string[];
  constraints?: {
    maxTokens?: number | undefined;
    maxToolCalls?: number | undefined;
  };
}

class OrchestratorService {
  readonly #runtime: CocoRuntime;
  readonly #agents = new Map<string, AgentSpec>();

  constructor(runtime: CocoRuntime) {
    this.#runtime = runtime;
  }

  spawn(spec: AgentSpec) {
    this.#agents.set(spec.id, spec);
    return spec;
  }

  async delegate(agentId: string, task: string, context?: unknown) {
    const agent = this.#agents.get(agentId);
    if (!agent) {
      throw new Error(`Unknown agent ${agentId}`);
    }
    const events = [];
    const ctx = {
      sessionId: `agent:${agentId}:${randomUUID()}`,
      chainId: this.#runtime.config.chain.id,
      runtime: this.#runtime,
      metadata: {
        agentId,
        delegatedContext: context ?? null,
        systemPrompt: agent.systemPrompt,
      },
    };
    for await (const event of this.#runtime.chat(ctx, task)) {
      events.push(event);
    }
    return events;
  }

  broadcast(message: string, targetAgents?: string[]) {
    const ids = targetAgents?.length
      ? targetAgents
      : Array.from(this.#agents.keys());
    return ids.map((id) => ({ agentId: id, message }));
  }
}

let orchestrator: OrchestratorService | undefined;

export function createOrchestratorPlugin(
  _config: OrchestratorConfig = {},
): CocoPlugin {
  const spawnSchema = z.object({
    spec: z.object({
      id: z.string(),
      name: z.string(),
      systemPrompt: z.string(),
      tools: z.array(z.string()),
      constraints: z
        .object({
          maxTokens: z.number().optional(),
          maxToolCalls: z.number().optional(),
        })
        .optional(),
    }),
  });
  const delegateSchema = z.object({
    agentId: z.string(),
    task: z.string(),
    context: z.unknown().optional(),
    waitForResult: z.boolean().optional(),
  });
  const broadcastSchema = z.object({
    message: z.string(),
    targetAgents: z.array(z.string()).optional(),
  });
  const aggregateSchema = z.object({
    taskIds: z.array(z.string()),
    strategy: z.enum(['wait_all', 'first_success', 'majority']),
  });

  const tools: CocoTool[] = [
    {
      id: 'orchestrator.spawn-agent',
      triggers: ['spawn', 'agent'],
      description: 'Create a child agent specification.',
      schema: spawnSchema,
      async execute(_ctx, params: z.infer<typeof spawnSchema>) {
        const spec: AgentSpec = {
          id: params.spec.id,
          name: params.spec.name,
          systemPrompt: params.spec.systemPrompt,
          tools: params.spec.tools,
        };
        if (params.spec.constraints) {
          spec.constraints = params.spec.constraints;
        }
        return { success: true, data: orchestrator?.spawn(spec) };
      },
    },
    {
      id: 'orchestrator.delegate-task',
      triggers: ['delegate', 'agent'],
      description: 'Delegate a task to a child agent.',
      schema: delegateSchema,
      async execute(_ctx, params: z.infer<typeof delegateSchema>) {
        return {
          success: true,
          data: await orchestrator?.delegate(
            params.agentId,
            params.task,
            params.context,
          ),
        };
      },
    },
    {
      id: 'orchestrator.broadcast',
      triggers: ['broadcast', 'agents'],
      description: 'Broadcast a message to child agents.',
      schema: broadcastSchema,
      async execute(_ctx, params: z.infer<typeof broadcastSchema>) {
        return {
          success: true,
          data: orchestrator?.broadcast(params.message, params.targetAgents),
        };
      },
    },
    {
      id: 'orchestrator.aggregate',
      triggers: ['aggregate', 'agents'],
      description: 'Aggregate task results metadata.',
      schema: aggregateSchema,
      async execute(_ctx, params: z.infer<typeof aggregateSchema>) {
        return {
          success: true,
          data: {
            strategy: params.strategy,
            taskIds: params.taskIds,
            completed: params.taskIds.length,
          },
        };
      },
    },
  ];

  return {
    id: 'orchestrator',
    name: 'Coco Orchestrator',
    version: '1.2.0',
    description: 'Supervisor and pipeline style multi-agent orchestration',
    async setup(runtime) {
      orchestrator = new OrchestratorService(runtime);
    },
    async teardown() {
      orchestrator = undefined;
    },
    tools,
  };
}

export const orchestratorPlugin = createOrchestratorPlugin();

export default orchestratorPlugin;
