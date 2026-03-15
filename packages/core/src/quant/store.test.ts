import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteStructuredStore } from './store.js';

const tempPaths: string[] = [];

describe('SqliteStructuredStore', () => {
  afterEach(async () => {
    await Promise.all(
      tempPaths.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      }),
    );
  });

  it('persists and lists structured records by namespace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'coco-structured-'));
    tempPaths.push(directory);
    const store = new SqliteStructuredStore(join(directory, 'phase3.sqlite'));

    store.save('signals', 'bnb', { token: 'BNB', confidence: 82 });
    store.save('signals', 'cake', { token: 'CAKE', confidence: 61 });
    store.save('alerts', '1', { token: 'BNB', threshold: 800 });

    expect(
      store.get<{ token: string; confidence: number }>('signals', 'bnb'),
    ).toEqual({
      token: 'BNB',
      confidence: 82,
    });
    expect(
      store.list<{ token: string; confidence: number }>('signals'),
    ).toHaveLength(2);
    expect(store.list('alerts')).toHaveLength(1);

    store.delete('signals', 'cake');
    expect(store.list('signals')).toHaveLength(1);

    store.close();
  });
});
