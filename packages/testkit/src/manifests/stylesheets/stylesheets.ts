import { faker } from '@faker-js/faker';
import type { AtlasStylesheet } from '@atlas/schema';

export function aSha256Integrity(): string {
  return `sha256-${faker.string.alphanumeric(43)}=`;
}

export function aStylesheet(
  overrides: Partial<AtlasStylesheet> = {},
): AtlasStylesheet {
  return {
    href: faker.internet.url(),
    integrity: aSha256Integrity(),
    ...overrides,
  };
}
