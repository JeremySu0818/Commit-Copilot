const WORD_LABELS: Record<string, string> = {
  gpt: 'GPT',
  oss: 'OSS',
  chatgpt: 'ChatGPT',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  vl: 'VL',
  xl: 'XL',
  xxl: 'XXL',
};

export function getModelAlias(id: string, displayName?: unknown): string {
  if (
    typeof displayName === 'string' &&
    displayName.trim() &&
    displayName !== id
  ) {
    return displayName.trim();
  }
  const name =
    id
      .replace(/^models\//, '')
      .split('/')
      .pop() ?? id;
  return name
    .replace(/^(qwen|gemma|llama|phi)(?=\d)/i, '$1 ')
    .replace(/[-_]\d{8}(?=$|[-_:])/g, '')
    .replace(/(\d)[-_](?=\d(?:[-_]|$))/g, '$1.')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      const word = part.toLowerCase();
      if (WORD_LABELS[word]) {
        return WORD_LABELS[word];
      }
      if (/^o\d/.test(word)) {
        return word;
      }
      if (/^\d/.test(word)) {
        return part.replace(/b$/i, 'B');
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}
