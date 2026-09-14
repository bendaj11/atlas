import { DevelopmentSessionContentDriver } from './development-session-content.driver';

const REQUEST = {
  type: 'atlas.development-session.request',
  requestId: 'request-1',
  hostId: 'shop',
};
const SESSION = { schemaVersion: '1', hostId: 'shop', overrides: [] };
const RELAYED_REQUEST = {
  type: 'atlas.load-development-session',
  hostId: 'shop',
  previewUrl: 'http://localhost/',
};
const INVALID_PORT_SEARCHES = [
  '?atlas-dev-port=abc',
  '?atlas-dev-port=0',
  '?atlas-dev-port=70000',
  '?atlas-dev-port=1.5',
];

describe('development-session-content', () => {
  let driver: DevelopmentSessionContentDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionContentDriver();
  });

  describe('when started', () => {
    it('should install the bridge marker when the page loads', async () => {
      await driver.when.started();

      expect(driver.get.bridgeMarkerName()).toBe(
        'atlas-development-session-bridge',
      );
    });

    it('should remove the control port from the address bar when one is given', async () => {
      await driver.given
        .addressBarSearch('?tab=orders&atlas-dev-port=4512')
        .when.started();

      expect(driver.get.addressBarSearch()).toBe('?tab=orders');
    });

    it('should keep the address bar when no control port is given', async () => {
      await driver.given.addressBarSearch('?tab=orders').when.started();

      expect(driver.get.addressBarSearch()).toBe('?tab=orders');
    });

    it('should remember the control port when the address bar has one', async () => {
      await driver.given
        .addressBarSearch('?atlas-dev-port=4512')
        .when.started();

      expect(
        driver.get.sessionStorageItem('atlas.development-control-port'),
      ).toBe('4512');
    });

    it('should not remember a control port when the address bar has an invalid one', async () => {
      await driver.given.addressBarSearch('?atlas-dev-port=abc').when.started();

      expect(
        driver.get.sessionStorageItem('atlas.development-control-port'),
      ).toBeNull();
    });
  });

  describe('when a session request is posted', () => {
    it('should relay the request to the extension when no control port is given', async () => {
      await driver.when.messagePosted(REQUEST);

      expect(driver.get.runtimeMessages()).toEqual([RELAYED_REQUEST]);
    });

    it('should relay the control port when the address bar has one', async () => {
      await driver.given
        .addressBarSearch('?atlas-dev-port=4512')
        .when.messagePosted(REQUEST);

      expect(driver.get.runtimeMessages()).toEqual([
        { ...RELAYED_REQUEST, controlPort: 4512 },
      ]);
    });

    it('should relay the remembered control port when the address bar has none', async () => {
      await driver.given
        .sessionStorageItem('atlas.development-control-port', '4512')
        .when.messagePosted(REQUEST);

      expect(driver.get.runtimeMessages()).toEqual([
        { ...RELAYED_REQUEST, controlPort: 4512 },
      ]);
    });

    it('should prefer the address bar port when both are given', async () => {
      await driver.given
        .sessionStorageItem('atlas.development-control-port', '4512')
        .given.addressBarSearch('?atlas-dev-port=4600')
        .when.messagePosted(REQUEST);

      expect(driver.get.runtimeMessages()).toEqual([
        { ...RELAYED_REQUEST, controlPort: 4600 },
      ]);
    });

    it.each(INVALID_PORT_SEARCHES)(
      'should omit the control port when the address bar has %s',
      async (search) => {
        await driver.given.addressBarSearch(search).when.messagePosted(REQUEST);

        expect(driver.get.runtimeMessages()).toEqual([RELAYED_REQUEST]);
      },
    );

    it('should publish the document when the extension responds with one', async () => {
      await driver.given
        .runtimeResponse({ document: SESSION })
        .when.messagePosted(REQUEST);

      expect(driver.get.publishedMessages()).toEqual([
        {
          type: 'atlas.development-session.response',
          requestId: 'request-1',
          hostId: 'shop',
          document: SESSION,
        },
      ]);
    });

    it('should publish the error when the extension responds with one', async () => {
      await driver.given
        .runtimeResponse({ error: 'Atlas development session is invalid.' })
        .when.messagePosted(REQUEST);

      expect(driver.get.publishedMessages()).toEqual([
        {
          type: 'atlas.development-session.response',
          requestId: 'request-1',
          hostId: 'shop',
          error: 'Atlas development session is invalid.',
        },
      ]);
    });

    it('should publish an empty response when the extension responds with nothing', async () => {
      await driver.given.runtimeResponse(undefined).when.messagePosted(REQUEST);

      expect(driver.get.publishedMessages()).toEqual([
        {
          type: 'atlas.development-session.response',
          requestId: 'request-1',
          hostId: 'shop',
        },
      ]);
    });

    it('should publish the failure when the extension is unreachable', async () => {
      await driver.given
        .runtimeFailure('Extension context invalidated.')
        .when.messagePosted(REQUEST);

      expect(driver.get.publishedMessages()).toEqual([
        {
          type: 'atlas.development-session.response',
          requestId: 'request-1',
          hostId: 'shop',
          error: 'Extension context invalidated.',
        },
      ]);
    });

    it('should publish to the page origin when responding', async () => {
      await driver.when.messagePosted(REQUEST);

      expect(driver.get.publishedTargetOrigins()).toEqual(['http://localhost']);
    });
  });

  describe('when an unrelated message is posted', () => {
    it('should ignore the message when it comes from another window', async () => {
      await driver.when.messagePosted(REQUEST, null);

      expect(driver.get.runtimeMessages()).toEqual([]);
    });

    it('should ignore the message when it has another type', async () => {
      await driver.when.messagePosted({ ...REQUEST, type: 'other' });

      expect(driver.get.runtimeMessages()).toEqual([]);
    });

    it('should ignore the message when it has no request id', async () => {
      await driver.when.messagePosted({ type: REQUEST.type, hostId: 'shop' });

      expect(driver.get.runtimeMessages()).toEqual([]);
    });
  });
});
