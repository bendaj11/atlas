import { faker } from '@faker-js/faker';

export function aSha256Digest(): `sha256:${string}` {
  return `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase()}`;
}

export function aRegistryUrl(): string {
  return `https://${faker.internet.domainName()}/${faker.lorem.slug()}`;
}

export function aReleaseVersion(): string {
  return faker.system.semver();
}

export function aRelativePath(extension: string): string {
  return `${faker.lorem.slug()}.${extension}`;
}
