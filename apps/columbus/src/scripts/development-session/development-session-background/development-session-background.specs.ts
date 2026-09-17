import { faker } from '@faker-js/faker';
import { loadDevelopmentSession } from './development-session-background';
import { DevelopmentSessionBackgroundDriver } from './development-session-background.driver';

describe('loadDevelopmentSession', () => {
  let driver: DevelopmentSessionBackgroundDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionBackgroundDriver();
  });

  it('should request the session from the default control port when none is given', async () => {
    const hostId = faker.string.uuid();
    const previewUrl = faker.internet.url({ appendSlash: true });

    driver.given.session({ schemaVersion: '1', hostId, overrides: [] });

    await loadDevelopmentSession(
      { hostId, previewUrl },
      { fetchJson: driver.get.fetchJson() },
    );

    expect(driver.get.fetchJson()).toHaveBeenCalledWith(
      `http://localhost:4400/atlas.dev-session.json?hostId=${hostId}&previewUrl=${encodeURIComponent(previewUrl)}`,
    );
  });

  it('should request the session from the given control port when one is given', async () => {
    const hostId = faker.string.uuid();
    const previewUrl = faker.internet.url({ appendSlash: true });
    const controlPort = faker.internet.port();

    driver.given.session({ schemaVersion: '1', hostId, overrides: [] });

    await loadDevelopmentSession(
      { hostId, previewUrl, controlPort },
      { fetchJson: driver.get.fetchJson() },
    );

    expect(driver.get.fetchJson()).toHaveBeenCalledWith(
      `http://localhost:${controlPort}/atlas.dev-session.json?hostId=${hostId}&previewUrl=${encodeURIComponent(previewUrl)}`,
    );
  });

  it('should return the session when it matches the host', async () => {
    const hostId = faker.string.uuid();
    const session = { schemaVersion: '1', hostId, overrides: [] };

    driver.given.session(session);

    await expect(
      loadDevelopmentSession(
        { hostId, previewUrl: faker.internet.url() },
        { fetchJson: driver.get.fetchJson() },
      ),
    ).resolves.toBe(session);
  });

  it('should reject when the session belongs to another host', async () => {
    driver.given.session({
      schemaVersion: '1',
      hostId: faker.string.uuid(),
      overrides: [],
    });

    await expect(
      loadDevelopmentSession(
        { hostId: faker.string.uuid(), previewUrl: faker.internet.url() },
        { fetchJson: driver.get.fetchJson() },
      ),
    ).rejects.toThrow('Atlas development session is invalid.');
  });

  it('should reject when the session has no overrides list', async () => {
    const hostId = faker.string.uuid();

    driver.given.session({ schemaVersion: '1', hostId });

    await expect(
      loadDevelopmentSession(
        { hostId, previewUrl: faker.internet.url() },
        { fetchJson: driver.get.fetchJson() },
      ),
    ).rejects.toThrow('Atlas development session is invalid.');
  });

  it.each(['ftp://localhost/app', 'http://user:pw@localhost/app'])(
    'should reject when the preview url is %s',
    async (previewUrl) => {
      await expect(
        loadDevelopmentSession(
          { hostId: faker.string.uuid(), previewUrl },
          { fetchJson: driver.get.fetchJson() },
        ),
      ).rejects.toThrow('Atlas preview URL is invalid.');
    },
  );

  it.each([0, 70000, 1.5])(
    'should reject when the control port is %s',
    async (controlPort) => {
      await expect(
        loadDevelopmentSession(
          {
            hostId: faker.string.uuid(),
            previewUrl: faker.internet.url(),
            controlPort,
          },
          { fetchJson: driver.get.fetchJson() },
        ),
      ).rejects.toThrow('Atlas development control port is invalid.');
    },
  );
});
