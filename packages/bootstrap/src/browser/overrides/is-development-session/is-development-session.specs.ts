import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostManifest } from '@atlas/testkit';
import { isDevelopmentSession } from './is-development-session.js';

describe('isDevelopmentSession', () => {
  it('should accept a session with every optional field', () => {
    expect(
      isDevelopmentSession({
        hostId: faker.string.uuid(),
        overrides: [],
        hostOverride: aHostManifest(),
        catalog: aHostCatalog(),
        offerIds: {},
      }),
    ).toBe(true);
  });

  it('should accept an empty session object', () => {
    expect(isDevelopmentSession({})).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'session'],
    ['an array', []],
    ['a numeric host id', { hostId: 1 }],
    ['overrides that are not a list', { overrides: {} }],
    ['a host override that is not an object', { hostOverride: 'host' }],
    ['a catalog that is not an object', { catalog: [] }],
    ['offer ids that are not a record of strings', { offerIds: { app: 1 } }],
  ])('should reject %s', (_description, value) => {
    expect(isDevelopmentSession(value)).toBe(false);
  });
});
