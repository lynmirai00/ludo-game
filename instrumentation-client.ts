// Runs in the browser before the app. Small polyfills for phone browsers older than Next.js's
// default targets (Safari 16.4 / Chrome 111), in case a dependency uses these newer built-ins.
// Our own code avoids them already. See node_modules/next/dist/docs/03-architecture/supported-browsers.md.

if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key),
    configurable: true,
    writable: true,
  });
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value(this: unknown[], index: number) {
      const i = Math.trunc(index) || 0;
      return this[i < 0 ? this.length + i : i];
    },
    configurable: true,
    writable: true,
  });
}

if (!Array.prototype.findLast) {
  Object.defineProperty(Array.prototype, 'findLast', {
    value(this: unknown[], predicate: (value: unknown, index: number, array: unknown[]) => boolean) {
      for (let i = this.length - 1; i >= 0; i--) if (predicate(this[i], i, this)) return this[i];
      return undefined;
    },
    configurable: true,
    writable: true,
  });
}

if (typeof AbortSignal !== 'undefined' && !('timeout' in AbortSignal)) {
  Object.defineProperty(AbortSignal, 'timeout', {
    value(ms: number) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    },
    configurable: true,
    writable: true,
  });
}
