import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

export function installWebPlatformGlobals(): void {
  Object.assign(globalThis, { TextEncoder, TextDecoder });

  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
