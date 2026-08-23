import {
  TextDecoder as NodeTextDecoder,
  TextEncoder as NodeTextEncoder,
} from 'node:util';

interface TestMessagePort {
  onmessage?: ((event: { readonly data: unknown }) => void) | null;
  postMessage?(data: unknown): void;
}

class TestMessageChannel {
  readonly port1: TestMessagePort;
  readonly port2: TestMessagePort;

  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = {
      postMessage: (data: unknown) => {
        queueMicrotask(() => this.port1.onmessage?.({ data }));
      },
    };
  }
}

globalThis.MessageChannel ??=
  TestMessageChannel as unknown as typeof MessageChannel;
globalThis.TextDecoder ??= NodeTextDecoder as unknown as typeof TextDecoder;
globalThis.TextEncoder ??= NodeTextEncoder as unknown as typeof TextEncoder;
