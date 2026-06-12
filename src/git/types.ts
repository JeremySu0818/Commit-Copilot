export interface GitChange {
  readonly uri: { fsPath: string };
  readonly status: number;
}

export interface GitCommit {
  readonly message: string;
}

export interface GitRepository {
  readonly rootUri: { fsPath: string; toString(): string };
  readonly state: {
    readonly workingTreeChanges: readonly GitChange[];
    readonly indexChanges: readonly GitChange[];
    readonly untrackedChanges: readonly GitChange[];
  };
  readonly inputBox: { value: string };
  diff(cached?: boolean): Promise<string>;
  lsFiles?(path?: string): Promise<string[]>;
  add(paths: string[]): Promise<void>;
  show(ref: string, path: string): Promise<string>;
  log(options?: { maxEntries?: number; path?: string }): Promise<GitCommit[]>;
  commit(message: string, opts?: { all?: boolean | 'tracked' }): Promise<void>;
  status(): Promise<void>;
}
