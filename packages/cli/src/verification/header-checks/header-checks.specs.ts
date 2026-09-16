import { HeaderChecksDriver } from './header-checks.driver.js';

const ABC_INTEGRITY = 'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=';

describe('header-checks', () => {
  let driver: HeaderChecksDriver;

  beforeEach(() => {
    driver = new HeaderChecksDriver();
  });

  describe('checkCors', () => {
    it('should record nothing when the asset is same-origin', () => {
      driver.when.corsChecked(`${driver.get.hostOrigin()}/main.js`);

      expect(driver.get.checks()).toStrictEqual([]);
    });

    it.each(['*', 'https://host.example'])(
      'should pass when Access-Control-Allow-Origin is %s',
      (allowed) => {
        driver.given.headers({ 'access-control-allow-origin': allowed });

        driver.when.corsChecked('https://cdn.example/main.js');

        expect(driver.get.checks()).toStrictEqual([
          {
            status: 'pass',
            subject: 'asset CORS',
            message: 'Allows https://host.example.',
          },
        ]);
      },
    );

    it('should fail when the header is missing on a cross-origin asset', () => {
      driver.when.corsChecked('https://cdn.example/main.js');

      expect(driver.get.checks()[0]).toMatchObject({
        status: 'failure',
        subject: 'asset CORS',
      });
    });
  });

  describe('checkMutableCache', () => {
    it('should fail when cache-control is immutable', () => {
      driver.given.headers({
        'cache-control': 'public, max-age=60, immutable',
      });

      driver.when.mutableCacheChecked();

      expect(driver.get.checks()[0]).toMatchObject({ status: 'failure' });
    });

    it('should warn when cache-control is missing', () => {
      driver.when.mutableCacheChecked();

      expect(driver.get.checks()[0]).toMatchObject({ status: 'warning' });
    });

    it('should pass with the header value when cache-control revalidates', () => {
      driver.given.headers({ 'cache-control': 'no-cache' });

      driver.when.mutableCacheChecked();

      expect(driver.get.checks()).toStrictEqual([
        { status: 'pass', subject: 'asset cache', message: 'no-cache' },
      ]);
    });
  });

  describe('checkImmutableCache', () => {
    it('should record nothing when channel is local', () => {
      driver.when.immutableCacheChecked('local');

      expect(driver.get.checks()).toStrictEqual([]);
    });

    it('should pass when cache-control is immutable with a positive max-age', () => {
      driver.given.headers({
        'cache-control': 'public, max-age=31536000, immutable',
      });

      driver.when.immutableCacheChecked('production');

      expect(driver.get.checks()[0]).toMatchObject({ status: 'pass' });
    });

    it('should warn when max-age is zero', () => {
      driver.given.headers({ 'cache-control': 'max-age=0, immutable' });

      driver.when.immutableCacheChecked('production');

      expect(driver.get.checks()[0]).toMatchObject({ status: 'warning' });
    });
  });

  describe('checkContentType', () => {
    it.each([
      ['json', 'application/json; charset=utf-8'],
      ['css', 'text/css'],
      ['javascript', 'text/javascript'],
    ] as const)(
      'should pass when %s is expected and served',
      (expected, served) => {
        driver.given.headers({ 'content-type': served });

        driver.when.contentTypeChecked(expected);

        expect(driver.get.checks()[0]).toMatchObject({
          status: 'pass',
          message: served,
        });
      },
    );

    it('should fail naming the expectation when the type is missing', () => {
      driver.when.contentTypeChecked('css');

      expect(driver.get.checks()).toStrictEqual([
        {
          status: 'failure',
          subject: 'asset MIME',
          message: 'Expected text/css, received "missing".',
        },
      ]);
    });
  });

  describe('checkIntegrity', () => {
    it('should warn as skipped when a local manifest has no integrity', () => {
      driver.when.integrityChecked({
        bytes: new Uint8Array(),
        integrity: undefined,
        channel: 'local',
      });

      expect(driver.get.checks()[0]).toMatchObject({
        status: 'warning',
        message: 'Skipped for a local manifest.',
      });
    });

    it('should warn as missing when a production manifest has no integrity', () => {
      driver.when.integrityChecked({
        bytes: new Uint8Array(),
        integrity: undefined,
        channel: 'production',
      });

      expect(driver.get.checks()[0]).toMatchObject({
        status: 'warning',
        message: 'Missing optional SHA-256 integrity metadata.',
      });
    });

    it('should pass when the digest matches', () => {
      driver.when.integrityChecked({
        bytes: new TextEncoder().encode('abc'),
        integrity: ABC_INTEGRITY,
        channel: 'production',
      });

      expect(driver.get.checks()[0]).toMatchObject({ status: 'pass' });
    });

    it('should fail when the digest differs', () => {
      driver.when.integrityChecked({
        bytes: new TextEncoder().encode('abd'),
        integrity: ABC_INTEGRITY,
        channel: 'production',
      });

      expect(driver.get.checks()[0]).toMatchObject({ status: 'failure' });
    });
  });
});
