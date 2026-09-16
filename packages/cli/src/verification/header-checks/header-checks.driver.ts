import type { AtlasManifest } from '@atlas/schema';
import {
  VerificationChecks,
  type AtlasVerificationCheck,
} from '../checks/checks.js';
import {
  checkContentType,
  checkCors,
  checkImmutableCache,
  checkIntegrity,
  checkMutableCache,
  type ExpectedContentType,
} from './header-checks.js';

export class HeaderChecksDriver {
  private readonly checks = new VerificationChecks();
  private headers: Record<string, string> = {};
  private readonly hostOrigin = 'https://host.example';

  readonly given = {
    headers: (headers: Record<string, string>): this => {
      this.headers = headers;

      return this;
    },
  };

  readonly when = {
    corsChecked: (url: string): void =>
      checkCors({
        checks: this.checks,
        response: this.response(),
        url: new URL(url),
        subject: 'asset',
        hostOrigin: this.hostOrigin,
      }),
    mutableCacheChecked: (): void =>
      checkMutableCache({
        checks: this.checks,
        response: this.response(),
        subject: 'asset',
      }),
    immutableCacheChecked: (channel: AtlasManifest['channel']): void =>
      checkImmutableCache({
        checks: this.checks,
        response: this.response(),
        subject: 'asset',
        channel,
      }),
    contentTypeChecked: (expected: ExpectedContentType): void =>
      checkContentType({
        checks: this.checks,
        response: this.response(),
        subject: 'asset',
        expected,
      }),
    integrityChecked: (options: {
      bytes: Uint8Array;
      integrity: string | undefined;
      channel: AtlasManifest['channel'];
    }): void =>
      checkIntegrity({ checks: this.checks, subject: 'asset', ...options }),
  };

  readonly get = {
    hostOrigin: (): string => this.hostOrigin,
    checks: (): AtlasVerificationCheck[] => this.checks.report('x').checks,
  };

  private response(): Response {
    return new Response(null, { headers: this.headers });
  }
}
