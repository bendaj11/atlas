/** @jest-environment node */
import {
  actionThemeMessage,
  loadDevelopmentSessionRequest,
  overrideCountMessage,
} from '../shared/messages/messages';
import { BackgroundDriver } from './background.driver';

const PREVIEW_URL = 'http://localhost:4300/dashboard';
const SESSION_URL = 'http://localhost:4400/atlas.dev-session.json';
const LOAD_REQUEST = loadDevelopmentSessionRequest({
  hostId: 'shop',
  previewUrl: PREVIEW_URL,
});
const SESSION = { schemaVersion: '1', hostId: 'shop', overrides: [] };

describe('background', () => {
  let driver: BackgroundDriver;

  beforeEach(() => {
    driver = new BackgroundDriver();
  });

  describe('when a tab changes', () => {
    it('should clear the host data cache when the tab starts loading', async () => {
      await driver.when.tabUpdated(7, { status: 'loading' });

      expect(driver.get.clearedCacheTabIds()).toEqual([7]);
    });

    it('should keep the host data cache when the tab finishes loading', async () => {
      await driver.when.tabUpdated(7, { status: 'complete' });

      expect(driver.get.clearedCacheTabIds()).toEqual([]);
    });

    it('should clear the host data cache when the tab is removed', async () => {
      await driver.when.tabRemoved(7);

      expect(driver.get.clearedCacheTabIds()).toEqual([7]);
    });
  });

  describe('when an action theme message arrives', () => {
    it('should set the bright icon when the color scheme is dark', async () => {
      await driver.when.messageReceived(actionThemeMessage('dark'));

      expect(driver.get.actionIconPaths()).toEqual([
        {
          16: 'icons/columbus-bright-16.png',
          32: 'icons/columbus-bright-32.png',
        },
      ]);
    });

    it('should set the dark icon when the color scheme is light', async () => {
      await driver.when.messageReceived(actionThemeMessage('light'));

      expect(driver.get.actionIconPaths()).toEqual([
        { 16: 'icons/columbus-dark-16.png', 32: 'icons/columbus-dark-32.png' },
      ]);
    });
  });

  describe('when an override count message arrives from a tab', () => {
    beforeEach(() => {
      driver.given.sender({ tab: { id: 7 } });
    });

    it('should show the count on the badge when overrides exist', async () => {
      await driver.when.messageReceived(overrideCountMessage(3));

      expect(driver.get.badgeTexts()).toEqual([{ tabId: 7, text: '3' }]);
    });

    it('should clear the badge when no overrides exist', async () => {
      await driver.when.messageReceived(overrideCountMessage(0));

      expect(driver.get.badgeTexts()).toEqual([{ tabId: 7, text: '' }]);
    });

    it('should paint the badge background when the count updates', async () => {
      await driver.when.messageReceived(overrideCountMessage(3));

      expect(driver.get.badgeBackgroundColors()).toEqual(['#dfe3ea']);
    });

    it('should paint the badge text when the count updates', async () => {
      await driver.when.messageReceived(overrideCountMessage(3));

      expect(driver.get.badgeTextColors()).toEqual(['#17202a']);
    });
  });

  it('should ignore the override count when the sender has no tab', async () => {
    await driver.when.messageReceived(overrideCountMessage(3));

    expect(driver.get.badgeTexts()).toEqual([]);
  });

  describe('when a development session request arrives', () => {
    it('should reject the request when the sender has no tab', async () => {
      await driver.when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({
        error: 'Atlas development session requires a browser tab.',
      });
    });

    it('should reject the request when the preview url belongs to another tab', async () => {
      await driver.given
        .sender({ tab: { id: 1, url: 'http://localhost:4300/other' } })
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({
        error: 'Atlas development preview URL does not match its tab.',
      });
    });

    it('should respond with the session when the preview url matches the tab', async () => {
      await driver.given
        .sender({ tab: { id: 1, url: PREVIEW_URL } })
        .given.developmentSession(SESSION)
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({ document: SESSION });
    });

    it('should ignore the control port parameter when matching the preview url', async () => {
      await driver.given
        .sender({ tab: { id: 1, url: `${PREVIEW_URL}?atlas-dev-port=4512` } })
        .given.developmentSession(SESSION)
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({ document: SESSION });
    });

    it('should forward the request when the preview url matches the tab', async () => {
      await driver.given
        .sender({ tab: { id: 1, url: PREVIEW_URL } })
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.loadedRequests()).toEqual([LOAD_REQUEST]);
    });

    it('should respond with the failure when the session cannot load', async () => {
      await driver.given
        .sender({ tab: { id: 1, url: PREVIEW_URL } })
        .given.developmentSessionFailure(
          'Atlas development session is invalid.',
        )
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({
        error: 'Atlas development session is invalid.',
      });
    });
  });

  describe('when the session is fetched', () => {
    beforeEach(() => {
      driver.given
        .sender({ tab: { id: 1, url: PREVIEW_URL } })
        .given.developmentSessionUrl(SESSION_URL);
    });

    it('should request the given url when fetching', async () => {
      await driver.when.messageReceived(LOAD_REQUEST);

      expect(driver.get.fetchedUrls()).toEqual([SESSION_URL]);
    });

    it('should bypass the http cache when fetching', async () => {
      await driver.when.messageReceived(LOAD_REQUEST);

      expect(driver.get.fetchCacheMode()).toBe('no-store');
    });

    it('should respond with the body when the fetch succeeds', async () => {
      await driver.given
        .fetchResponse(SESSION, 200)
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({ document: SESSION });
    });

    it('should respond with the server error when the fetch fails with a message', async () => {
      await driver.given
        .fetchResponse({ error: 'Host is not registered.' }, 404)
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({
        error: 'Host is not registered.',
      });
    });

    it('should respond with the status when the fetch fails without a message', async () => {
      await driver.given
        .fetchResponse(undefined, 500)
        .when.messageReceived(LOAD_REQUEST);

      expect(driver.get.response()).toEqual({
        error: 'Atlas development session returned HTTP 500.',
      });
    });
  });
});
