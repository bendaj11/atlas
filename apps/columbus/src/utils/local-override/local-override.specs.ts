/** @jest-environment node */

import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { validateLocalOverride } from './local-override';
import { LocalOverrideDriver } from './local-override.driver';

describe('validateLocalOverride', () => {
  let driver: LocalOverrideDriver;

  beforeEach(() => {
    driver = new LocalOverrideDriver();
  });

  it('should not fetch when the manifest is not local', async () => {
    await validateLocalOverride(anAppManifest({ channel: 'pr' }));

    expect(driver.get.fetch()).not.toHaveBeenCalled();
  });

  describe('when the manifest is local', () => {
    const manifest = anAppManifest({ channel: 'local' });

    it('should fetch the remote entry without cache when validated', async () => {
      driver.given.fetchResponse(
        Response.json({
          name: faker.word.noun(),
          exposes: [
            {
              key: manifest.exposes.entry,
              outFileName: faker.system.fileName(),
            },
          ],
        }),
      );

      await validateLocalOverride(manifest);

      expect(driver.get.fetch()).toHaveBeenCalledWith(manifest.remoteEntryUrl, {
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      });
    });

    it('should resolve when the remote entry exposes the entry module', async () => {
      driver.given.fetchResponse(
        Response.json({
          name: faker.word.noun(),
          exposes: [
            {
              key: manifest.exposes.entry,
              outFileName: faker.system.fileName(),
            },
          ],
        }),
      );

      await expect(validateLocalOverride(manifest)).resolves.toBeUndefined();
    });

    it('should reject when the remote entry lacks the entry module', async () => {
      driver.given.fetchResponse(
        Response.json({
          name: faker.word.noun(),
          exposes: [
            {
              key: `./${faker.word.noun()}`,
              outFileName: faker.system.fileName(),
            },
          ],
        }),
      );

      await expect(validateLocalOverride(manifest)).rejects.toThrow(
        `Local override remote entry does not expose ${manifest.exposes.entry}.`,
      );
    });

    it('should reject when the remote entry is not federation metadata', async () => {
      driver.given.fetchResponse(Response.json({ hello: faker.word.noun() }));

      await expect(validateLocalOverride(manifest)).rejects.toThrow(
        'Local override remote entry is not valid federation metadata.',
      );
    });

    it('should reject when the remote entry responds with an error status', async () => {
      driver.given.fetchResponse(new Response(null, { status: 404 }));

      await expect(validateLocalOverride(manifest)).rejects.toThrow(
        'Local override remote entry returned HTTP 404.',
      );
    });

    it('should reject when the remote entry is unreachable', async () => {
      driver.given.fetchFailure(new TypeError('Failed to fetch'));

      await expect(validateLocalOverride(manifest)).rejects.toThrow(
        'Local override remote entry is unreachable. Start its development server, then retry.',
      );
    });
  });
});
