import { faker } from '@faker-js/faker';
import { SessionRunnerDriver } from './session-runner.driver.js';

describe('runDevSession', () => {
  let driver: SessionRunnerDriver;

  beforeEach(async () => {
    driver = new SessionRunnerDriver();

    await driver.given.project();
  });

  describe('when the framework server serves the remote entry', () => {
    beforeEach(async () => {
      await driver.when.run();
    });

    it('should start the control server on the default port when no flag is given', () => {
      expect(driver.get.startControlServerMock()).toHaveBeenCalledWith(
        expect.objectContaining({ port: 4400, environment: 'production' }),
      );
    });

    it('should spawn the dev task with the framework port when workspace is standalone', () => {
      expect(driver.get.spawnMock()).toHaveBeenCalledWith(
        expect.anything(),
        'dev',
        ['--port', '4201'],
      );
    });

    it('should mark the control server ready when the remote entry is served', () => {
      expect(driver.get.controlMarkReadyMock()).toHaveBeenCalledTimes(1);
    });

    it('should open the browser at the preview launcher for the computed URL when ready', () => {
      expect(driver.get.openBrowserMock()).toHaveBeenCalledWith(
        expect.anything(),
        'http://localhost:4400/atlas.open?previewUrl=http%3A%2F%2Flocalhost%3A4400%2F',
      );
    });

    it('should wait for shutdown when ready', () => {
      expect(driver.get.waitForShutdownMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should spawn the serve task when workspace is nx', async () => {
    driver.given.workspaceKind('nx');

    await driver.when.run();

    expect(driver.get.spawnMock()).toHaveBeenCalledWith(
      expect.anything(),
      'serve',
      expect.anything(),
    );
  });

  it('should spawn framework:dev when the project declares that script', async () => {
    await driver.given.projectScripts({ 'framework:dev': 'vite' });

    await driver.when.run();

    expect(driver.get.spawnMock()).toHaveBeenCalledWith(
      expect.anything(),
      'framework:dev',
      expect.anything(),
    );
  });

  it('should honor --control-port when given', async () => {
    const port = faker.internet.port();
    driver.given.flags([`--control-port=${port}`]);

    await driver.when.run();

    expect(driver.get.startControlServerMock()).toHaveBeenCalledWith(
      expect.objectContaining({ port }),
    );
  });

  it('should close the bootstrap server when the session ends', async () => {
    driver.given.bootstrapServer();

    await driver.when.run();

    expect(driver.get.bootstrapCloseMock()).toHaveBeenCalledTimes(1);
  });

  describe('when the framework server never serves the remote entry', () => {
    const error = new Error(faker.lorem.sentence());

    beforeEach(async () => {
      driver.given.remoteEntryFailing(error);

      await driver.when.run().catch(() => undefined);
    });

    it('should kill the framework server when startup fails', () => {
      expect(driver.get.killMock()).toHaveBeenCalledWith('SIGTERM');
    });

    it('should close the control server when startup fails', () => {
      expect(driver.get.controlCloseMock()).toHaveBeenCalledTimes(1);
    });

    it('should not open the browser when startup fails', () => {
      expect(driver.get.openBrowserMock()).not.toHaveBeenCalled();
    });
  });

  it('should rethrow the startup error when the framework server never serves the remote entry', async () => {
    const error = new Error(faker.lorem.sentence());
    driver.given.remoteEntryFailing(error);

    await expect(driver.when.run()).rejects.toBe(error);
  });
});
