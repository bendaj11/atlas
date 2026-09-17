import { faker } from '@faker-js/faker';
import { ATLAS_FRAMEWORKS } from '../../manifest/atlas-framework.js';
import { ATLAS_VERSION_CHANNELS } from '../../manifest/atlas-version-channel.js';
import {
  aSha256Integrity,
  aStylesheet,
} from '../../manifest/manifest.testkit.js';
import { aHostManifest } from '../host-manifest.testkit.js';
import { ValidateAtlasHostManifestDriver } from './validate-atlas-host-manifest.driver.js';

const REQUIRED_STRING_FIELDS = [
  'name',
  'buildId',
  'createdAt',
  'version',
  'requiredLoaderApiVersion',
  'remoteEntryUrl',
] as const;

describe('validateAtlasHostManifest', () => {
  let driver: ValidateAtlasHostManifestDriver;

  beforeEach(() => {
    driver = new ValidateAtlasHostManifestDriver();
  });

  it('should report nothing when the host manifest is complete', () => {
    driver.when.validated(aHostManifest());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when integrity and styles are valid', () => {
    driver.when.validated(
      aHostManifest({ integrity: aSha256Integrity(), styles: [aStylesheet()] }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report every required field once when the value is not an object', () => {
    driver.when.validated(faker.lorem.word());

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'kind',
      'id',
      'name',
      'buildId',
      'createdAt',
      'channel',
      'framework',
      'version',
      'requiredLoaderApiVersion',
      'remoteEntryUrl',
      'exposes',
    ]);
  });

  it('should report schemaVersion when it is not "1"', () => {
    driver.when.validated({ ...aHostManifest(), schemaVersion: '2' });

    expect(driver.get.issues()).toEqual([
      { path: 'schemaVersion', message: 'Expected schemaVersion to be "1".' },
    ]);
  });

  it('should report kind when it is not host', () => {
    driver.when.validated({ ...aHostManifest(), kind: 'app' });

    expect(driver.get.issues()).toEqual([
      { path: 'kind', message: 'Expected kind to be "host".' },
    ]);
  });

  it('should report id when it contains traversal', () => {
    driver.when.validated(aHostManifest({ id: '../host' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'id',
        message:
          'Expected host id to contain only letters, numbers, dots, dashes, and underscores, without traversal.',
      },
    ]);
  });

  it.each(REQUIRED_STRING_FIELDS)(
    'should report %s when it is empty',
    (field) => {
      driver.when.validated(aHostManifest({ [field]: '' }));

      expect(driver.get.issues()).toEqual([
        { path: field, message: `Expected ${field} to be a non-empty string.` },
      ]);
    },
  );

  it.each(ATLAS_VERSION_CHANNELS)(
    'should report nothing when channel is %s',
    (channel) => {
      driver.when.validated(aHostManifest({ channel }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report channel when it is unknown', () => {
    driver.when.validated({ ...aHostManifest(), channel: faker.lorem.word() });

    expect(driver.get.issues()).toEqual([
      {
        path: 'channel',
        message: 'Expected channel to be production, pr, or local.',
      },
    ]);
  });

  it.each(ATLAS_FRAMEWORKS)(
    'should report nothing when framework is %s',
    (framework) => {
      driver.when.validated(aHostManifest({ framework }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report framework when it is unknown', () => {
    driver.when.validated({ ...aHostManifest(), framework: 'svelte' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'framework',
        message: 'Expected framework to be angular, react, or vue.',
      },
    ]);
  });

  it('should report version when it is not semantic', () => {
    driver.when.validated(aHostManifest({ version: 'latest' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'version',
        message: 'Expected a semantic version such as 1.2.3.',
      },
    ]);
  });

  it('should report requiredLoaderApiVersion when it is not a range', () => {
    driver.when.validated(aHostManifest({ requiredLoaderApiVersion: 'next' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'requiredLoaderApiVersion',
        message: 'Expected a semantic version range such as ^1.2.3.',
      },
    ]);
  });

  it('should report remoteEntryUrl when it is not HTTP(S)', () => {
    driver.when.validated(
      aHostManifest({ remoteEntryUrl: 'ftp://cdn/host.js' }),
    );

    expect(driver.get.issues()).toEqual([
      { path: 'remoteEntryUrl', message: 'Expected an absolute HTTP(S) URL.' },
    ]);
  });

  it('should report integrity when it is not SRI', () => {
    driver.when.validated(aHostManifest({ integrity: 'md5-invalid' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'integrity',
        message: 'Expected SHA-256 integrity in SRI format.',
      },
    ]);
  });

  it('should report gitSha when it exceeds 255 characters', () => {
    driver.when.validated(aHostManifest({ gitSha: 'a'.repeat(256) }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'gitSha',
        message: 'Expected a non-empty string no longer than 255 characters.',
      },
    ]);
  });

  it('should report styles when it is not an array', () => {
    driver.when.validated({ ...aHostManifest(), styles: {} });

    expect(driver.get.issues()).toEqual([
      { path: 'styles', message: 'Expected styles to be an array.' },
    ]);
  });

  it('should report exposes when it is not an object', () => {
    driver.when.validated({ ...aHostManifest(), exposes: 'entry' });

    expect(driver.get.issues()).toEqual([
      { path: 'exposes', message: 'Expected exposes to be an object.' },
    ]);
  });

  it('should report the entry when exposes lacks one', () => {
    driver.when.validated({ ...aHostManifest(), exposes: {} });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exposes.entry',
        message: 'Expected entry to be a non-empty string.',
      },
    ]);
  });
});
