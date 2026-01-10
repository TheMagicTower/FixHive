/**
 * Type declarations for bun:sqlite
 * These are minimal declarations needed for the LocalStore
 */
declare module 'bun:sqlite' {
  export class Database {
    constructor(filename: string, options?: { create?: boolean; readonly?: boolean });
    exec(sql: string): void;
    prepare<T = unknown>(sql: string): Statement<T>;
    close(): void;
    get changes(): number;
  }

  export class Statement<T = unknown> {
    run(...params: unknown[]): void;
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }
}
