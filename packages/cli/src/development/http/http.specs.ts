import { faker } from '@faker-js/faker';
import { HttpDriver } from './http.driver.js';

describe('http', () => {
  let driver: HttpDriver;

  beforeEach(() => {
    driver = new HttpDriver();
  });

  it('should build a localhost origin when a port is given', () => {
    const port = faker.internet.port();

    expect(driver.get.localOrigin(port)).toBe(`http://localhost:${port}`);
  });

  it.each([
    [true, { code: 'EADDRINUSE' }],
    [false, { code: 'ECONNREFUSED' }],
    [false, null],
  ])('should report address-in-use %p when error is %p', (expected, error) => {
    expect(driver.get.addressInUse(error)).toBe(expected);
  });

  describe('when a server is listening', () => {
    beforeEach(async () => {
      await driver.when.serverStarted('Atlas test');
    });

    afterEach(async () => {
      await driver.when.serverClosed();
    });

    it('should announce the actual address when listening starts', () => {
      expect(driver.get.infoMock()).toHaveBeenCalledWith(
        expect.stringMatching(/^Atlas test running at http:\/\/localhost:\d+$/),
      );
    });

    it('should deliver the parsed JSON body when postJson is used', async () => {
      const value = { id: faker.string.uuid() };

      await driver.when.posted('/items', value);

      expect(driver.get.received()).toStrictEqual([
        { method: 'POST', body: value },
      ]);
    });

    it('should send a DELETE request when deleteJson is used', async () => {
      await driver.when.deleted('/items/1');

      expect(driver.get.received()[0]?.method).toBe('DELETE');
    });

    it('should reject with status and body when the server responds with an error', async () => {
      driver.given.responder(() => ({
        status: 409,
        value: { error: 'taken' },
      }));

      await expect(driver.when.posted('/items', {})).rejects.toThrow(
        /rejected .*\/items: 409 \{\n  "error": "taken"\n\}/,
      );
    });

    it('should respond 400 with a JSON error when the body is not JSON', async () => {
      const response = await driver.when.rawPosted('/items', '{ nope');

      expect([response.status, await response.json()]).toEqual([
        400,
        { error: 'Invalid JSON request body.' },
      ]);
    });
  });

  it('should resolve closeServer when the server is not listening', async () => {
    await driver.when.serverStarted();
    await driver.when.serverClosed();

    await expect(driver.when.serverClosed()).resolves.toBeUndefined();
  });
});
