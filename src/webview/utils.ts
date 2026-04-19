export function escapeHtml(value: unknown): string {
  let textValue = '';
  if (typeof value === 'string') {
    textValue = value;
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    textValue = String(value);
  }

  return textValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return escapeHtml(values[key] ?? '');
  });
}

export function renderStatusHtml(type: string, text: string): string {
  return `<span class="status-dot ${escapeHtml(type)}"></span>${escapeHtml(text)}`;
}

export type StatusType = 'success' | 'error' | 'warning';

export interface StatusMessage {
  type: StatusType;
  text: string;
}

function normalizeStatusType(value: unknown): StatusType {
  if (value === 'success' || value === 'error') {
    return value;
  }
  return 'warning';
}

export function createStatusMessage(
  type: unknown,
  text: unknown,
): StatusMessage {
  return {
    type: normalizeStatusType(type),
    text: typeof text === 'string' ? text : '',
  };
}

export function normalizeGenerateMode(
  mode: unknown,
): 'agentic' | 'direct-diff' {
  return mode === 'direct-diff' ? 'direct-diff' : 'agentic';
}

export function normalizeCommitOutputOptions(
  options: unknown,
  defaults: {
    includeScope: boolean;
    includeBody: boolean;
    includeFooter: boolean;
  },
): { includeScope: boolean; includeBody: boolean; includeFooter: boolean } {
  const candidate =
    options && typeof options === 'object'
      ? (options as Record<string, unknown>)
      : {};
  return {
    includeScope:
      typeof candidate.includeScope === 'boolean'
        ? candidate.includeScope
        : defaults.includeScope,
    includeBody:
      typeof candidate.includeBody === 'boolean'
        ? candidate.includeBody
        : defaults.includeBody,
    includeFooter:
      typeof candidate.includeFooter === 'boolean'
        ? candidate.includeFooter
        : defaults.includeFooter,
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

export function normalizeOllamaHostValue(
  value: unknown,
  ollamaDefaultHost: string,
): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length > 0 ? raw : ollamaDefaultHost;
}
