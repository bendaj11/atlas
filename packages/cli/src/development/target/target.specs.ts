import { beforeEach, expect, it } from '@jest/globals';
import { DevelopmentTargetDriver } from './target.driver.js';

let driver: DevelopmentTargetDriver;

beforeEach(() => {
  driver = new DevelopmentTargetDriver();
});

it('should append the route when the host URL is a base URL', async () => {
  driver.given.oneRoute();

  await driver.when.resolve();

  expect(driver.get.result()).toMatchObject(driver.get.firstTarget());
});

it('should reject when a host URL is missing in non-interactive mode', async () => {
  driver.given.missingUrl(false);

  await driver.when.resolve();

  expect(driver.get.errorMessage()).toBe(driver.get.missingUrlError());
});

it('should use the selected route when multiple routes are configured', async () => {
  driver.given.multipleRoutes(true);

  await driver.when.resolve();

  expect(driver.get.result()).toMatchObject(driver.get.secondTarget());
});

it('should request a route when multiple routes are configured', async () => {
  driver.given.multipleRoutes(true);

  await driver.when.resolve();

  expect(driver.get.routeQuestion()).toBe(
    'select:Route opened for local development',
  );
});

it('should preserve the URL when a full host URL is configured', async () => {
  driver.given.fullUrl();

  await driver.when.resolve();

  expect(driver.get.result()).toMatchObject(driver.get.fullTarget());
});

it('should accept the host when runtime discovery returns a configured host', async () => {
  driver.given.discoverableHost(true);

  await driver.when.resolve();

  expect(driver.get.result()?.hostId).toBe(driver.get.discoveredHostId());
});

it('should reject the host when runtime discovery returns an unsupported host', async () => {
  driver.given.discoverableHost(false);

  await driver.when.resolve();

  expect(driver.get.errorMessage()).toContain(
    driver.get.unsupportedHostError(),
  );
});

it('should persist the host URL when the prompted target is accepted', async () => {
  await driver.given.promptedTargetToSave();

  await driver.when.save();

  expect(await driver.get.savedHostUrl()).toBe(driver.get.savedEnv());
});
