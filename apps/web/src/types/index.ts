export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string | undefined;
  text?: string | undefined;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolId?: string | undefined;
  toolParams?: unknown;
  toolResult?: ToolResult | undefined;
}

export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolId: string; params: unknown }
  | { type: 'tool_result'; toolId: string; result: ToolResult }
  | { type: 'error'; error: string; code?: string | undefined }
  | { type: 'done' };

export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
