const { TextDecoder, TextEncoder } = require('node:util');

class TestMessageChannel {
  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = {
      postMessage: (data) => {
        queueMicrotask(() => this.port1.onmessage?.({ data }));
      },
    };
  }
}

globalThis.MessageChannel ??= TestMessageChannel;
globalThis.TextDecoder ??= TextDecoder;
globalThis.TextEncoder ??= TextEncoder;
