import { faker } from '@faker-js/faker';
import { DEFAULT_CONTROL_PORT } from '../constants.js';
import { DevelopmentProcessDriver } from './process.driver.js';

const BROWSER_OPEN_WARNING =
  'Could not open browser automatically. Use App preview link.';

describe('development process', () => {
  let driver: DevelopmentProcessDriver;

  beforeEach(() => {
    driver = new DevelopmentProcessDriver();
  });

  describe('isRemoteEntryReady', () => {
    it('should return false when response contains HTML', async () => {
      const response = new Response('<!DOCTYPE html>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      });

      expect(await driver.get.remoteEntryReadiness(response)).toBe(false);
    });

    it('should return false when response is unsuccessful', async () => {
      const response = new Response(faker.lorem.sentence(), {
        headers: { 'content-type': 'application/json' },
        status: 404,
      });

      expect(await driver.get.remoteEntryReadiness(response)).toBe(false);
    });

    it('should return false when JSON body is not federation metadata', async () => {
      const response = Response.json({ name: faker.word.noun() });

      expect(await driver.get.remoteEntryReadiness(response)).toBe(false);
    });

    it('should return true when response contains federation metadata', async () => {
      const response = Response.json({ exposes: [], name: faker.word.noun() });

      expect(await driver.get.remoteEntryReadiness(response)).toBe(true);
    });
  });

  describe('buildBrowserOpenCommand', () => {
    it('should select open command when platform is macOS', () => {
      const url = faker.internet.url();

      expect(driver.get.browserOpenCommand(url, 'darwin')).toStrictEqual({
        args: [url],
        command: 'open',
      });
    });

    it('should select xdg-open command when platform is Linux', () => {
      const url = faker.internet.url();

      expect(driver.get.browserOpenCommand(url, 'linux')).toStrictEqual({
        args: [url],
        command: 'xdg-open',
      });
    });

    it('should select start command when platform is Windows', () => {
      const url = faker.internet.url();

      expect(driver.get.browserOpenCommand(url, 'win32')).toStrictEqual({
        args: ['/c', 'start', '', url],
        command: 'cmd',
      });
    });
  });

  describe('buildFrameworkServerArguments', () => {
    it('should include localhost when React server arguments are resolved', () => {
      const port = faker.internet.port();

      expect(driver.get.frameworkServerArguments('react', port)).toStrictEqual([
        '--port',
        String(port),
        '--host',
        'localhost',
      ]);
    });

    it('should omit host when Angular server arguments are resolved', () => {
      const port = faker.internet.port();

      expect(
        driver.get.frameworkServerArguments('angular', port),
      ).toStrictEqual(['--port', String(port)]);
    });
  });

  describe('formatFrameworkServerError', () => {
    it('should include captured output when output is present', () => {
      const message = faker.lorem.sentence();
      const output = faker.lorem.lines(2);

      expect(driver.get.frameworkServerError(message, output)).toBe(
        `${message}\n\nFramework server output:\n${output}`,
      );
    });

    it('should keep message alone when output is blank', () => {
      const message = faker.lorem.sentence();

      expect(driver.get.frameworkServerError(message, '  \n')).toBe(message);
    });
  });

  describe('developmentPreviewUrl', () => {
    it('should keep host URL clean when default control port is used', () => {
      const hostUrl = faker.internet.url({ appendSlash: true });

      expect(driver.get.previewUrl(hostUrl, DEFAULT_CONTROL_PORT)).toBe(
        hostUrl,
      );
    });

    it('should include atlas-dev-port when non-default control port is used', () => {
      const hostUrl = faker.internet.url({ appendSlash: true });
      const controlPort = DEFAULT_CONTROL_PORT + 1;

      expect(driver.get.previewUrl(hostUrl, controlPort)).toBe(
        `${hostUrl}?atlas-dev-port=${controlPort}`,
      );
    });
  });

  describe('waitForRemoteEntry', () => {
    it('should resolve when remote entry serves federation metadata', async () => {
      driver.given.remoteEntryResponse(
        Response.json({ exposes: [], name: faker.word.noun() }),
      );

      await expect(driver.when.remoteEntryAwaited()).resolves.toBeUndefined();
    });

    it('should fetch remote entry without caching when polled', async () => {
      driver.given.remoteEntryResponse(
        Response.json({ exposes: [], name: faker.word.noun() }),
      );

      await driver.when.remoteEntryAwaited();

      expect(driver.get.fetchMock()).toHaveBeenCalledWith(
        driver.get.remoteEntryUrl(),
        { cache: 'no-store' },
      );
    });

    it('should reject when framework server exits before remote entry is served', async () => {
      driver.given.childExitCode(1);

      await expect(driver.when.remoteEntryAwaited()).rejects.toThrow(
        /exited before .* became available/,
      );
    });

    it('should reject with a timeout error when remote entry never becomes available', async () => {
      driver.given.remoteEntryUnreachable();

      await expect(
        driver.when.remoteEntryAwaitedUntilTimeout(),
      ).rejects.toMatchObject({ code: 'ATLAS_DEV_SERVER_TIMEOUT' });
    });
  });

  describe('waitForShutdown', () => {
    beforeEach(() => {
      driver.when.shutdownAwaited();
    });

    it('should resolve when framework server exits with code 0', async () => {
      await expect(driver.when.childExited(0, null)).resolves.toBeUndefined();
    });

    it('should close control server when framework server exits', async () => {
      await driver.when.childExited(0, null);

      expect(driver.get.controlCloseMock()).toHaveBeenCalledTimes(1);
    });

    it('should reject with exit code when framework server exits with failure', async () => {
      await expect(driver.when.childExited(2, null)).rejects.toThrow(
        'Framework dev server exited with code 2.',
      );
    });

    it('should reject when framework server emits an error', async () => {
      const message = faker.lorem.sentence();

      await expect(driver.when.childFailed(new Error(message))).rejects.toThrow(
        message,
      );
    });

    it('should terminate framework server when SIGINT is received', async () => {
      await driver.when.interrupted();

      expect(driver.get.killMock()).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('waitForShutdown when control server fails to close', () => {
    it('should reject with the close error when framework server exits', async () => {
      const message = faker.lorem.sentence();
      driver.given
        .controlCloseFailure(new Error(message))
        .when.shutdownAwaited();

      await expect(driver.when.childExited(0, null)).rejects.toThrow(message);
    });
  });

  describe('logHostViewUrl', () => {
    it('should warn when no preview URL is resolved', () => {
      driver.when.hostViewLogged(undefined);

      expect(driver.get.warningMock()).toHaveBeenCalledWith(
        'App preview unresolved. Define atlas.previews in package.json.',
      );
    });

    it('should link preview URL to itself when no browser URL is given', () => {
      const url = faker.internet.url();

      driver.when.hostViewLogged(url);

      expect(driver.get.linkedResultMock()).toHaveBeenCalledWith(
        'App preview',
        url,
        url,
      );
    });

    it('should link preview URL to browser URL when browser URL is given', () => {
      const url = faker.internet.url();
      const browserUrl = faker.internet.url();

      driver.when.hostViewLogged(url, browserUrl);

      expect(driver.get.linkedResultMock()).toHaveBeenCalledWith(
        'App preview',
        url,
        browserUrl,
      );
    });
  });

  describe('openBrowserWhenReady', () => {
    it('should not spawn when no URL is given', () => {
      driver.when.browserOpened(undefined);

      expect(driver.get.spawnMock()).not.toHaveBeenCalled();
    });

    it('should not spawn when --no-open is set', () => {
      driver.given
        .flags(['--no-open'])
        .when.browserOpened(faker.internet.url());

      expect(driver.get.spawnMock()).not.toHaveBeenCalled();
    });

    it('should spawn a detached browser process when URL is given', () => {
      const url = faker.internet.url();

      driver.when.browserOpened(url);

      expect(driver.get.spawnMock()).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([url]),
        { detached: true, stdio: 'ignore' },
      );
    });

    it('should unref the browser process when spawned', () => {
      driver.when.browserOpened(faker.internet.url());

      expect(driver.get.unrefMock()).toHaveBeenCalledTimes(1);
    });

    it('should warn when the browser process emits an error', () => {
      driver.when.browserOpenFailed();

      expect(driver.get.warningMock()).toHaveBeenCalledWith(
        BROWSER_OPEN_WARNING,
      );
    });

    it('should warn when spawning the browser throws', () => {
      driver.given
        .spawnFailure(new Error('EACCES'))
        .when.browserOpened(faker.internet.url());

      expect(driver.get.warningMock()).toHaveBeenCalledWith(
        BROWSER_OPEN_WARNING,
      );
    });
  });
});
