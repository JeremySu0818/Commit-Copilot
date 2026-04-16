export function escapeHtml(value: unknown): string {
  return String(value || '')
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
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    return escapeHtml(values[key] ?? '');
  });
}

export function renderStatusHtml(type: string, text: string): string {
  return `<span class="status-dot ${escapeHtml(type)}"></span>${escapeHtml(text)}`;
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
        : !!defaults.includeScope,
    includeBody:
      typeof candidate.includeBody === 'boolean'
        ? candidate.includeBody
        : !!defaults.includeBody,
    includeFooter:
      typeof candidate.includeFooter === 'boolean'
        ? candidate.includeFooter
        : !!defaults.includeFooter,
  };
}

export function normalizeMaxAgentStepsValue(value: unknown): number {
  const raw = String(value || '').trim();
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
  return raw || ollamaDefaultHost;
}
