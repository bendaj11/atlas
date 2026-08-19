import { beforeEach, describe, expect, it } from '@jest/globals';
import { IndexDriver } from './index.driver.js';

describe('bootstrap bundle', () => {
  let driver: IndexDriver;

  beforeEach(() => {
    driver = new IndexDriver();
  });

  it('should emit required deployment files when creating default bootstrap assets', () => {
    driver.when.createFiles();

    expect(driver.get.filePaths()).toEqual([
      'index.html',
      'atlas.loader.js',
      'es-module-shims.js',
      'atlas.runtime.json',
      'nginx.conf',
    ]);
  });

  it('should omit environment files when creating external runtime bootstrap assets', () => {
    driver.when.createExternalFiles();

    expect(driver.get.filePaths()).toEqual([
      'index.html',
      'atlas.loader.js',
      'es-module-shims.js',
    ]);
  });

  it('should require runtime configuration when creating embedded bootstrap assets', () => {
    expect(driver.get.missingRuntimeError()).toContain(
      'requires runtime configuration',
    );
  });

  it('should include host root when creating default bootstrap assets', () => {
    driver.when.createFiles();

    expect(driver.get.fileContents('index.html')).toContain('atlas-host-root');
  });

  it('should include browser loader when creating default bootstrap assets', () => {
    driver.when.createFiles();

    expect(driver.get.fileContents('index.html')).toContain('atlas.loader.js');
  });

  it('should include module shim when creating bootstrap assets', () => {
    driver.when.createFiles();

    expect(driver.get.fileContents('es-module-shims.js')).toContain(
      'ES Module Shims',
    );
  });

  it('should serialize runtime config when creating bootstrap assets', () => {
    driver.when.createFiles();

    expect(driver.get.runtime()).toEqual(driver.get.defaultRuntime());
  });

  it('should route missing pages to index HTML when creating Nginx config', () => {
    expect(driver.get.nginxConfig()).toContain(
      'try_files $uri $uri/ /index.html',
    );
  });

  it('should return 404 for missing static assets when creating Nginx config', () => {
    expect(driver.get.nginxConfig()).toContain(
      'location ~ \\.[^/]+$ {\n    try_files $uri =404;',
    );
  });

  it('should include runtime asset origins when creating Nginx config', () => {
    expect(driver.get.nginxConfig()).toContain('https://assets.example');
  });

  it('should allow loopback WebSocket connections for explicit development sessions', () => {
    expect(driver.get.nginxConfig()).toContain('ws://localhost:*');
  });

  it('should allow loopback IPv4 WebSocket connections when custom overrides are enabled', () => {
    expect(driver.get.nginxConfig()).toContain('ws://127.0.0.1:*');
  });

  it('should allow loopback IPv6 WebSocket connections when custom overrides are enabled', () => {
    expect(driver.get.nginxConfig()).toContain('ws://[::1]:*');
  });

  it('should preserve custom HTML when it has required runtime hooks', () => {
    driver.given
      .html(
        '<main id="atlas-host-root">Custom</main><script type="module" src="/atlas.loader.js"></script>',
      )
      .when.createFiles();

    expect(driver.get.fileContents('index.html')).toBe(
      '<main id="atlas-host-root">Custom</main><script type="module" src="/atlas.loader.js"></script>\n',
    );
  });

  it('should reject custom HTML when host root is missing', () => {
    expect(
      driver.get.htmlValidationError(
        '<script src="/atlas.loader.js"></script>',
      ),
    ).toContain('atlas-host-root');
  });

  it('should reject custom HTML when loader script is missing', () => {
    expect(
      driver.get.htmlValidationError('<main id="atlas-host-root"></main>'),
    ).toContain('atlas.loader.js');
  });

  it('should escape title markup when creating default HTML', () => {
    expect(driver.get.html({ title: 'A < B' })).toContain(
      '<title>A &lt; B</title>',
    );
  });

  it('should preserve custom loading markup when creating default HTML', () => {
    expect(
      driver.get.html({ loadingHtml: '<strong>Starting</strong>' }),
    ).toContain('<strong>Starting</strong>');
  });
});
