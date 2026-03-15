import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CocoError,
  type CocoPlugin,
  type CocoTool,
  truncateText,
} from '@coco/core';
import { z } from 'zod';

export interface ShellConfig {
  allowedCommands?: string[] | undefined;
  blockedCommands?: string[] | undefined;
  workingDir?: string | undefined;
  timeout?: number | undefined;
  maxOutputSize?: number | undefined;
  sandboxDir?: string | undefined;
}

const DEFAULT_BLOCKED = ['sudo', 'rm', 'mkfs', 'chmod', 'chown'];

function sanitizeCommand(command: string, config: ShellConfig) {
  if (
    config.allowedCommands?.length &&
    !config.allowedCommands.includes(command)
  ) {
    throw new CocoError(
      'Command is not allowlisted.',
      'shell_command_not_allowed',
    );
  }

  if (
    [...DEFAULT_BLOCKED, ...(config.blockedCommands ?? [])].includes(command)
  ) {
    throw new CocoError('Command is blocked.', 'shell_command_blocked');
  }
}

function resolvePath(inputPath: string, config: ShellConfig): string {
  const base = config.sandboxDir ?? config.workingDir ?? process.cwd();
  const resolved = resolve(base, inputPath);
  if (!resolved.startsWith(resolve(base))) {
    throw new CocoError(
      'Path escapes the configured sandbox.',
      'shell_path_outside_sandbox',
    );
  }
  return resolved;
}

async function runCommand(
  command: string,
  args: string[],
  config: ShellConfig,
  cwd?: string,
  env?: Record<string, string>,
) {
  sanitizeCommand(command, config);
  const workdir = cwd
    ? resolvePath(cwd, config)
    : (config.workingDir ?? process.cwd());
  return await new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: workdir,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new CocoError('Command timed out.', 'shell_timeout'));
    }, config.timeout ?? 30_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const maxLength = config.maxOutputSize ?? 1024 * 1024;
      resolvePromise({
        code,
        stdout: truncateText(stdout, maxLength),
        stderr: truncateText(stderr, maxLength),
      });
    });
  });
}

export function createShellPlugin(config: ShellConfig = {}): CocoPlugin {
  const runSchema = z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
  });
  const readSchema = z.object({
    path: z.string(),
    encoding: z.string().optional(),
  });
  const writeSchema = z.object({
    path: z.string(),
    content: z.string(),
    append: z.boolean().optional(),
  });
  const listSchema = z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
    pattern: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'shell.run-command',
      triggers: ['shell', 'command', 'terminal'],
      description: 'Run a shell command in the configured sandbox.',
      schema: runSchema,
      async execute(_ctx, params: z.infer<typeof runSchema>) {
        const result = await runCommand(
          params.command,
          params.args ?? [],
          config,
          params.cwd,
          params.env,
        );
        return { success: true, data: result };
      },
    },
    {
      id: 'shell.read-file',
      triggers: ['read', 'file'],
      description: 'Read a file inside the configured sandbox.',
      schema: readSchema,
      async execute(_ctx, params: z.infer<typeof readSchema>) {
        const path = resolvePath(params.path, config);
        return {
          success: true,
          data: {
            path,
            content: await fs.readFile(
              path,
              (params.encoding ?? 'utf-8') as BufferEncoding,
            ),
          },
        };
      },
    },
    {
      id: 'shell.write-file',
      triggers: ['write', 'file'],
      description: 'Write a file inside the configured sandbox.',
      schema: writeSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof writeSchema>) {
        const path = resolvePath(params.path, config);
        await fs.mkdir(resolve(join(path, '..')), { recursive: true });
        if (params.append) {
          await fs.appendFile(path, params.content, 'utf-8');
        } else {
          await fs.writeFile(path, params.content, 'utf-8');
        }
        return { success: true, data: { path } };
      },
    },
    {
      id: 'shell.list-dir',
      triggers: ['list', 'dir', 'ls'],
      description: 'List directory contents inside the configured sandbox.',
      schema: listSchema,
      async execute(_ctx, params: z.infer<typeof listSchema>) {
        const path = resolvePath(params.path, config);
        const entries = await fs.readdir(path, {
          withFileTypes: true,
          recursive: params.recursive ?? false,
        });
        return {
          success: true,
          data: entries
            .filter((entry) =>
              params.pattern ? entry.name.includes(params.pattern) : true,
            )
            .map((entry) => ({
              name: entry.name,
              path: join(path, entry.name),
              type: entry.isDirectory() ? 'directory' : 'file',
            })),
        };
      },
    },
  ];

  return {
    id: 'shell',
    name: 'Coco Shell',
    version: '1.2.0',
    description: 'Shell command execution and filesystem access',
    async setup(runtime) {
      runtime.logger.info(
        { workingDir: config.workingDir ?? process.cwd() },
        'Shell plugin ready',
      );
    },
    tools,
  };
}

export const shellPlugin = createShellPlugin();

export default shellPlugin;
