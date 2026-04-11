import * as path from 'path';

class MockUri {
  constructor(
    public readonly fsPath: string,
    public readonly scheme = 'file',
  ) {}

  static file(filePath: string): MockUri {
    return new MockUri(path.resolve(filePath), 'file');
  }

  with(change: { scheme?: string }): MockUri {
    return new MockUri(this.fsPath, change.scheme ?? this.scheme);
  }

  toString(): string {
    if (this.scheme === 'file') {
      return `file://${this.fsPath.replace(/\\/g, '/')}`;
    }
    return `${this.scheme}:${this.fsPath.replace(/\\/g, '/')}`;
  }
}

class MockPosition {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

class MockRange {
  constructor(
    public readonly start: MockPosition,
    public readonly end: MockPosition,
  ) {}
}

class MockDocumentSymbol {
  constructor(
    public readonly name: string,
    public readonly detail: string,
    public readonly kind: number,
    public readonly range: MockRange,
    public readonly selectionRange: MockRange,
    public readonly children: MockDocumentSymbol[] = [],
  ) {}
}

class MockSymbolInformation {
  constructor(
    public readonly name: string,
    public readonly kind: number,
    public readonly location: { uri: MockUri; range: MockRange },
  ) {}
}

class MockRelativePattern {
  constructor(
    public readonly base: string,
    public readonly pattern: string,
  ) {}
}

class MockTextDocument {
  private readonly lines: string[];

  constructor(
    public readonly uri: MockUri,
    text: string,
    public languageId = 'plaintext',
  ) {
    this.lines = text.split(/\r?\n/);
  }

  get lineCount(): number {
    return this.lines.length;
  }

  lineAt(line: number): { text: string } {
    return { text: this.lines[line] ?? '' };
  }
}

interface VscodeMockFactoryOptions {
  openTextDocument?: (input: unknown) => Promise<MockTextDocument>;
  executeCommand?: (command: string, ...args: unknown[]) => Promise<unknown>;
  setTextDocumentLanguage?: (
    document: MockTextDocument,
    languageId: string,
  ) => Promise<MockTextDocument>;
  findFiles?: (...args: unknown[]) => Promise<MockUri[]>;
  readFile?: (uri: MockUri) => Promise<Uint8Array>;
  stat?: (uri: MockUri) => Promise<{
    type: number;
    ctime: number;
    mtime: number;
    size: number;
  }>;
}

function createVscodeMock(options: VscodeMockFactoryOptions = {}): any {
  const SymbolKind = {
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
    EnumMember: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25,
  } as const;

  return {
    Uri: MockUri,
    Position: MockPosition,
    Range: MockRange,
    DocumentSymbol: MockDocumentSymbol,
    SymbolInformation: MockSymbolInformation,
    RelativePattern: MockRelativePattern,
    SymbolKind,
    workspace: {
      openTextDocument: async (input: unknown): Promise<MockTextDocument> => {
        if (options.openTextDocument) {
          return options.openTextDocument(input);
        }

        if (
          input &&
          typeof input === 'object' &&
          'content' in (input as Record<string, unknown>)
        ) {
          const content = String(
            (input as Record<string, unknown>).content ?? '',
          );
          return new MockTextDocument(
            new MockUri('untitled://document', 'untitled'),
            content,
            'plaintext',
          );
        }

        if (input instanceof MockUri) {
          return new MockTextDocument(input, '', 'plaintext');
        }

        throw new Error('Unexpected openTextDocument input.');
      },
      findFiles: async (...args: unknown[]): Promise<MockUri[]> => {
        if (options.findFiles) {
          return options.findFiles(...args);
        }
        return [];
      },
      fs: {
        readFile: async (uri: MockUri): Promise<Uint8Array> => {
          if (options.readFile) {
            return options.readFile(uri);
          }
          return new Uint8Array();
        },
        stat: async (uri: MockUri) => {
          if (options.stat) {
            return options.stat(uri);
          }
          return {
            type: 0,
            ctime: 0,
            mtime: 0,
            size: 0,
          };
        },
      },
    },
    commands: {
      executeCommand: async (
        command: string,
        ...args: unknown[]
      ): Promise<unknown> => {
        if (options.executeCommand) {
          return options.executeCommand(command, ...args);
        }
        return undefined;
      },
    },
    languages: {
      setTextDocumentLanguage: async (
        document: MockTextDocument,
        languageId: string,
      ): Promise<MockTextDocument> => {
        if (options.setTextDocumentLanguage) {
          return options.setTextDocumentLanguage(document, languageId);
        }
        document.languageId = languageId;
        return document;
      },
    },
  };
}

export {
  MockUri,
  MockRange,
  MockPosition,
  MockTextDocument,
  MockDocumentSymbol,
  MockSymbolInformation,
  createVscodeMock,
};
