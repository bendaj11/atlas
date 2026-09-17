import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { aManifestDescriptor, aSha256Digest } from '@atlas/testkit';
import { AssertBytesMatchDescriptorDriver } from './assert-bytes-match-descriptor.driver.js';

describe('assertBytesMatchDescriptor', () => {
  let driver: AssertBytesMatchDescriptorDriver;

  beforeEach(() => {
    driver = new AssertBytesMatchDescriptorDriver();
  });

  describe('when bytes have a known size and digest', () => {
    const body = faker.lorem.sentence();
    const bytes = new TextEncoder().encode(body);
    const digest =
      `sha256:${createHash('sha256').update(body).digest('hex')}` as const;

    it('should accept the bytes when size and digest match the descriptor', async () => {
      await driver.when.asserted(
        bytes,
        aManifestDescriptor({ size: bytes.byteLength, digest }),
      );

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject the bytes when the size differs from the descriptor', async () => {
      const descriptor = aManifestDescriptor({
        size: bytes.byteLength + 1,
        digest,
      });
      await driver.when.asserted(bytes, descriptor);

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Artifact manifest "${descriptor.path}" is ${bytes.byteLength} bytes but its descriptor records ${descriptor.size} bytes.`,
      });
    });

    it('should reject the bytes when the digest differs from the descriptor', async () => {
      const descriptor = aManifestDescriptor({
        size: bytes.byteLength,
        digest: aSha256Digest(),
      });
      await driver.when.asserted(bytes, descriptor);

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Artifact manifest "${descriptor.path}" digest ${digest} does not match its descriptor digest ${descriptor.digest}.`,
      });
    });
  });
});
