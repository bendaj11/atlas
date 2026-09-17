import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import { BootstrapErrorDriver } from './bootstrap-error.driver.js';
import type { BootstrapErrorCode } from './bootstrap-error-code.js';

const ALL_CODES: BootstrapErrorCode[] = [
  'DEPLOYMENT_INVALID',
  'CATALOG_INVALID',
  'HOST_MANIFEST_INVALID',
  'ARTIFACT_URL_REJECTED',
  'ARTIFACT_VERIFICATION_FAILED',
  'OVERRIDE_INVALID',
  'RESOURCE_UNAVAILABLE',
  'HOST_REMOTE_INVALID',
  'MODULE_LOADER_UNAVAILABLE',
  'HOST_MOUNT_FAILED',
  'BOOTSTRAP_TEMPLATE_INVALID',
];

describe('bootstrapError', () => {
  let driver: BootstrapErrorDriver;

  beforeEach(() => {
    driver = new BootstrapErrorDriver();
  });

  it('should return an Atlas error when created', () => {
    driver.when.created({
      code: faker.helpers.arrayElement(ALL_CODES),
      message: faker.lorem.sentence(),
    });

    expect(driver.get.error()).toBeInstanceOf(AtlasError);
  });

  it('should carry the code and message as summary when created', () => {
    const code = faker.helpers.arrayElement(ALL_CODES);
    const message = faker.lorem.sentence();
    driver.when.created({ code, message });

    expect(driver.get.error()).toMatchObject({ code, summary: message });
  });

  it('should preserve the cause when created with one', () => {
    const cause = new Error(faker.lorem.sentence());
    driver.when.created({
      code: faker.helpers.arrayElement(ALL_CODES),
      message: faker.lorem.sentence(),
      cause,
    });

    expect(driver.get.error().cause).toBe(cause);
  });

  it.each(ALL_CODES)(
    'should attach at least one suggested action when the code is %s',
    (code) => {
      driver.when.created({ code, message: faker.lorem.sentence() });

      expect(driver.get.error().suggestedActions.length).toBeGreaterThan(0);
    },
  );
});
