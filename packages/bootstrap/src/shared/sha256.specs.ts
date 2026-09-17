import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { Sha256Driver } from './sha256.driver.js';

describe('sha256', () => {
  let driver: Sha256Driver;

  beforeEach(() => {
    driver = new Sha256Driver();
  });

  describe('when bytes are hashed', () => {
    const body = faker.lorem.paragraph();

    beforeEach(async () => {
      await driver.when.hashed(new TextEncoder().encode(body));
    });

    it('should encode the digest as lowercase hex when read as hex', () => {
      expect(driver.get.hex()).toBe(
        createHash('sha256').update(body).digest('hex'),
      );
    });

    it('should encode the digest as base64 when read as base64', () => {
      expect(driver.get.base64()).toBe(
        createHash('sha256').update(body).digest('base64'),
      );
    });
  });
});
