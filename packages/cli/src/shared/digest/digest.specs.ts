import { faker } from '@faker-js/faker';
import { DigestDriver } from './digest.driver.js';

describe('digest', () => {
  let driver: DigestDriver;

  beforeEach(() => {
    driver = new DigestDriver();
  });

  it('should return hex sha256 with prefix when bytes are digested', () => {
    driver.given.bytes('abc');

    expect(driver.get.digest()).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('should return base64 integrity when bytes are digested', () => {
    driver.given.bytes('abc');

    expect(driver.get.integrity()).toBe(
      'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=',
    );
  });

  it('should convert hex digest to integrity when digest is given', () => {
    driver.given.bytes(faker.lorem.sentence());

    expect(driver.get.integrityFromDigest(driver.get.digest())).toBe(
      driver.get.integrity(),
    );
  });
});
