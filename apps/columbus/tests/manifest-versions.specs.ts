import { expect, test } from '@jest/globals';
import type { AtlasExtensionManifest } from '../src/contracts.js';
import { uniqueVersions } from '../src/manifest-versions.js';
import {
  artifactSourceDescription,
  versionLabel,
} from '../src/popup/manifest-utils.js';

test('release history sorts production, PR, then local builds', () => {
  const productionManifest = manifest({
    channel: 'production',
    buildId: 'production',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const pullRequestManifest = manifest({
    channel: 'pr',
    version: '1.0.0-pr.42',
    buildId: 'pull-request',
    prNumber: 42,
  });
  const localManifest = manifest({ channel: 'local', buildId: 'local' });

  expect(
    uniqueVersions([
      localManifest,
      pullRequestManifest,
      productionManifest,
    ]).map(({ channel }) => channel),
  ).toStrictEqual(['production', 'pr', 'local']);
});

test('production release labels show only version number', () => {
  expect(
    versionLabel(manifest({ version: '1.2.3', buildId: 'abcdef123456' })),
  ).toBe('1.2.3');
});

test('PR labels show only branch and latest commit details', () => {
  const pullRequest = manifest({
    channel: 'pr',
    version: '1.2.3-pr.42',
    buildId: 'build-identifier',
    prNumber: 42,
    gitBranch: 'feature/compact-pr-labels',
    gitSha: 'abcdef123456',
    gitCommitTitle: 'Simplify override selection',
  });

  expect(versionLabel(pullRequest)).toBe(
    'feature/compact-pr-labels · abcdef1 · Simplify override selection',
  );
  expect(artifactSourceDescription(pullRequest)).toBe(
    'feature/compact-pr-labels · abcdef1 · Simplify override selection',
  );
});

test('main-page rows omit source details without an override', () => {
  expect(artifactSourceDescription(undefined)).toBe('');
});

test('disabled override selections retain their description', () => {
  const pullRequest = manifest({
    channel: 'pr',
    gitBranch: 'feature/remember-disabled',
    gitSha: '1234567890',
    gitCommitTitle: 'Remember disabled override',
  });
  expect(artifactSourceDescription(pullRequest)).toBe(
    'feature/remember-disabled · 1234567 · Remember disabled override',
  );
});

function manifest(
  overrides: Partial<AtlasExtensionManifest>,
): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'orders',
    name: 'Orders',
    version: '1.0.0',
    buildId: 'build',
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: 'https://cdn.example/remoteEntry.json',
    ...overrides,
  };
}
