import { faker } from '@faker-js/faker';
import { BootstrapFilesDriver } from './bootstrap-files.driver.js';

const VALID_TEMPLATE =
  '<div id="atlas-host-root"></div><script type="module" src="/atlas.loader.js"></script>';

describe('createAtlasBootstrapFiles', () => {
  let driver: BootstrapFilesDriver;

  beforeEach(() => {
    driver = new BootstrapFilesDriver();
  });

  it('should emit the page, loader, and module shim when created', () => {
    driver.when.created();

    expect(driver.get.paths()).toEqual([
      'index.html',
      'atlas.loader.js',
      'es-module-shims.js',
    ]);
  });

  it('should prefix the loader with shim mode options when created', () => {
    driver.when.created();

    expect(driver.get.contents('atlas.loader.js')).toMatch(
      /^globalThis\.esmsInitOptions=\{shimMode:true\};\n/,
    );
  });

  it('should generate the page with the given title when no html is given', () => {
    const title = faker.company.name().replaceAll(/[&<>"']/g, '');
    driver.given.options({ title }).when.created();

    expect(driver.get.contents('index.html')).toContain(
      `<title>${title}</title>`,
    );
  });

  it('should generate the page with the given loading html when no html is given', () => {
    const loadingHtml = `<p>${faker.lorem.sentence()}</p>`;
    driver.given.options({ loadingHtml }).when.created();

    expect(driver.get.contents('index.html')).toContain(
      `<div id="atlas-host-root">${loadingHtml}</div>`,
    );
  });

  it('should version the loader source when html is given', () => {
    driver.given.options({ html: VALID_TEMPLATE }).when.created();

    expect(driver.get.contents('index.html')).toMatch(
      /src="\/atlas\.loader\.js\?v=[0-9a-f]{12}"/,
    );
  });

  it('should end the page with a newline when html is given without one', () => {
    driver.given.options({ html: VALID_TEMPLATE }).when.created();

    expect(driver.get.contents('index.html')).toMatch(/[^\n]\n$/);
  });

  it('should reject when the given html lacks the host root', () => {
    driver.given
      .options({
        html: '<script type="module" src="/atlas.loader.js"></script>',
      })
      .when.created();

    expect(driver.get.error()).toMatchObject({
      code: 'BOOTSTRAP_TEMPLATE_INVALID',
    });
  });
});
