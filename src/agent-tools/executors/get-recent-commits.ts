import { GitOperations } from '../../commit-copilot';

function parseCommitCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

async function executeGetRecentCommits(
  args: Record<string, unknown>,
  gitOps?: GitOperations,
): Promise<string> {
  if (!gitOps) {
    return 'Error: git operations are not available to retrieve commit history.';
  }

  const count = parseCommitCount(args.count);
  if (!count || count <= 0) {
    return "Error: 'count' is required and must be a positive integer.";
  }

  const messages = await gitOps.getRecentCommitMessages(count);
  if (messages.length === 0) {
    return 'No recent commits found.';
  }

  const lines: string[] = [
    `Recent commits (last ${String(messages.length)}, newest first):`,
  ];

  messages.forEach((message, index) => {
    lines.push('');
    lines.push(`[${String(index + 1)}]`);
    const msgLines = message.split(/\r?\n/);
    for (const line of msgLines) {
      lines.push(`  ${line}`);
    }
  });

  return lines.join('\n');
}

export { executeGetRecentCommits };
