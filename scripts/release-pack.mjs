import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = process.cwd();
const outDir = resolve(root, '.release-artifacts');
const packageDirs = [
  'packages/core',
  'packages/plugin-price',
  'packages/plugin-scan',
  'packages/plugin-swap',
  'packages/plugin-wallet',
  'packages/connector-web',
  'apps/cli',
];

await mkdir(outDir, { recursive: true });

for (const dir of packageDirs) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('pnpm', ['pack', '--pack-destination', outDir], {
      cwd: join(root, dir),
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`Failed to pack ${dir} (exit code ${code ?? 1}).`),
      );
    });
    child.on('error', rejectPromise);
  });
}
