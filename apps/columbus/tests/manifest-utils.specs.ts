import { expect, test } from '@jest/globals';
import type { AtlasExtensionManifest } from '../src/contracts.js';
import {
  artifactSourceDescription,
  createCustomManifest,
  createEditorDraft,
  resolveSelectedManifest,
} from '../src/popup/manifest-utils.js';

test('new custom draft starts with an empty URL', () => {
  const productionManifest = createProductionManifest();

  const draft = createEditorDraft({
    id: productionManifest.id,
    hostId: 'host',
    allowCustomOverrides: true,
    productionManifest,
    selectedManifest: undefined,
    productionOptions: [productionManifest],
    prOptions: [],
  });

  expect(draft.customUrl).toBe('');
});

test('existing custom draft keeps its configured URL', () => {
  const productionManifest = createProductionManifest();
  const selectedManifest = createCustomManifest({
    productionManifest,
    rawUrl: 'https://custom.example/app',
  });

  const draft = createEditorDraft({
    id: productionManifest.id,
    hostId: 'host',
    allowCustomOverrides: true,
    productionManifest,
    selectedManifest,
    productionOptions: [productionManifest],
    prOptions: [],
  });

  expect(draft.customUrl).toBe('https://custom.example/app');
});

test('custom Angular manifest uses local development assets and removes production integrity', () => {
  const manifest = createCustomManifest({
    productionManifest: createProductionManifest(),
    rawUrl: 'http://localhost:4201/',
  });

  expect(manifest).toMatchObject({
    channel: 'local',
    remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
    styles: [{ href: 'http://localhost:4201/styles.css' }],
    exportedWidgets: [
      { remoteEntryUrl: 'http://localhost:4201/remoteEntry.json' },
    ],
  });
  expect(manifest.integrity).toBeUndefined();
});

test('custom React manifest does not copy production styles', () => {
  const productionManifest = createProductionManifest();
  productionManifest.framework = 'react';

  expect(
    createCustomManifest({
      productionManifest,
      rawUrl: 'http://localhost:4201',
    }).styles,
  ).toStrictEqual([]);
});

test.each([
  'ftp://localhost/app',
  'http://user:secret@localhost/app',
  'http://localhost/app?debug=true',
  'http://localhost/app#debug',
])('custom manifest rejects unsafe base URL %s', (url) => {
  expect(() =>
    createCustomManifest({
      productionManifest: createProductionManifest(),
      rawUrl: url,
    }),
  ).toThrow();
});

test.each([
  'http://127.0.0.1:4201/remoteEntry.json',
  'https://cdn.example/app/remoteEntry.json',
])('custom manifest accepts HTTP(S) remote entry URL %s', (url) => {
  const manifest = createCustomManifest({
    productionManifest: createProductionManifest(),
    rawUrl: url,
  });

  expect(manifest.remoteEntryUrl).toBe(url);
});

test('missing PR selection reports an actionable error', () => {
  const productionManifest = createProductionManifest();

  expect(() =>
    resolveSelectedManifest({
      productionManifest,
      draft: {
        type: 'pr',
        customUrl: '',
        productionKey: '',
        prKey: '',
      },
      productionOptions: [productionManifest],
      prOptions: [],
    }),
  ).toThrow('Choose a PR version.');
});

test('past production override description matches its version dropdown label', () => {
  const manifest = {
    ...createProductionManifest(),
    version: '0.0.0',
    buildId: '1858fcb3dba8',
    remoteEntryUrl:
      'https://cdn.example/apps/app/0.0.0/1858fcb3dba8/remoteEntry.json',
  };

  expect(artifactSourceDescription(manifest)).toBe('0.0.0');
});

function createProductionManifest(): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'app',
    name: 'App',
    version: '1.0.0',
    buildId: 'production',
    channel: 'production',
    framework: 'angular',
    remoteEntryUrl:
      'https://cdn.example/apps/app/1.0.0/production/remoteEntry.json',
    integrity: 'sha256-production',
    styles: [
      {
        href: 'https://cdn.example/apps/app/1.0.0/production/assets/app.css',
        integrity: 'sha256-production-style',
      },
    ],
    exportedWidgets: [
      {
        remoteEntryUrl:
          'https://cdn.example/apps/app/1.0.0/production/widgets/summary.js',
      },
    ],
  };
}
