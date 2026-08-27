import { beforeEach, expect, it } from '@jest/globals';
import { DevelopmentTargetDriver } from './target.driver.js';

let driver: DevelopmentTargetDriver;

beforeEach(() => {
  driver = new DevelopmentTargetDriver();
});

it('should append the route when one preview is a base URL', async () => {
  driver.given.oneRoute();

  await driver.when.resolve();

  expect(driver.get.result()).toMatchObject(driver.get.firstTarget());
});

it('should not request selection when one preview is configured', async () => {
  driver.given.oneRoute();

  await driver.when.resolve();

  expect(driver.get.previewQuestion()).toBeUndefined();
});

it('should reject when no previews are configured', async () => {
  await driver.when.resolve();

  expect(driver.get.errorMessage()).toBe(driver.get.missingPreviewsError());
});

it('should use selected preview when multiple previews are configured', async () => {
  driver.given.previews(true);

  await driver.when.resolve();

  expect(driver.get.result()).toMatchObject(driver.get.selectedPreviewTarget());
});

it('should request preview when multiple previews are configured', async () => {
  driver.given.previews(true);

  await driver.when.resolve();

  expect(driver.get.previewQuestion()).toBe(
    'select:Preview URL for local development',
  );
});

it('should reject when multiple previews are configured outside interactive mode', async () => {
  driver.given.previews(false);

  await driver.when.resolve();

  expect(driver.get.errorMessage()).toBe(driver.get.multiplePreviewsError());
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

it('should preserve the URL when a full preview URL is configured', async () => {
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

it('should use local preview without runtime discovery when developing host locally', async () => {
  driver.given.hostPreview('local');

  await driver.when.resolveHost();

  expect(driver.get.hostPreview()).toMatchObject({ previewKind: 'local' });
});

it('should use default local preview when host previews are empty', async () => {
  driver.given.hostPreview('default');

  await driver.when.resolveHost();

  expect(driver.get.hostPreview()).toMatchObject({
    hostUrl: driver.get.localPreviewUrl(),
    previewKind: 'local',
  });
});

it('should use deployed preview when runtime identifies local host', async () => {
  driver.given.hostPreview('deployed');

  await driver.when.resolveHost();

  expect(driver.get.hostPreview()).toMatchObject({ previewKind: 'deployed' });
});

it('should reject deployed preview when runtime identifies another host', async () => {
  driver.given.hostPreview('deployed', false);

  await driver.when.resolveHost();

  expect(driver.get.errorMessage()).toContain('but local host is');
});
