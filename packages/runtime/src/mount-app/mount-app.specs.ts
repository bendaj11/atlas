/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement, aStylesheet } from '@atlas/testkit';
import { MountAppDriver } from './mount-app.driver.js';

describe('mountApp', () => {
  let driver: MountAppDriver;

  beforeEach(() => {
    driver = new MountAppDriver();
  });

  describe('when a production manifest with scoped isolation is mounted', () => {
    const manifest = anAppManifest({
      channel: 'production',
      isolation: 'scoped',
    });

    beforeEach(async () => {
      await driver.when.mounted(manifest);
    });

    it('should pass an Atlas-owned boundary tagged with the app id to the entry when mounted', () => {
      expect(driver.get.lastRequest().container.dataset.atlasApp).toBe(
        manifest.id,
      );
    });

    it('should append the boundary to the host container when mounted', () => {
      expect(driver.get.container().firstElementChild).toBe(
        driver.get.lastRequest().container,
      );
    });

    it('should pass the host sdk to the entry when mounted', () => {
      expect(driver.get.lastRequest().sdk).toBe(driver.sdk);
    });

    it('should provide the manifest and host id in the context when mounted', () => {
      expect(driver.get.lastRequest().context).toMatchObject({
        manifest,
        hostId: driver.sdk.hostId,
      });
    });

    it('should not expose a widgets property on the context when mounted', () => {
      expect('widgets' in driver.get.lastRequest().context).toBe(false);
    });

    it('should remove the boundary from the host container when unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.container().childElementCount).toBe(0);
    });

    it('should unmount the entry when unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.entryUnmountMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should scope the context path to the first route placement when the manifest declares routes', async () => {
    const path = `/${faker.word.noun()}`;
    await driver.when.mounted(
      anAppManifest({
        channel: 'production',
        placements: [aRoutePlacement({ route: { path } })],
      }),
    );

    expect(driver.get.lastRequest().context.path).toBe(path);
  });

  it('should mount the entry inside a shadow root when the manifest has no isolation', async () => {
    await driver.when.mounted(
      anAppManifest({ channel: 'production', isolation: undefined }),
    );

    expect(driver.get.lastRequest().container.getRootNode()).toBeInstanceOf(
      ShadowRoot,
    );
  });

  it('should pass the shadow root as style target when the manifest has no isolation', async () => {
    await driver.when.mounted(
      anAppManifest({ channel: 'production', isolation: undefined }),
    );

    expect(driver.get.lastRequest().styleTarget).toBe(
      driver.get.lastRequest().container.getRootNode(),
    );
  });

  describe('when a route title is given and the entry sets a tab title', () => {
    const hostTitle = faker.company.name();
    const appTitle = faker.commerce.productName();

    beforeEach(async () => {
      await driver.given
        .documentTitle(hostTitle)
        .given.routeTitle(faker.lorem.word())
        .given.entrySettingTabTitle(appTitle)
        .when.mounted(anAppManifest({ channel: 'production' }));
    });

    it('should set the document title to the app title when mounted', () => {
      expect(driver.get.documentTitle()).toBe(appTitle);
    });

    it('should restore the host document title when unmounted', async () => {
      await driver.when.unmounted();

      expect(driver.get.documentTitle()).toBe(hostTitle);
    });
  });

  describe('when a scoped production manifest declares one stylesheet', () => {
    const manifest = anAppManifest({
      channel: 'production',
      isolation: 'scoped',
      styles: [aStylesheet()],
    });

    it('should append the stylesheet to the document head before the entry mounts when the stylesheet loads', async () => {
      await driver.when.mounted(manifest);

      expect(driver.get.headLinks()).toHaveLength(1);
    });

    it('should release the stylesheet when unmounted', async () => {
      await driver.when.mounted(manifest);

      await driver.when.unmounted();

      expect(driver.get.headLinks()).toHaveLength(0);
    });

    it('should reject with ATLAS_STYLESHEET_LOAD_FAILED when the stylesheet fails to load', async () => {
      await driver.given.stylesheetOutcome('error').when.mounted(manifest);

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_STYLESHEET_LOAD_FAILED',
      });
    });

    it('should not import the remote when the stylesheet fails to load', async () => {
      await driver.given.stylesheetOutcome('error').when.mounted(manifest);

      expect(driver.get.importRemoteMock()).not.toHaveBeenCalled();
    });
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED before importing when a stylesheet uses an unsupported protocol', async () => {
    await driver.when.mounted(
      anAppManifest({
        channel: 'production',
        styles: [aStylesheet({ href: 'ftp://cdn.example/styles.css' })],
      }),
    );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
    });
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when a trust policy is given and the remote entry origin is not allowed', async () => {
    await driver.given
      .trustPolicy({
        allowedOrigins: new Set([new URL(faker.internet.url()).origin]),
      })
      .when.mounted(anAppManifest({ channel: 'production' }));

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
    });
  });

  it('should remove the boundary from the host container when the entry throws during mount', async () => {
    await driver.given
      .entryFailing(new Error('boom'))
      .when.mounted(anAppManifest({ channel: 'production' }));

    expect(driver.get.container().childElementCount).toBe(0);
  });

  it('should rethrow the entry error when the entry throws during mount', async () => {
    await driver.given
      .entryFailing(new Error('boom'))
      .when.mounted(anAppManifest({ channel: 'production' }));

    expect(driver.get.error()).toMatchObject({ message: 'boom' });
  });
});
