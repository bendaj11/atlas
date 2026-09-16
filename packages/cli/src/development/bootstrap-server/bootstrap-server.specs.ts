import { BootstrapServerDriver } from './bootstrap-server.driver.js';

describe('startLocalBootstrapServer', () => {
  let driver: BootstrapServerDriver;

  beforeEach(() => {
    driver = new BootstrapServerDriver();
  });

  afterEach(async () => {
    await driver.when.stopped();
  });

  describe('when started without a proxy', () => {
    beforeEach(async () => {
      await driver.when.started();
    });

    it('should serve the runtime config as no-store JSON when requested', async () => {
      const response = await driver.get.response('/atlas.runtime.json');

      expect([
        response.headers.get('content-type'),
        response.headers.get('cache-control'),
        await response.json(),
      ]).toEqual([
        'application/json; charset=utf-8',
        'no-store',
        driver.get.runtime(),
      ]);
    });

    it('should serve the loader with no-cache when requested', async () => {
      const response = await driver.get.response('/atlas.loader.js');

      expect(response.headers.get('cache-control')).toBe('no-cache');
    });

    it('should fall back to index.html when an extensionless route is requested', async () => {
      const response = await driver.get.response('/orders/42');

      expect(response.headers.get('content-type')).toBe(
        'text/html; charset=utf-8',
      );
    });

    it('should respond 404 when an unknown file is requested', async () => {
      expect((await driver.get.response('/missing.css')).status).toBe(404);
    });

    it('should respond 405 when the method is not GET or HEAD', async () => {
      expect((await driver.get.response('/index.html', 'POST')).status).toBe(
        405,
      );
    });

    it('should send headers only when HEAD is used', async () => {
      const response = await driver.get.response('/index.html', 'HEAD');

      expect(await response.text()).toBe('');
    });
  });

  describe('when started with a proxy route', () => {
    beforeEach(async () => {
      await driver.given.upstream({ '/api': { target: 'ignored' } });

      await driver.when.started();
    });

    it('should forward matching requests to the upstream when the path matches', async () => {
      const response = await driver.get.response('/api/orders');

      expect([
        response.headers.get('x-upstream'),
        await response.text(),
      ]).toStrictEqual(['yes', 'upstream GET /api/orders']);
    });

    it('should serve bootstrap files when the path does not match', async () => {
      const response = await driver.get.response('/atlas.runtime.json');

      expect(response.headers.get('x-upstream')).toBeNull();
    });
  });

  it('should serve the custom html when one is given', async () => {
    driver.given.html(
      '<html><body><div id="atlas-host-root">custom</div><script src="/atlas.loader.js"></script></body></html>',
    );

    await driver.when.started();

    expect(await (await driver.get.response('/')).text()).toContain('custom');
  });
});
