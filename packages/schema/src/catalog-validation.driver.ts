import type { AtlasHeadlessApp } from './atlas-headless-app.js';
import type { AtlasHostCatalog } from './atlas-host-catalog.js';
import type { AtlasHostManifest } from './atlas-host-manifest.js';
import type { AtlasManifest } from './atlas-manifest.js';
import type { AtlasValidationIssue } from './atlas-validation-issue.js';
import { createManifestFromConfig } from './create-manifest-from-config.js';
import { validateHostCatalog } from './catalog-validation.js';

export class CatalogValidationDriver {
  private app: AtlasManifest | undefined;
  private headlessApp: AtlasHeadlessApp | undefined;
  private issues: AtlasValidationIssue[] = [];

  given = {
    app: (input: { id: string; path: string }): void => {
      this.app = createManifestFromConfig({
        config: {
          id: input.id,
          framework: 'react',
          routes: [{ hostId: 'host', path: input.path }],
        },
        version: '1.0.0',
        buildId: 'build-1',
        remoteEntryUrl: 'https://cdn.example.com/app/remoteEntry.json',
        createdAt: '2026-08-06T00:00:00.000Z',
      });
    },
    headlessApp: (app: AtlasHeadlessApp): void => {
      this.headlessApp = app;
    },
  };

  when = {
    validate: (): void => {
      this.issues = validateHostCatalog(this.catalog());
    },
  };

  get = {
    issueMessage: (path: string): string | undefined =>
      this.issues.find((issue) => issue.path === path)?.message,
  };

  private catalog(): AtlasHostCatalog {
    return {
      schemaVersion: '1',
      hostId: 'host',
      revision: 'sha256:test',
      generatedAt: '2026-08-06T00:00:00.000Z',
      host: this.hostManifest(),
      apps: this.app ? [this.app] : [],
    };
  }

  private hostManifest(): AtlasHostManifest {
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
      ...(this.headlessApp ? { headlessApps: [this.headlessApp] } : {}),
    };
  }
}
