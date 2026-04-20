export interface ParsedUpstreamRef {
  remote: string;
  branch: string;
}

export interface RewriteRecoveryCommandPlan {
  upstreamRef: string;
  fetchArgs: string[];
  rebaseArgs: string[];
  retryPushArgs: string[];
  displayCommands: string[];
}

function normalizeMessage(rawErrorMessage: string): string {
  return rawErrorMessage.toLowerCase();
}

function formatGitCommand(args: string[]): string {
  return `git ${args.join(' ')}`;
}

export function splitUpstreamRef(
  upstreamRef: string,
): ParsedUpstreamRef | null {
  const slashIndex = upstreamRef.indexOf('/');
  if (slashIndex <= 0 || slashIndex === upstreamRef.length - 1) {
    return null;
  }
  return {
    remote: upstreamRef.slice(0, slashIndex),
    branch: upstreamRef.slice(slashIndex + 1),
  };
}

export function buildRewriteRecoveryCommandPlan(
  upstreamRef: string,
): RewriteRecoveryCommandPlan {
  const trimmedUpstreamRef = upstreamRef.trim();
  const parsedUpstream = splitUpstreamRef(trimmedUpstreamRef);
  const fetchArgs = parsedUpstream
    ? ['fetch', '--prune', parsedUpstream.remote, parsedUpstream.branch]
    : ['fetch', '--prune'];
  const rebaseArgs = ['rebase', trimmedUpstreamRef];
  const retryPushArgs = ['push', '--force-with-lease'];

  return {
    upstreamRef: trimmedUpstreamRef,
    fetchArgs,
    rebaseArgs,
    retryPushArgs,
    displayCommands: [
      formatGitCommand(fetchArgs),
      formatGitCommand(rebaseArgs),
      formatGitCommand(retryPushArgs),
    ],
  };
}

export function buildManualRewriteRecoveryCommands(params: {
  upstreamRef: string | null;
  branchName?: string;
}): string[] {
  if (params.upstreamRef) {
    return buildRewriteRecoveryCommandPlan(params.upstreamRef).displayCommands;
  }

  const trimmedBranchName = params.branchName?.trim();
  const branchToken =
    trimmedBranchName !== undefined && trimmedBranchName.length > 0
      ? trimmedBranchName
      : '<branch>';
  return [
    `git fetch --prune <remote> ${branchToken}`,
    `git branch --set-upstream-to <remote>/${branchToken} ${branchToken}`,
    `git rebase <remote>/${branchToken}`,
    'git push --force-with-lease',
  ];
}

export function isLeaseConflictError(rawErrorMessage: string): boolean {
  const normalized = normalizeMessage(rawErrorMessage);
  return (
    normalized.includes('stale info') ||
    normalized.includes('non-fast-forward') ||
    normalized.includes('fetch first') ||
    normalized.includes('[rejected]') ||
    (normalized.includes('rejected') && normalized.includes('lease'))
  );
}

export function isCredentialOrPromptError(rawErrorMessage: string): boolean {
  const normalized = normalizeMessage(rawErrorMessage);
  return (
    normalized.includes('authentication failed') ||
    normalized.includes('could not read username') ||
    normalized.includes('could not read password') ||
    normalized.includes('terminal prompts disabled') ||
    normalized.includes('credential') ||
    normalized.includes('git credential') ||
    normalized.includes('gcm') ||
    normalized.includes('single sign-on') ||
    normalized.includes('sso') ||
    normalized.includes('permission denied') ||
    normalized.includes('publickey')
  );
}

export function isCommandUnavailableError(
  error: unknown,
  commandId: string,
): boolean {
  const message = (error instanceof Error ? error.message : String(error))
    .trim()
    .toLowerCase();
  const normalizedCommandId = commandId.toLowerCase();
  return (
    message.includes(normalizedCommandId) &&
    (message.includes('not found') ||
      message.includes('not available') ||
      message.includes('command') ||
      message.includes('unknown'))
  );
}
