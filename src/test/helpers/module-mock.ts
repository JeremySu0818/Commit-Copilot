import Module from 'node:module';

type AsyncOrSync<T> = T | Promise<T>;

function clearRequireCache(modulePath: string): void {
  const resolved = require.resolve(modulePath);
  Reflect.deleteProperty(require.cache, resolved);
}

async function withModuleMock<T>(
  moduleName: string,
  mockValue: unknown,
  run: () => AsyncOrSync<T>,
): Promise<T> {
  const moduleImpl = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleImpl._load;

  moduleImpl._load = function (
    request: string,
    parent: unknown,
    isMain: boolean,
  ): unknown {
    if (request === moduleName) {
      return mockValue;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return await run();
  } finally {
    moduleImpl._load = originalLoad;
  }
}

export { clearRequireCache, withModuleMock };
