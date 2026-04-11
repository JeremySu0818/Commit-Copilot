export class GenerationStateManager {
  private static _isGenerating = false;
  private static _listeners = new Set<() => void>();

  static get isGenerating(): boolean {
    return this._isGenerating;
  }

  static setGenerating(value: boolean): void {
    this._isGenerating = value;
    this._listeners.forEach((listener) => {
      listener();
    });
  }

  static addListener(listener: () => void): void {
    this._listeners.add(listener);
  }

  static removeListener(listener: () => void): void {
    this._listeners.delete(listener);
  }
}

export class ValidationStateManager {
  private static _isValidating = false;
  private static _validatingProvider: string | null = null;
  private static _listeners = new Set<() => void>();

  static get isValidating(): boolean {
    return this._isValidating;
  }

  static get validatingProvider(): string | null {
    return this._validatingProvider;
  }

  static setValidating(value: boolean, provider: string | null = null): void {
    this._isValidating = value;
    this._validatingProvider = provider;
    this._listeners.forEach((listener) => {
      listener();
    });
  }

  static addListener(listener: () => void): void {
    this._listeners.add(listener);
  }

  static removeListener(listener: () => void): void {
    this._listeners.delete(listener);
  }
}
