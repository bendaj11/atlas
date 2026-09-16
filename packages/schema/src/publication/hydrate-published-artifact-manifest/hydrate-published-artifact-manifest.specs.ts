import { faker } from '@faker-js/faker';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import {
  aSlotPlacement,
  anIdentifier,
} from '../../manifest/manifest.testkit.js';
import {
  aHostArtifactManifest,
  aPublishedWidget,
  aRemoteEntryFile,
  aStylesheetFile,
  anAppArtifactManifest,
} from '../publication.testkit.js';
import { HydratePublishedArtifactManifestDriver } from './hydrate-published-artifact-manifest.driver.js';

const ZERO_DIGEST = `sha256:${'00'.repeat(32)}` as const;
const ZERO_INTEGRITY = `sha256-${'A'.repeat(43)}=`;

describe('hydratePublishedArtifactManifest', () => {
  let driver: HydratePublishedArtifactManifestDriver;

  beforeEach(() => {
    driver = new HydratePublishedArtifactManifestDriver();
  });

  it('should throw the validation error when the value is not a published manifest', () => {
    expect(() =>
      driver.when.hydrated({ value: {}, manifestUrl: faker.internet.url() }),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        name: 'AtlasValidationError',
      }),
    );
  });

  describe('when a released app artifact is hydrated', () => {
    const root = 'https://registry.example/apps/orders/1.4.0/';
    const entry = aRemoteEntryFile({ digest: ZERO_DIGEST });
    const stylesheet = aStylesheetFile({ digest: ZERO_DIGEST });
    const artifact = anAppArtifactManifest({
      entryPath: entry.path,
      files: [entry, stylesheet],
      styles: [{ path: stylesheet.path, integrity: ZERO_INTEGRITY }],
      placements: [aSlotPlacement()],
      metadata: { domain: faker.commerce.department() },
      externalAppsDependencies: [anIdentifier()],
      source: { gitSha: faker.git.commitSha(), gitBranch: faker.git.branch() },
    });
    const widget = aPublishedWidget({
      ownerAppId: artifact.id,
      framework: artifact.framework,
    });

    beforeEach(() => {
      driver.when.hydrated({
        value: { ...artifact, exportedWidgets: [widget] },
        manifestUrl: `${root}manifest.json`,
      });
    });

    it('should copy identity, framework, exposes and app fields when a release is hydrated', () => {
      expect(driver.get.manifest()).toMatchObject({
        schemaVersion: '1',
        kind: 'app',
        id: artifact.id,
        name: artifact.name,
        framework: artifact.framework,
        exposes: artifact.exposes,
        isolation: artifact.isolation,
        requiredHostSdkVersion: artifact.requiredHostSdkVersion,
        supportedHosts: artifact.supportedHosts,
        placements: artifact.placements,
        metadata: artifact.metadata,
        externalAppsDependencies: artifact.externalAppsDependencies,
      });
    });

    it('should mark the build as production with the release version when a release is hydrated', () => {
      expect(driver.get.manifest()).toMatchObject({
        channel: 'production',
        version: artifact.release?.version,
        buildId: 'canonical',
        createdAt: '1970-01-01T00:00:00.000Z',
      });
    });

    it('should resolve the remote entry against the manifest directory when a release is hydrated', () => {
      expect(driver.get.manifest()).toMatchObject({
        remoteEntryUrl: `${root}${entry.path}`,
        integrity: ZERO_INTEGRITY,
      });
    });

    it('should resolve stylesheet hrefs against the manifest directory when a release is hydrated', () => {
      expect(driver.get.manifest().styles).toEqual([
        { href: `${root}${stylesheet.path}`, integrity: ZERO_INTEGRITY },
      ]);
    });

    it('should copy source git fields when a release is hydrated', () => {
      expect(driver.get.manifest()).toMatchObject({
        gitSha: artifact.source?.gitSha,
        gitBranch: artifact.source?.gitBranch,
      });
    });

    it('should point exported widgets at the resolved remote entry when a release is hydrated', () => {
      expect(
        (driver.get.manifest() as { exportedWidgets: unknown }).exportedWidgets,
      ).toEqual([{ ...widget, remoteEntryUrl: `${root}${entry.path}` }]);
    });
  });

  it('should omit optional app fields when the artifact omits them', () => {
    const { isolation: _isolation, ...artifact } = anAppArtifactManifest();
    driver.when.hydrated({
      value: artifact,
      manifestUrl: faker.internet.url(),
    });

    expect(Object.keys(driver.get.manifest())).toEqual([
      'schemaVersion',
      'id',
      'name',
      'version',
      'buildId',
      'channel',
      'framework',
      'remoteEntryUrl',
      'exposes',
      'integrity',
      'createdAt',
      'kind',
      'requiredHostSdkVersion',
      'supportedHosts',
      'placements',
    ]);
  });

  it('should use the pr channel, neutral version, commit build id and prNumber when a preview is hydrated', () => {
    const { release: _release, ...artifact } = anAppArtifactManifest();
    const preview = {
      number: faker.number.int({ min: 1, max: 999 }),
      gitSha: faker.git.commitSha(),
      gitCommitTitle: faker.git.commitMessage(),
    };
    driver.when.hydrated({
      value: { ...artifact, preview },
      manifestUrl: faker.internet.url(),
    });

    expect(driver.get.manifest()).toMatchObject({
      channel: 'pr',
      version: '0.0.0',
      buildId: preview.gitSha,
      prNumber: preview.number,
      gitSha: preview.gitSha,
      gitCommitTitle: preview.gitCommitTitle,
    });
  });

  it('should produce a host manifest with the loader range when a host artifact is hydrated', () => {
    const artifact = aHostArtifactManifest();
    driver.when.hydrated({
      value: artifact,
      manifestUrl: faker.internet.url(),
    });

    expect(driver.get.manifest()).toMatchObject({
      kind: 'host',
      id: artifact.id,
      requiredLoaderApiVersion: artifact.requiredLoaderApiVersion,
    });
  });
});
