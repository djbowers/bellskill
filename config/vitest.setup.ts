import '@testing-library/jest-dom/vitest';
import fetch from 'node-fetch';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '../src/mocks/server';

// @ts-ignore
global.fetch = fetch;

// jsdom ships none of the layout/pointer APIs Radix's popper-positioned
// primitives (DropdownMenu, Select) touch on open. Stub the minimum so those
// components can mount in tests.
if (!('ResizeObserver' in globalThis)) {
  // @ts-ignore
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!('DOMRect' in globalThis)) {
  // @ts-ignore
  globalThis.DOMRect = class {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      Object.assign(this, {
        x,
        y,
        width,
        height,
        top: y,
        left: x,
        right: x + width,
        bottom: y + height,
      });
    }
  };
}
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView ??= () => {};
  // @ts-ignore
  Element.prototype.hasPointerCapture ??= () => false;
  // @ts-ignore
  Element.prototype.setPointerCapture ??= () => {};
  // @ts-ignore
  Element.prototype.releasePointerCapture ??= () => {};
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
