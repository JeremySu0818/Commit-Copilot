export const EXIT_CODES = {
  SUCCESS: 0,
  NOT_GIT_REPO: 1,
  STAGE_FAILED: 2,
  NO_CHANGES: 3,
  NO_CHANGES_BUT_UNTRACKED: 4,
  NO_TRACKED_CHANGES_BUT_UNTRACKED: 5,
  CANCELLED: 6,
  API_KEY_MISSING: 10,
  API_KEY_INVALID: 11,
  QUOTA_EXCEEDED: 12,
  API_ERROR: 13,
  MIXED_CHANGES: 14,
  COMMIT_FAILED: 20,
  UNKNOWN_ERROR: 99,
} as const;

export const ERROR_MESSAGES: Record<
  number,
  { title: string; action?: string }
> = {
  [EXIT_CODES.NOT_GIT_REPO]: {
    title: 'Not a Git repository',
    action: 'Please open a folder that contains a Git repository.',
  },
  [EXIT_CODES.STAGE_FAILED]: {
    title: 'Failed to stage changes',
    action: 'Check if Git is properly configured.',
  },
  [EXIT_CODES.NO_CHANGES]: {
    title: 'No changes to commit',
    action: 'Make some changes to your files first.',
  },
  [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
    title: 'No staged changes detected',
    action:
      'Untracked files found. Please stage them to generate a commit message.',
  },
  [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
    title: 'Only untracked files found',
    action:
      'You have newly created files but no tracked modifications. Please stage them to generate a commit.',
  },
  [EXIT_CODES.CANCELLED]: {
    title: 'Generation cancelled',
    action: 'Generation was cancelled by user.',
  },
  [EXIT_CODES.MIXED_CHANGES]: {
    title: 'Mixed changes detected',
    action:
      'You have both staged and unstaged changes. Please choose how to proceed.',
  },
  [EXIT_CODES.API_KEY_MISSING]: {
    title: 'API Key not configured',
    action: 'Please set your API Key in the Commit-Copilot panel.',
  },
  [EXIT_CODES.API_KEY_INVALID]: {
    title: 'Invalid API Key',
    action:
      'Your API Key is invalid or has been revoked. Please check and update it.',
  },
  [EXIT_CODES.QUOTA_EXCEEDED]: {
    title: 'API quota exceeded',
    action:
      'You have exceeded your API quota. Please check your provider account.',
  },
  [EXIT_CODES.API_ERROR]: {
    title: 'API request failed',
    action: 'There was an error communicating with the API. Please try again.',
  },
  [EXIT_CODES.COMMIT_FAILED]: {
    title: 'Failed to commit changes',
    action: 'Check if there are any Git conflicts or issues.',
  },
  [EXIT_CODES.UNKNOWN_ERROR]: {
    title: 'An unexpected error occurred',
    action: 'Check the "Commit-Copilot Debug" output for details.',
  },
};

function appendDetails(prefix: string, details?: string): string {
  if (!details) {
    return prefix;
  }
  return `${prefix}: ${details}`;
}

export type CommitCopilotErrorMessageKey =
  | 'git.notRepository'
  | 'rewrite.commitHashRequired'
  | 'rewrite.commitNotFound'
  | 'rewrite.mergeCommitUnsupported'
  | 'rewrite.workspaceNotCleanBoth'
  | 'rewrite.workspaceNotCleanStaged'
  | 'rewrite.workspaceNotCleanUnstaged'
  | 'rewrite.emptyMessage'
  | 'rewrite.detachedHead'
  | 'rewrite.commitNotReachable';

export interface CommitCopilotErrorOptions {
  messageKey?: CommitCopilotErrorMessageKey;
  messageArgs?: Partial<Record<string, string>>;
}

export class CommitCopilotError extends Error {
  public readonly messageKey?: CommitCopilotErrorMessageKey;
  public readonly messageArgs?: Partial<Record<string, string>>;

  constructor(
    message: string,
    public readonly errorCode = 'UNKNOWN',
    public readonly exitCode: number = EXIT_CODES.UNKNOWN_ERROR,
    options: CommitCopilotErrorOptions = {},
  ) {
    super(message);
    this.name = 'CommitCopilotError';
    this.messageKey = options.messageKey;
    this.messageArgs = options.messageArgs;
  }
}

export class APIKeyMissingError extends CommitCopilotError {
  constructor() {
    super(
      'API Key is not set. Please configure your API key.',
      'API_KEY_MISSING',
      EXIT_CODES.API_KEY_MISSING,
    );
    this.name = 'APIKeyMissingError';
  }
}

export class APIKeyInvalidError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('Invalid API Key', details),
      'API_KEY_INVALID',
      EXIT_CODES.API_KEY_INVALID,
    );
    this.name = 'APIKeyInvalidError';
  }
}

export class APIQuotaExceededError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('API quota exceeded', details),
      'QUOTA_EXCEEDED',
      EXIT_CODES.QUOTA_EXCEEDED,
    );
    this.name = 'APIQuotaExceededError';
  }
}

export class APIRequestError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('API request failed', details),
      'API_ERROR',
      EXIT_CODES.API_ERROR,
    );
    this.name = 'APIRequestError';
  }
}

export class NoChangesError extends CommitCopilotError {
  constructor() {
    super(
      'No changes detected to generate a commit for.',
      'NO_CHANGES',
      EXIT_CODES.NO_CHANGES,
    );
    this.name = 'NoChangesError';
  }
}

export class NoChangesButUntrackedError extends CommitCopilotError {
  constructor() {
    super(
      'No changes to commit, but untracked files were detected.',
      'NO_CHANGES_BUT_UNTRACKED',
      EXIT_CODES.NO_CHANGES_BUT_UNTRACKED,
    );
    this.name = 'NoChangesButUntrackedError';
  }
}

export class NoTrackedChangesButUntrackedError extends CommitCopilotError {
  constructor() {
    super(
      'No tracked changes detected, only untracked files are present.',
      'NO_TRACKED_CHANGES_BUT_UNTRACKED',
      EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED,
    );
    this.name = 'NoTrackedChangesButUntrackedError';
  }
}

export class MixedChangesError extends CommitCopilotError {
  constructor() {
    super(
      'Both staged and unstaged changes were detected.',
      'MIXED_CHANGES',
      EXIT_CODES.MIXED_CHANGES,
    );
    this.name = 'MixedChangesError';
  }
}

export class StageFailedError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('Failed to stage changes', details),
      'STAGE_FAILED',
      EXIT_CODES.STAGE_FAILED,
    );
    this.name = 'StageFailedError';
  }
}

export class GenerationCancelledError extends CommitCopilotError {
  constructor() {
    super('Generation canceled by user.', 'CANCELLED', EXIT_CODES.CANCELLED);
    this.name = 'GenerationCancelledError';
  }
}
