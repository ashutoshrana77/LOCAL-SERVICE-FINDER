declare module 'node:sqlite' {
  export interface SQLInputValue {}
  export type SQLOutputValue = null | number | bigint | string | Uint8Array;

  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    all(...namedOrPositional: unknown[]): Record<string, SQLOutputValue>[];
    get(...namedOrPositional: unknown[]): Record<string, SQLOutputValue> | undefined;
    run(...namedOrPositional: unknown[]): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean; readOnly?: boolean; enableForeignKeyConstraints?: boolean });
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
