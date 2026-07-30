import { getRequestedDiffPaths, parseDiffFileBlocks } from './diff-groups';

interface CoverageEntry {
  displayPath: string;
  aliases: Set<string>;
  covered: boolean;
}

function normalizePath(value: string): string {
  return value
    .trim()
    .replace(/^[ab][\\/]/, '')
    .replace(/\\/g, '/');
}

function containsInspectableChange(raw: string): boolean {
  return (
    /^@@ /m.test(raw) ||
    /^(?:new|deleted) file mode /m.test(raw) ||
    /^(?:old|new) mode /m.test(raw) ||
    /^(?:rename|copy) (?:from|to) /m.test(raw) ||
    /^Binary files .+ differ$/m.test(raw) ||
    /^GIT binary patch$/m.test(raw)
  );
}

export class DiffCoverageTracker {
  private readonly entries: CoverageEntry[];

  constructor(diffContent: string) {
    this.entries = parseDiffFileBlocks(diffContent)
      .filter(({ raw }) => containsInspectableChange(raw))
      .map(({ aPath, bPath, displayPath }) => ({
        displayPath,
        aliases: new Set([normalizePath(aPath), normalizePath(bPath)]),
        covered: false,
      }));
  }

  recordToolCall(name: string, args: Record<string, unknown>): void {
    if (name !== 'get_diff') {
      return;
    }
    const requested = new Set(
      getRequestedDiffPaths(args).map((value) => normalizePath(value)),
    );
    for (const entry of this.entries) {
      if ([...entry.aliases].some((alias) => requested.has(alias))) {
        entry.covered = true;
      }
    }
  }

  getMissingPaths(): string[] {
    return this.entries
      .filter(({ covered }) => !covered)
      .map(({ displayPath }) => displayPath);
  }

  isComplete(): boolean {
    return this.getMissingPaths().length === 0;
  }

  assertComplete(): void {
    if (!this.isComplete()) {
      throw new Error(this.formatIncompleteMessage());
    }
  }

  formatIncompleteMessage(): string {
    const missing = this.getMissingPaths();
    return [
      'Commit message submission rejected: diff coverage is incomplete.',
      `Inspect the following changed file(s) with get_diff before submitting: ${JSON.stringify(missing)}`,
      "Use get_diff's paths array to inspect structurally related files in one harness-verified batch.",
    ].join('\n');
  }
}
