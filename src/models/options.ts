export type GenerateMode = 'agentic' | 'direct-diff';

export interface CommitOutputOptions {
  includeScope: boolean;
  includeBody: boolean;
  includeFooter: boolean;
  includeGitmoji: boolean;
}

export interface HybridGenerationOptions {
  enabled: boolean;
}

export const GENERATE_MODE_DISPLAY_NAMES: Record<GenerateMode, string> = {
  agentic: 'Agentic Generate',
  'direct-diff': 'Direct Diff',
};

export const DEFAULT_HYBRID_GENERATION_OPTIONS: HybridGenerationOptions = {
  enabled: false,
};

export const HYBRID_GENERATION_OPTIONS_STATE_KEY = 'HYBRID_GENERATION_OPTIONS';
export const DEFAULT_GENERATE_MODE: GenerateMode = 'agentic';
export const MAX_AGENT_STEPS_STATE_KEY = 'MAX_AGENT_STEPS';
export const DEFAULT_MAX_AGENT_STEPS = 0;

export const DEFAULT_COMMIT_OUTPUT_OPTIONS: CommitOutputOptions = {
  includeScope: true,
  includeBody: true,
  includeFooter: false,
  includeGitmoji: false,
};

export function resolveGenerateMode(
  savedGenerateMode: GenerateMode | undefined,
  requestedGenerateMode: GenerateMode | undefined,
): GenerateMode {
  return requestedGenerateMode ?? savedGenerateMode ?? DEFAULT_GENERATE_MODE;
}

export function normalizeCommitOutputOptions(
  options: unknown,
): CommitOutputOptions {
  const candidate =
    options && typeof options === 'object'
      ? (options as Partial<CommitOutputOptions>)
      : {};

  return {
    includeScope:
      typeof candidate.includeScope === 'boolean'
        ? candidate.includeScope
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeScope,
    includeBody:
      typeof candidate.includeBody === 'boolean'
        ? candidate.includeBody
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeBody,
    includeFooter:
      typeof candidate.includeFooter === 'boolean'
        ? candidate.includeFooter
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeFooter,
    includeGitmoji:
      typeof candidate.includeGitmoji === 'boolean'
        ? candidate.includeGitmoji
        : DEFAULT_COMMIT_OUTPUT_OPTIONS.includeGitmoji,
  };
}

export function normalizeHybridGenerationOptions(
  options: unknown,
): HybridGenerationOptions {
  const candidate =
    options && typeof options === 'object'
      ? (options as Partial<HybridGenerationOptions>)
      : {};

  return {
    enabled:
      typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : DEFAULT_HYBRID_GENERATION_OPTIONS.enabled,
  };
}

export function normalizeMaxAgentStepsValue(value: unknown): number {
  let raw = '';
  if (typeof value === 'string') {
    raw = value.trim();
  } else if (typeof value === 'number') {
    raw = String(value);
  }
  if (!raw || !/^\d+$/.test(raw)) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}
