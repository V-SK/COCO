import Database from 'better-sqlite3';

export class SqliteStructuredStore {
  readonly #db: Database.Database;

  constructor(path = 'coco-phase3.sqlite') {
    this.#db = new Database(path);
    this.#db.exec(`
      create table if not exists structured_records (
        namespace text not null,
        id text not null,
        payload text not null,
        updated_at integer not null,
        primary key (namespace, id)
      );
    `);
  }

  get<T>(namespace: string, id: string): T | undefined {
    const row = this.#db
      .prepare(
        'select payload from structured_records where namespace = ? and id = ?',
      )
      .get(namespace, id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as T) : undefined;
  }

  list<T>(namespace: string): T[] {
    return this.#db
      .prepare(
        'select payload from structured_records where namespace = ? order by updated_at desc',
      )
      .all(namespace)
      .map((row) => JSON.parse((row as { payload: string }).payload) as T);
  }

  save<T>(namespace: string, id: string, payload: T): T {
    this.#db
      .prepare(
        `
          insert into structured_records (namespace, id, payload, updated_at)
          values (?, ?, ?, ?)
          on conflict(namespace, id)
          do update set payload = excluded.payload, updated_at = excluded.updated_at
        `,
      )
      .run(namespace, id, JSON.stringify(payload), Date.now());
    return payload;
  }

  delete(namespace: string, id: string) {
    this.#db
      .prepare('delete from structured_records where namespace = ? and id = ?')
      .run(namespace, id);
  }

  close() {
    this.#db.close();
  }
}
