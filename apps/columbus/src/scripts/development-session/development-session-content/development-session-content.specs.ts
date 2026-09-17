import { faker } from '@faker-js/faker';
import { DevelopmentSessionContentDriver } from './development-session-content.driver';

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

    it('should keep the address bar when no control port is given', async () => {
      driver.given.addressBarSearch('?tab=orders');

      await driver.when.started();

      expect(driver.get.addressBarSearch()).toBe('?tab=orders');
    });

    it('should remove the control port from the address bar when one is given', async () => {
      driver.given.addressBarSearch(
        `?tab=orders&atlas-dev-port=${faker.internet.port()}`,
      );

      await driver.when.started();

      expect(driver.get.addressBarSearch()).toBe('?tab=orders');
    });

    it('should remember the control port when the address bar has a valid one', async () => {
      const controlPort = faker.internet.port();

      driver.given.addressBarSearch(`?atlas-dev-port=${controlPort}`);

      await driver.when.started();

      expect(
        driver.get.sessionStorageItem('atlas.development-control-port'),
      ).toBe(String(controlPort));
    });

    it('should not remember a control port when the address bar has an invalid one', async () => {
      driver.given.addressBarSearch('?atlas-dev-port=abc');

      await driver.when.started();

      expect(
        driver.get.sessionStorageItem('atlas.development-control-port'),
      ).toBeNull();
    });
  });

  describe('when a session request is posted from the page window', () => {
    const request = {
      type: 'atlas.development-session.request',
      requestId: faker.string.uuid(),
      hostId: faker.string.uuid(),
    };

    it('should relay the request to the extension without a control port when none is given', async () => {
      await driver.when.messagePosted(request);

      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.load-development-session',
        hostId: request.hostId,
        previewUrl: driver.get.pageUrl(),
      });
    });

    it('should relay the control port when the address bar has one', async () => {
      const controlPort = faker.internet.port();

      driver.given.addressBarSearch(`?atlas-dev-port=${controlPort}`);

      await driver.when.messagePosted(request);

      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.load-development-session',
        hostId: request.hostId,
        previewUrl: driver.get.pageUrl(),
        controlPort,
      });
    });

    it('should relay the remembered control port when the address bar has none', async () => {
      const controlPort = faker.internet.port();

      driver.given.sessionStorageItem(
        'atlas.development-control-port',
        String(controlPort),
      );

      await driver.when.messagePosted(request);

      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.load-development-session',
        hostId: request.hostId,
        previewUrl: driver.get.pageUrl(),
        controlPort,
      });
    });

    it('should relay the address bar control port when both are given', async () => {
      const addressBarPort = faker.internet.port();

      driver.given
        .sessionStorageItem(
          'atlas.development-control-port',
          String(faker.internet.port()),
        )
        .given.addressBarSearch(`?atlas-dev-port=${addressBarPort}`);

      await driver.when.messagePosted(request);

      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.load-development-session',
        hostId: request.hostId,
        previewUrl: driver.get.pageUrl(),
        controlPort: addressBarPort,
      });
    });

    it.each(INVALID_PORT_SEARCHES)(
      'should relay the request without a control port when the address bar has %s',
      async (search) => {
        driver.given.addressBarSearch(search);

        await driver.when.messagePosted(request);

        expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
          type: 'atlas.load-development-session',
          hostId: request.hostId,
          previewUrl: driver.get.pageUrl(),
        });
      },
    );

    it('should post the document to the page origin when the extension responds with one', async () => {
      const session = {
        schemaVersion: '1',
        hostId: request.hostId,
        overrides: [],
      };

      driver.given.runtimeResponse({ document: session });

      await driver.when.messagePosted(request);

      expect(driver.get.postMessage()).toHaveBeenCalledWith(
        {
          type: 'atlas.development-session.response',
          requestId: request.requestId,
          hostId: request.hostId,
          document: session,
        },
        'http://localhost',
      );
    });

    it('should post the error when the extension responds with one', async () => {
      const error = faker.lorem.sentence();

      driver.given.runtimeResponse({ error });

      await driver.when.messagePosted(request);

      expect(driver.get.postMessage()).toHaveBeenCalledWith(
        {
          type: 'atlas.development-session.response',
          requestId: request.requestId,
          hostId: request.hostId,
          error,
        },
        'http://localhost',
      );
    });

    it('should post an empty response when the extension responds with nothing', async () => {
      driver.given.runtimeResponse(undefined);

      await driver.when.messagePosted(request);

      expect(driver.get.postMessage()).toHaveBeenCalledWith(
        {
          type: 'atlas.development-session.response',
          requestId: request.requestId,
          hostId: request.hostId,
        },
        'http://localhost',
      );
    });

    it('should post the failure message when the extension is unreachable', async () => {
      const reason = faker.lorem.sentence();

      driver.given.runtimeFailure(new Error(reason));

      await driver.when.messagePosted(request);

      expect(driver.get.postMessage()).toHaveBeenCalledWith(
        {
          type: 'atlas.development-session.response',
          requestId: request.requestId,
          hostId: request.hostId,
          error: reason,
        },
        'http://localhost',
      );
    });
  });

  describe('when an unrelated message is posted', () => {
    const request = {
      type: 'atlas.development-session.request',
      requestId: faker.string.uuid(),
      hostId: faker.string.uuid(),
    };

    it('should not relay the message when it comes from another window', async () => {
      await driver.when.messagePosted(request, null);

      expect(driver.get.runtimeMessage()).not.toHaveBeenCalled();
    });

    it('should not relay the message when it has another type', async () => {
      await driver.when.messagePosted({ ...request, type: faker.word.noun() });

      expect(driver.get.runtimeMessage()).not.toHaveBeenCalled();
    });

    it('should not relay the message when it has no request id', async () => {
      await driver.when.messagePosted({
        type: request.type,
        hostId: request.hostId,
      });

      expect(driver.get.runtimeMessage()).not.toHaveBeenCalled();
    });
  });
});
