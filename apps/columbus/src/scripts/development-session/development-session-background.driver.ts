import { faker } from '@faker-js/faker';
import {
  ATLAS_DEV_ACTIVATION_PATH,
  ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION,
} from '@atlas/schema';
import {
  activateDevelopmentPreview,
  consumeDevelopmentSession,
} from './development-session-background.js';

export class DevelopmentSessionBackgroundDriver {
  private readonly tabId = faker.number.int({ min: 1 });
  private readonly hostId = faker.string.uuid();
  private readonly controlPort = faker.number.int({ min: 4_400, max: 5_000 });
  private readonly token = faker.string.alphanumeric(43);
  private readonly targetUrl = faker.internet.url();
  private readonly session = {
    schemaVersion: '1',
    hostId: this.hostId,
    overrides: [],
  };
  private readonly storage = new Map<string, unknown>();
  private currentTime = faker.date.recent().getTime();
  private consumedUrl?: string;
  private navigatedUrl?: string;
  private result?: unknown;
  private error?: unknown;

  readonly given = {
    pendingActivation:
      async (): Promise<DevelopmentSessionBackgroundDriver> => {
        await this.when.activated();
        return this;
      },
    expiredPendingActivation:
      async (): Promise<DevelopmentSessionBackgroundDriver> => {
        await this.when.activated();
        this.currentTime += 30_001;
        return this;
      },
  };

  readonly when = {
    activated: async (): Promise<void> => {
      await this.capture(() =>
        activateDevelopmentPreview(
          this.activationUrl('localhost'),
          this.tabId,
          this.activationDependencies(),
        ),
      );
    },
    activatedFromPublicOrigin: async (): Promise<void> => {
      await this.capture(() =>
        activateDevelopmentPreview(
          this.activationUrl(faker.internet.domainName()),
          this.tabId,
          this.activationDependencies(),
        ),
      );
    },
    consumed: async (): Promise<void> => {
      this.result = await consumeDevelopmentSession(
        this.targetUrl,
        this.tabId,
        this.hostId,
        this.consumptionDependencies(),
      );
    },
    consumedFromOtherOrigin: async (): Promise<void> => {
      this.result = await consumeDevelopmentSession(
        faker.internet.url(),
        this.tabId,
        this.hostId,
        this.consumptionDependencies(),
      );
    },
  };

  readonly get = {
    activation: (): unknown => ({
      consumedUrl: this.consumedUrl,
      navigatedUrl: this.navigatedUrl,
      pendingCount: this.storage.size,
    }),
    consumedDocument: (): unknown => this.result,
    consumption: (): unknown => ({
      document: this.result,
      pendingCount: this.storage.size,
    }),
    error: (): unknown => this.error,
    session: (): unknown => this.session,
  };

  private activationUrl(hostname: string): string {
    const url = new URL(
      ATLAS_DEV_ACTIVATION_PATH,
      `http://${hostname}:${this.controlPort}`,
    );
    url.searchParams.set('token', this.token);
    url.searchParams.set('protocol', ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION);
    return url.href;
  }

  private activationDependencies() {
    return {
      consumeActivation: async (url: string): Promise<unknown> => {
        this.consumedUrl = url;
        return {
          protocolVersion: ATLAS_DEV_ACTIVATION_PROTOCOL_VERSION,
          targetUrl: this.targetUrl,
          document: this.session,
        };
      },
      now: (): number => this.currentTime,
      store: async (key: string, value: unknown): Promise<void> => {
        this.storage.set(key, value);
      },
      navigate: async (_tabId: number, url: string): Promise<void> => {
        this.navigatedUrl = url;
      },
    };
  }

  private consumptionDependencies() {
    return {
      now: (): number => this.currentTime,
      read: async (key: string): Promise<unknown> => this.storage.get(key),
      remove: async (key: string): Promise<void> => {
        this.storage.delete(key);
      },
    };
  }

  private async capture(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.error = error;
    }
  }
}
