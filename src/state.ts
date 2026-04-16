let isGenerating = false;
const generationListeners = new Set<() => void>();

let isValidating = false;
let validatingProvider: string | null = null;
const validationListeners = new Set<() => void>();

export const GenerationStateManager = {
  get isGenerating(): boolean {
    return isGenerating;
  },

  setGenerating(value: boolean): void {
    isGenerating = value;
    generationListeners.forEach((listener) => {
      listener();
    });
  },

  addListener(listener: () => void): void {
    generationListeners.add(listener);
  },

  removeListener(listener: () => void): void {
    generationListeners.delete(listener);
  },
};

export const ValidationStateManager = {
  get isValidating(): boolean {
    return isValidating;
  },

  get validatingProvider(): string | null {
    return validatingProvider;
  },

  setValidating(value: boolean, provider: string | null = null): void {
    isValidating = value;
    validatingProvider = provider;
    validationListeners.forEach((listener) => {
      listener();
    });
  },

  addListener(listener: () => void): void {
    validationListeners.add(listener);
  },

  removeListener(listener: () => void): void {
    validationListeners.delete(listener);
  },
};
