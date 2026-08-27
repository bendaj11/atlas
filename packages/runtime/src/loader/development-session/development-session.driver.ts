import {
  ATLAS_DEV_SESSION_RESPONSE,
  type AtlasDevelopmentSessionRequest,
} from '@atlas/schema';
import { requestDevelopmentSession } from './development-session.js';

export class DevelopmentSessionDriver {
  private readonly hostId = crypto.randomUUID();
  private readonly documentValue = {
    schemaVersion: '1',
    hostId: this.hostId,
    overrides: [],
  };
  private response: { document?: unknown; error?: string } = {
    document: this.documentValue,
  };
  private result?: unknown;
  private listener?: (event: MessageEvent) => void;
  private readonly originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  private readonly originalLocation = Object.getOwnPropertyDescriptor(
    globalThis,
    'location',
  );
  private readonly originalWindow = Object.getOwnPropertyDescriptor(
    globalThis,
    'window',
  );

  readonly given = {
    unavailableControlServer: (): void => {
      this.response = { error: 'Failed to fetch' };
    },
  };

  readonly when = {
    requested: async (): Promise<void> => {
      this.installBrowserBridge();
      this.result = await requestDevelopmentSession(this.hostId);
    },
  };

  readonly get = {
    document: (): unknown => this.documentValue,
    result: (): unknown => this.result,
  };

  dispose(): void {
    restoreGlobal('document', this.originalDocument);
    restoreGlobal('location', this.originalLocation);
    restoreGlobal('window', this.originalWindow);
  }

  private installBrowserBridge(): void {
    const bridgeWindow = {
      addEventListener: (
        _type: string,
        listener: (event: MessageEvent) => void,
      ) => {
        this.listener = listener;
      },
      clearTimeout,
      postMessage: (request: AtlasDevelopmentSessionRequest) => {
        queueMicrotask(() => {
          this.listener?.({
            data: {
              type: ATLAS_DEV_SESSION_RESPONSE,
              requestId: request.requestId,
              hostId: request.hostId,
              ...this.response,
            },
          } as MessageEvent);
        });
      },
      removeEventListener: () => {
        this.listener = undefined;
      },
      setTimeout,
    };
    Object.defineProperties(globalThis, {
      document: {
        configurable: true,
        value: { querySelector: () => ({}) },
      },
      location: { configurable: true, value: { origin: 'https://host.test' } },
      window: { configurable: true, value: bridgeWindow },
    });
  }
}

function restoreGlobal(
  name: 'document' | 'location' | 'window',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
