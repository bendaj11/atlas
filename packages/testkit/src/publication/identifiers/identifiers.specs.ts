import { faker } from '@faker-js/faker';
import { assertReleaseVersion } from '@atlas/schema';
import {
  aRegistryUrl,
  aRelativePath,
  aReleaseVersion,
  aSha256Digest,
} from './identifiers.js';

describe('aSha256Digest', () => {
  it('should build a lowercase hex SHA-256 digest when generated', () => {
    expect(aSha256Digest()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('aRegistryUrl', () => {
  it('should build an https url when generated', () => {
    expect(new URL(aRegistryUrl()).protocol).toBe('https:');
  });
});

describe('aReleaseVersion', () => {
  it('should build a valid release version when generated', () => {
    expect(() => assertReleaseVersion(aReleaseVersion())).not.toThrow();
  });
});

describe('aRelativePath', () => {
  it('should end with the given extension when an extension is given', () => {
    const extension = faker.system.fileExt();

    expect(aRelativePath(extension).endsWith(`.${extension}`)).toBe(true);
  });
});
