import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { ValidateIntegrityDriver } from './validate-integrity.driver.js';

describe('validateIntegrity', () => {
  let driver: ValidateIntegrityDriver;

  beforeEach(() => {
    driver = new ValidateIntegrityDriver();
  });

  describe('when bytes have a known digest', () => {
    const body = faker.lorem.sentence();
    const bytes = new TextEncoder().encode(body);
    const digest = createHash('sha256').update(body).digest('base64');

    it('should accept the bytes when the integrity matches', async () => {
      await driver.when.validated(bytes, `sha256-${digest}`);

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject the bytes when the integrity differs', async () => {
      const other = createHash('sha256')
        .update(faker.string.uuid())
        .digest('base64');
      await driver.when.validated(bytes, `sha256-${other}`);

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Selected host remote entry integrity sha256-${digest} does not match manifest integrity sha256-${other}.`,
      });
    });

    it('should reject the integrity when it is not a SHA-256 value', async () => {
      await driver.when.validated(bytes, `sha384-${digest}`);

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Host integrity "sha384-${digest}" must be a SHA-256 SRI value starting with "sha256-".`,
      });
    });
  });
});
