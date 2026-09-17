import { faker } from '@faker-js/faker';
import { BootstrapHtmlDriver } from './bootstrap-html.driver.js';

const VERSIONED_LOADER_SCRIPT =
  /<script type="module" src="\/atlas\.loader\.js\?v=[0-9a-f]{12}"><\/script>/;

describe('createBootstrapHtml', () => {
  let driver: BootstrapHtmlDriver;

  beforeEach(() => {
    driver = new BootstrapHtmlDriver();
  });

  it('should use the default title when no title is given', () => {
    driver.when.htmlCreated();

    expect(driver.get.html()).toContain('<title>Atlas</title>');
  });

  it('should use the default loading content when no loading html is given', () => {
    driver.when.htmlCreated();

    expect(driver.get.html()).toContain(
      '<div id="atlas-host-root">Loading product…</div>',
    );
  });

  it('should load the versioned loader script when created', () => {
    driver.when.htmlCreated();

    expect(driver.get.html()).toMatch(VERSIONED_LOADER_SCRIPT);
  });

  it('should escape the title when a title is given', () => {
    driver.given.title('<b>Orders & "Admin"</b>').when.htmlCreated();

    expect(driver.get.html()).toContain(
      '<title>&lt;b&gt;Orders &amp; &quot;Admin&quot;&lt;/b&gt;</title>',
    );
  });

  it('should insert the loading html unescaped when loading html is given', () => {
    const loadingHtml = `<p>${faker.lorem.sentence()}</p>`;
    driver.given.loadingHtml(loadingHtml).when.htmlCreated();

    expect(driver.get.html()).toContain(
      `<div id="atlas-host-root">${loadingHtml}</div>`,
    );
  });
});

describe('applyVersionedLoaderSource', () => {
  let driver: BootstrapHtmlDriver;

  beforeEach(() => {
    driver = new BootstrapHtmlDriver();
  });

  it('should append a version query to the loader source when the template loads it unversioned', () => {
    driver.given
      .html('<script type="module" src="/atlas.loader.js"></script>')
      .when.loaderSourceVersioned();

    expect(driver.get.html()).toMatch(VERSIONED_LOADER_SCRIPT);
  });

  it('should replace an existing version query when the template loads a versioned loader', () => {
    driver.given
      .html('<script type="module" src="/atlas.loader.js?v=old"></script>')
      .when.loaderSourceVersioned();

    expect(driver.get.html()).not.toContain('?v=old');
  });

  it('should leave the template untouched when it loads no loader', () => {
    const html = `<script src="/${faker.system.commonFileName('js')}"></script>`;
    driver.given.html(html).when.loaderSourceVersioned();

    expect(driver.get.html()).toBe(html);
  });
});

describe('validateBootstrapHtml', () => {
  let driver: BootstrapHtmlDriver;

  beforeEach(() => {
    driver = new BootstrapHtmlDriver();
  });

  it('should accept a template with the host root and loader script when validated', () => {
    driver.given
      .html(
        '<div id="atlas-host-root"></div><script type="module" src="/atlas.loader.js"></script>',
      )
      .when.htmlValidated();

    expect(driver.get.error()).toBeUndefined();
  });

  it('should reject a template without the host root when validated', () => {
    driver.given
      .html('<script type="module" src="/atlas.loader.js"></script>')
      .when.htmlValidated();

    expect(driver.get.error()).toMatchObject({
      code: 'BOOTSTRAP_TEMPLATE_INVALID',
      summary:
        'Atlas bootstrap template must contain an element with id="atlas-host-root".',
    });
  });

  it('should reject a template without the loader script when validated', () => {
    driver.given.html('<div id="atlas-host-root"></div>').when.htmlValidated();

    expect(driver.get.error()).toMatchObject({
      code: 'BOOTSTRAP_TEMPLATE_INVALID',
      summary:
        'Atlas bootstrap template must load /atlas.loader.js with a script element.',
    });
  });
});
