/** @jest-environment node */

import { faker } from '@faker-js/faker';
import {
  actionThemeMessage,
  loadDevelopmentSessionRequest,
  overrideCountMessage,
} from '../../utils/messages/messages';
import { BackgroundDriver } from './background.driver';

describe('background', () => {
  let driver: BackgroundDriver;

  beforeEach(() => {
    driver = new BackgroundDriver();
  });

  describe('when a tab changes', () => {
    it('should clear the host data cache of the tab when the tab starts loading', async () => {
      const tabId = faker.number.int();

      await driver.when.tabUpdated(tabId, { status: 'loading' });

      expect(driver.get.clearHostDataCache()).toHaveBeenCalledWith(tabId);
    });

    it('should keep the host data cache when the tab finishes loading', async () => {
      await driver.when.tabUpdated(faker.number.int(), { status: 'complete' });

      expect(driver.get.clearHostDataCache()).not.toHaveBeenCalled();
    });

    it('should clear the host data cache of the tab when the tab is removed', async () => {
      const tabId = faker.number.int();

      await driver.when.tabRemoved(tabId);

      expect(driver.get.clearHostDataCache()).toHaveBeenCalledWith(tabId);
    });
  });

  describe('when an action theme message arrives', () => {
    it('should set the bright icon when the color scheme is dark', async () => {
      await driver.when.messageReceived(actionThemeMessage('dark'));

      expect(driver.get.actionIconPaths()).toStrictEqual([
        {
          16: 'icons/columbus-bright-16.png',
          32: 'icons/columbus-bright-32.png',
        },
      ]);
    });

    it('should set the dark icon when the color scheme is light', async () => {
      await driver.when.messageReceived(actionThemeMessage('light'));

      expect(driver.get.actionIconPaths()).toStrictEqual([
        { 16: 'icons/columbus-dark-16.png', 32: 'icons/columbus-dark-32.png' },
      ]);
    });
  });

  it('should not touch the badge when an override count message arrives without a sender tab', async () => {
    await driver.when.messageReceived(
      overrideCountMessage(faker.number.int({ min: 1 })),
    );

    expect(driver.get.badgeTexts()).toStrictEqual([]);
  });

  describe('when an override count message arrives from a tab', () => {
    const tabId = faker.number.int();

    beforeEach(() => {
      driver.given.sender({ tab: { id: tabId } });
    });

    it('should show the count on the badge of the tab when overrides exist', async () => {
      const overrideCount = faker.number.int({ min: 1, max: 99 });

      await driver.when.messageReceived(overrideCountMessage(overrideCount));

      expect(driver.get.badgeTexts()).toStrictEqual([
        { tabId, text: String(overrideCount) },
      ]);
    });

    it('should clear the badge of the tab when no overrides exist', async () => {
      await driver.when.messageReceived(overrideCountMessage(0));

      expect(driver.get.badgeTexts()).toStrictEqual([{ tabId, text: '' }]);
    });

    it('should paint the badge background when the count updates', async () => {
      await driver.when.messageReceived(
        overrideCountMessage(faker.number.int({ min: 1 })),
      );

      expect(driver.get.badgeBackgroundColors()).toStrictEqual(['#dfe3ea']);
    });

    it('should paint the badge text when the count updates', async () => {
      await driver.when.messageReceived(
        overrideCountMessage(faker.number.int({ min: 1 })),
      );

      expect(driver.get.badgeTextColors()).toStrictEqual(['#17202a']);
    });
  });

  describe('when a development session request arrives', () => {
    const previewUrl = faker.internet.url();
    const request = loadDevelopmentSessionRequest({
      hostId: faker.string.uuid(),
      previewUrl,
    });

    it('should respond with an error when the sender has no tab', async () => {
      await driver.when.messageReceived(request);

      expect(driver.get.response()).toStrictEqual({
        error: 'Atlas development session requires a browser tab.',
      });
    });

    it('should respond with an error when the preview url belongs to another tab', async () => {
      driver.given.sender({
        tab: { id: faker.number.int(), url: faker.internet.url() },
      });

      await driver.when.messageReceived(request);

      expect(driver.get.response()).toStrictEqual({
        error: 'Atlas development preview URL does not match its tab.',
      });
    });

    describe('when the preview url matches the sender tab', () => {
      beforeEach(() => {
        driver.given.sender({
          tab: { id: faker.number.int(), url: previewUrl },
        });
      });

      it('should load the development session for the request when received', async () => {
        driver.given.developmentSession({});

        await driver.when.messageReceived(request);

        expect(driver.get.loadDevelopmentSession()).toHaveBeenCalledWith(
          request,
          { fetchJson: expect.any(Function) },
        );
      });

      it('should respond with the session document when the session loads', async () => {
        const session = {
          schemaVersion: '1',
          hostId: request.hostId,
          overrides: [],
        };

        driver.given.developmentSession(session);

        await driver.when.messageReceived(request);

        expect(driver.get.response()).toStrictEqual({ document: session });
      });

      it('should respond with the failure message when the session cannot load', async () => {
        const reason = faker.lorem.sentence();

        driver.given.developmentSessionFailure(new Error(reason));

        await driver.when.messageReceived(request);

        expect(driver.get.response()).toStrictEqual({ error: reason });
      });
    });

    it('should respond with the session document when the sender tab url carries the control port parameter', async () => {
      const session = {
        schemaVersion: '1',
        hostId: request.hostId,
        overrides: [],
      };

      driver.given
        .sender({
          tab: {
            id: faker.number.int(),
            url: `${previewUrl}?atlas-dev-port=${faker.internet.port()}`,
          },
        })
        .given.developmentSession(session);

      await driver.when.messageReceived(request);

      expect(driver.get.response()).toStrictEqual({ document: session });
    });
  });

  describe('when the session loader fetches through the injected fetchJson', () => {
    const previewUrl = faker.internet.url();
    const request = loadDevelopmentSessionRequest({
      hostId: faker.string.uuid(),
      previewUrl,
    });

    beforeEach(async () => {
      driver.given
        .sender({ tab: { id: faker.number.int(), url: previewUrl } })
        .given.developmentSession({});

      await driver.when.messageReceived(request);
    });

    it('should fetch the given url without http cache when called', async () => {
      const url = faker.internet.url();
      const [, dependencies] =
        driver.get.loadDevelopmentSession().mock.calls[0]!;

      driver.given.fetchResponse(Response.json({}));

      await dependencies.fetchJson(url);

      expect(driver.get.fetch()).toHaveBeenCalledWith(url, {
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      });
    });

    it('should resolve with the body when the fetch succeeds', async () => {
      const body = {
        schemaVersion: '1',
        hostId: request.hostId,
        overrides: [],
      };
      const [, dependencies] =
        driver.get.loadDevelopmentSession().mock.calls[0]!;

      driver.given.fetchResponse(Response.json(body));

      await expect(
        dependencies.fetchJson(faker.internet.url()),
      ).resolves.toEqual(body);
    });

    it('should reject with the server error when the fetch fails with a message', async () => {
      const error = faker.lorem.sentence();
      const [, dependencies] =
        driver.get.loadDevelopmentSession().mock.calls[0]!;

      driver.given.fetchResponse(Response.json({ error }, { status: 404 }));

      await expect(
        dependencies.fetchJson(faker.internet.url()),
      ).rejects.toThrow(error);
    });

    it('should reject with the status when the fetch fails without a message', async () => {
      const [, dependencies] =
        driver.get.loadDevelopmentSession().mock.calls[0]!;

      driver.given.fetchResponse(new Response(null, { status: 500 }));

      await expect(
        dependencies.fetchJson(faker.internet.url()),
      ).rejects.toThrow('Atlas development session returned HTTP 500.');
    });
  });
});
