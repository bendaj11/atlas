import { beforeEach, describe, expect, it } from '@jest/globals';
import { ManifestUtilsDriver } from './manifest-utils.driver.js';

describe('custom manifest draft', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should start with empty URL when custom override is new', () => {
    expect(driver.get.editorDraft().customUrl).toBe('');
  });

  it('should preserve URL when custom override already exists', () => {
    driver.given.selectedCustomUrl('https://custom.example/app');

    expect(driver.get.editorDraft().customUrl).toBe(
      'https://custom.example/app',
    );
  });
});

describe('custom manifest creation', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should use local assets when Angular URL is custom', () => {
    expect(driver.get.customManifest('http://localhost:4201/')).toMatchObject({
      channel: 'local',
      remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
      styles: [{ href: 'http://localhost:4201/styles.css' }],
      exportedWidgets: [
        { remoteEntryUrl: 'http://localhost:4201/remoteEntry.json' },
      ],
    });
  });

  it('should remove production integrity when URL is custom', () => {
    expect(
      driver.get.customManifest('http://localhost:4201/').integrity,
    ).toBeUndefined();
  });

  it('should omit production styles when React URL is custom', () => {
    driver.given.productionFramework('react');

    expect(
      driver.get.customManifest('http://localhost:4201').styles,
    ).toStrictEqual([]);
  });

  it.each([
    'ftp://localhost/app',
    'http://user:secret@localhost/app',
    'http://localhost/app?debug=true',
    'http://localhost/app#debug',
  ])('should reject URL when base URL is unsafe: %s', (url) => {
    expect(() => driver.get.customManifest(url)).toThrow();
  });

  it.each([
    'http://127.0.0.1:4201/remoteEntry.json',
    'https://cdn.example/app/remoteEntry.json',
  ])('should preserve URL when remote entry URL is safe: %s', (url) => {
    expect(driver.get.customManifest(url).remoteEntryUrl).toBe(url);
  });
});

describe('manifest selection', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should report actionable error when PR selection is missing', () => {
    expect(() => driver.get.missingPrSelection()).toThrow(
      'Choose a PR version.',
    );
  });
});

describe('manifest labels', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should show version only when release is production', () => {
    expect(
      driver.get.versionLabel({ version: '1.2.3', buildId: 'abcdef123456' }),
    ).toBe('1.2.3');
  });

  it('should show branch and commit when release is PR', () => {
    expect(
      driver.get.versionLabel({
        channel: 'pr',
        version: '1.2.3-pr.42',
        buildId: 'build-identifier',
        prNumber: 42,
        gitBranch: 'feature/compact-pr-labels',
        gitSha: 'abcdef123456',
        gitCommitTitle: 'Simplify override selection',
      }),
    ).toBe('feature/compact-pr-labels · abcdef1 · Simplify override selection');
  });

  it('should omit source description when override is absent', () => {
    expect(driver.get.sourceDescription(undefined)).toBe('');
  });

  it('should retain source description when override is disabled', () => {
    expect(
      driver.get.sourceDescription({
        channel: 'pr',
        gitBranch: 'feature/remember-disabled',
        gitSha: '1234567890',
        gitCommitTitle: 'Remember disabled override',
      }),
    ).toBe('feature/remember-disabled · 1234567 · Remember disabled override');
  });
});
