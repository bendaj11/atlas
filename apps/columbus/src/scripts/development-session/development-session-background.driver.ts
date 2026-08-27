import { faker } from '@faker-js/faker';
import { loadDevelopmentSession } from './development-session-background.js';

export class DevelopmentSessionBackgroundDriver {
  private readonly hostId = faker.string.uuid();
  private readonly previewUrl = faker.internet.url();
  private readonly session = {
    schemaVersion: '1',
    hostId: this.hostId,
    overrides: [],
  };
  private controlPort?: number;
  private requestedUrl?: string;
  private returnedSession: unknown = this.session;
  private result?: unknown;
  private error?: unknown;

  readonly given = {
    customControlPort: (): void => {
      this.controlPort = 4_512;
    },
    mismatchedSession: (): void => {
      this.returnedSession = { ...this.session, hostId: faker.string.uuid() };
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.result = await loadDevelopmentSession(
          {
            controlPort: this.controlPort,
            hostId: this.hostId,
            previewUrl: this.previewUrl,
          },
          {
            fetchJson: async (url) => {
              this.requestedUrl = url;
              return this.returnedSession;
            },
          },
        );
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    previewUrl: (): string => new URL(this.previewUrl).href,
    requestedControlPort: (): string | undefined =>
      this.requestedUrl ? new URL(this.requestedUrl).port : undefined,
    requestedPreviewUrl: (): string | null | undefined =>
      this.requestedUrl
        ? new URL(this.requestedUrl).searchParams.get('previewUrl')
        : undefined,
    result: (): unknown => this.result,
    session: (): unknown => this.session,
  };
}
