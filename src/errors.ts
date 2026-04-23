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
    title: 'NOT_GIT_REPO',
  },
  [EXIT_CODES.STAGE_FAILED]: {
    title: 'STAGE_FAILED',
  },
  [EXIT_CODES.NO_CHANGES]: {
    title: 'NO_CHANGES',
  },
  [EXIT_CODES.NO_CHANGES_BUT_UNTRACKED]: {
    title: 'NO_CHANGES_BUT_UNTRACKED',
  },
  [EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED]: {
    title: 'NO_TRACKED_CHANGES_BUT_UNTRACKED',
  },
  [EXIT_CODES.CANCELLED]: {
    title: 'CANCELLED',
  },
  [EXIT_CODES.MIXED_CHANGES]: {
    title: 'MIXED_CHANGES',
  },
  [EXIT_CODES.API_KEY_MISSING]: {
    title: 'API_KEY_MISSING',
  },
  [EXIT_CODES.API_KEY_INVALID]: {
    title: 'API_KEY_INVALID',
  },
  [EXIT_CODES.QUOTA_EXCEEDED]: {
    title: 'QUOTA_EXCEEDED',
  },
  [EXIT_CODES.API_ERROR]: {
    title: 'API_ERROR',
  },
  [EXIT_CODES.COMMIT_FAILED]: {
    title: 'COMMIT_FAILED',
  },
  [EXIT_CODES.UNKNOWN_ERROR]: {
    title: 'UNKNOWN_ERROR',
  },
};

function appendDetails(prefix: string, details?: string): string {
  if (!details) {
    return prefix;
  }
  return `${prefix}: ${details}`;
}

export type CommitCopilotErrorMessageKey =
  | 'api.keyMissing'
  | 'api.keyInvalid'
  | 'api.quotaExceeded'
  | 'api.requestFailed'
  | 'api.emptyResponse'
  | 'api.emptyTextResponse'
  | 'api.emptyFinalResponse'
  | 'api.responseTruncated'
  | 'api.finalResponseTruncated'
  | 'api.ollamaConnectionFailed'
  | 'api.ollamaModelNotFound'
  | 'api.unknownAnthropicModel'
  | 'git.notRepository'
  | 'git.stageFailed'
  | 'generation.noChanges'
  | 'generation.noChangesButUntracked'
  | 'generation.noTrackedChangesButUntracked'
  | 'generation.mixedChanges'
  | 'generation.cancelled'
  | 'rewrite.commitHashRequired'
  | 'rewrite.commitNotFound'
  | 'rewrite.mergeCommitUnsupported'
  | 'rewrite.workspaceNotCleanBoth'
  | 'rewrite.workspaceNotCleanStaged'
  | 'rewrite.workspaceNotCleanUnstaged'
  | 'rewrite.emptyMessage'
  | 'rewrite.detachedHead'
  | 'rewrite.commitNotReachable'
  | 'rewrite.upstreamVerifyFailed'
  | 'rewrite.remoteNotIntegrated'
  | 'rewrite.autoSyncMissingUpstream'
  | 'rewrite.autoSyncUpstreamUnavailable'
  | 'rewrite.autoSyncUnsafeRemoteRewrite'
  | 'rewrite.forcePushStaleInfo';

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
    super('API_KEY_MISSING', 'API_KEY_MISSING', EXIT_CODES.API_KEY_MISSING, {
      messageKey: 'api.keyMissing',
    });
    this.name = 'APIKeyMissingError';
  }
}

export class APIKeyInvalidError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('API_KEY_INVALID', details),
      'API_KEY_INVALID',
      EXIT_CODES.API_KEY_INVALID,
      {
        messageKey: 'api.keyInvalid',
        messageArgs: { details: details ?? '' },
      },
    );
    this.name = 'APIKeyInvalidError';
  }
}

export class APIQuotaExceededError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('QUOTA_EXCEEDED', details),
      'QUOTA_EXCEEDED',
      EXIT_CODES.QUOTA_EXCEEDED,
      {
        messageKey: 'api.quotaExceeded',
        messageArgs: { details: details ?? '' },
      },
    );
    this.name = 'APIQuotaExceededError';
  }
}

