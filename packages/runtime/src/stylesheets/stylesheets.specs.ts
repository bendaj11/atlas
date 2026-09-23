/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, aStylesheet } from '@atlas/testkit';
import { StylesheetsDriver } from './stylesheets.driver.js';

describe('loadManifestStyles', () => {
  let driver: StylesheetsDriver;

  beforeEach(() => {
    driver = new StylesheetsDriver();
  });

  it('should append no link when the manifest declares no styles', async () => {
    await driver.when.loaded(
      anAppManifest({ channel: 'production', styles: [] }),
    );

    expect(driver.get.headLinks()).toHaveLength(0);
  });

  describe('when a production manifest declares one stylesheet that loads', () => {
    const stylesheet = aStylesheet();
    const manifest = anAppManifest({
      channel: 'production',
      styles: [stylesheet],
    });

    beforeEach(async () => {
      await driver.when.loaded(manifest);
    });

    it('should append the stylesheet link to the document head when loaded', () => {
      expect(
        driver.get.headLinks().map((link) => link.getAttribute('href')),
      ).toEqual([stylesheet.href]);
    });

    it('should tag the link with the app id when loaded', () => {
      expect(driver.get.headLinks()[0]?.dataset.atlasStyle).toBe(manifest.id);
    });

    it('should remove the link when the only load is released', () => {
      driver.when.released(0);

      expect(driver.get.headLinks()).toHaveLength(0);
    });

    describe('when the same manifest is loaded a second time', () => {
      beforeEach(async () => {
        await driver.when.loaded(manifest);
      });

      it('should keep one link when loaded twice', () => {
        expect(driver.get.headLinks()).toHaveLength(1);
      });

      it('should keep the link when only the first load is released', () => {
        driver.when.released(0);

        expect(driver.get.headLinks()).toHaveLength(1);
      });

      it('should remove the link when both loads are released', () => {
        driver.when.released(0);
        driver.when.released(1);

        expect(driver.get.headLinks()).toHaveLength(0);
      });
    });
  });

  it('should set crossOrigin anonymous when the stylesheet declares an integrity', async () => {
    await driver.when.loaded(
      anAppManifest({
        channel: 'production',
        styles: [
          aStylesheet({
            integrity: `sha256-${faker.string.alphanumeric(43)}=`,
          }),
        ],
      }),
    );

    expect(driver.get.headLinks()[0]?.crossOrigin).toBe('anonymous');
  });

  it('should append the link to the target when a shadow root target is given', async () => {
    await driver.given
      .shadowRootTarget()
      .when.loaded(
        anAppManifest({ channel: 'production', styles: [aStylesheet()] }),
      );

    expect(driver.get.targetLinks()).toHaveLength(1);
  });

  it('should reject with ATLAS_STYLESHEET_LOAD_FAILED when the stylesheet fails to load', async () => {
    await driver.given
      .stylesheetOutcome('error')
      .when.loaded(
        anAppManifest({ channel: 'production', styles: [aStylesheet()] }),
      );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_STYLESHEET_LOAD_FAILED',
    });
  });

  it('should remove the link when the stylesheet fails to load', async () => {
    await driver.given
      .stylesheetOutcome('error')
      .when.loaded(
        anAppManifest({ channel: 'production', styles: [aStylesheet()] }),
      );

    expect(driver.get.headLinks()).toHaveLength(0);
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when the stylesheet protocol is unsupported', async () => {
    await driver.when.loaded(
      anAppManifest({
        channel: 'production',
        styles: [aStylesheet({ href: 'ftp://cdn.example/styles.css' })],
      }),
    );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
    });
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when the policy does not allow the stylesheet origin', async () => {
    await driver.given
      .policy({
        allowedOrigins: new Set([new URL(faker.internet.url()).origin]),
      })
      .when.loaded(
        anAppManifest({ channel: 'production', styles: [aStylesheet()] }),
      );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
    });
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when the legacy policy argument does not allow the stylesheet origin', async () => {
    await driver.given
      .policy({
        allowedOrigins: new Set([new URL(faker.internet.url()).origin]),
      })
      .when.loadedWithLegacyPolicyArgument(
        anAppManifest({ channel: 'production', styles: [aStylesheet()] }),
      );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
    });
  });
});
