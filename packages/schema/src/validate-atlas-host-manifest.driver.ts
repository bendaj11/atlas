import type { AtlasHeadlessApp } from './atlas-headless-app.js';
import type { AtlasHostManifest } from './atlas-host-manifest.js';
import type { AtlasValidationIssue } from './atlas-validation-issue.js';
import { validateAtlasHostManifest } from './validate-atlas-host-manifest.js';

export class HostManifestValidationDriver {
  private headlessApps: AtlasHeadlessApp[] | undefined;
  private issues: AtlasValidationIssue[] = [];

  given = {
    headlessApps: (headlessApps: AtlasHeadlessApp[]): void => {
      this.headlessApps = headlessApps;
    },
  };

  when = {
    validate: (): void => {
      this.issues = validateAtlasHostManifest(this.manifest());
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues,
    issueMessage: (path: string): string | undefined =>
      this.issues.find((issue) => issue.path === path)?.message,
  };

  private manifest(): AtlasHostManifest {
    return {
      schemaVersion: '1',
      kind: 'host',
      id: 'host',
      name: 'Host',
      version: '1.0.0',
      buildId: 'build-1',
      channel: 'production',
      framework: 'react',
      remoteEntryUrl: 'https://cdn.example.com/host/remoteEntry.json',
      exposes: { entry: './host' },
      requiredLoaderApiVersion: '^1.0.0',
      createdAt: '2026-08-06T00:00:00.000Z',
      ...(this.headlessApps ? { headlessApps: this.headlessApps } : {}),
    };
  }
}