export class APIRequestError extends CommitCopilotError {
  constructor(details?: string, options: CommitCopilotErrorOptions = {}) {
    const messageKey = options.messageKey ?? 'api.requestFailed';
    super(
      appendDetails(messageKey, details),
      'API_ERROR',
      EXIT_CODES.API_ERROR,
      {
        ...options,
        messageKey,
        messageArgs: {
          details: details ?? '',
          ...(options.messageArgs ?? {}),
        },
      },
    );
    this.name = 'APIRequestError';
  }
}

export class NoChangesError extends CommitCopilotError {
  constructor() {
    super('NO_CHANGES', 'NO_CHANGES', EXIT_CODES.NO_CHANGES, {
      messageKey: 'generation.noChanges',
    });
    this.name = 'NoChangesError';
  }
}

export class NoChangesButUntrackedError extends CommitCopilotError {
  constructor() {
    super(
      'NO_CHANGES_BUT_UNTRACKED',
      'NO_CHANGES_BUT_UNTRACKED',
      EXIT_CODES.NO_CHANGES_BUT_UNTRACKED,
      { messageKey: 'generation.noChangesButUntracked' },
    );
    this.name = 'NoChangesButUntrackedError';
  }
}

export class NoTrackedChangesButUntrackedError extends CommitCopilotError {
  constructor() {
    super(
      'NO_TRACKED_CHANGES_BUT_UNTRACKED',
      'NO_TRACKED_CHANGES_BUT_UNTRACKED',
      EXIT_CODES.NO_TRACKED_CHANGES_BUT_UNTRACKED,
      { messageKey: 'generation.noTrackedChangesButUntracked' },
    );
    this.name = 'NoTrackedChangesButUntrackedError';
  }
}

export class MixedChangesError extends CommitCopilotError {
  constructor() {
    super('MIXED_CHANGES', 'MIXED_CHANGES', EXIT_CODES.MIXED_CHANGES, {
      messageKey: 'generation.mixedChanges',
    });
    this.name = 'MixedChangesError';
  }
}

export class StageFailedError extends CommitCopilotError {
  constructor(details?: string) {
    super(
      appendDetails('STAGE_FAILED', details),
      'STAGE_FAILED',
      EXIT_CODES.STAGE_FAILED,
      {
        messageKey: 'git.stageFailed',
        messageArgs: { details: details ?? '' },
      },
    );
    this.name = 'StageFailedError';
  }
}

export class GenerationCancelledError extends CommitCopilotError {
  constructor() {
    super('CANCELLED', 'CANCELLED', EXIT_CODES.CANCELLED, {
      messageKey: 'generation.cancelled',
    });
    this.name = 'GenerationCancelledError';
  }
}

export function createEmptyResponseError(provider: string): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.emptyResponse',
    messageArgs: { provider },
  });
}

export function createEmptyTextResponseError(
  provider: string,
): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.emptyTextResponse',
    messageArgs: { provider },
  });
}

export function createEmptyFinalResponseError(
  provider: string,
): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.emptyFinalResponse',
    messageArgs: { provider },
  });
}

export function createTruncatedResponseError(
  provider: string,
  stopReason: string,
): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.responseTruncated',
    messageArgs: { provider, stopReason },
  });
}

export function createTruncatedFinalResponseError(
  provider: string,
  stopReason: string,
): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.finalResponseTruncated',
    messageArgs: { provider, stopReason },
  });
}

export function createOllamaConnectionError(host: string): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.ollamaConnectionFailed',
    messageArgs: { host },
  });
}

export function createOllamaModelNotFoundError(model: string): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.ollamaModelNotFound',
    messageArgs: { model },
  });
}

export function createUnknownAnthropicModelError(
  model: string,
): APIRequestError {
  return new APIRequestError(undefined, {
    messageKey: 'api.unknownAnthropicModel',
    messageArgs: { model },
  });
}
