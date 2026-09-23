import { faker } from '@faker-js/faker';
import {
  aGeneratorOptions,
  anAtlasId,
} from '../../testkit/generator-options.testkit.js';
import { AtlasConfigDriver } from './atlas-config.driver.js';

const UUID_V4 =
  /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

describe('renderAtlasAppConfig', () => {
  let driver: AtlasConfigDriver;

  beforeEach(() => {
    driver = new AtlasConfigDriver();
  });

  describe('when host id is omitted', () => {
    beforeEach(() => {
      driver.given
        .options(
          aGeneratorOptions({
            name: 'orders-app',
            framework: 'react',
            hostId: undefined,
          }),
        )
        .when.appConfigGenerated();
    });

    it('should write an app config without routes when generated', () => {
      expect(driver.get.contents()).toMatch(
        /^import type \{ AtlasAppConfig \} from "@atlas\/schema" with \{ "resolution-mode": "import" \};\n\nexport default \{\n {2}type: "app",\n {2}id: "[0-9a-f-]{36}",\n {2}name: "Orders App",\n {2}framework: "react"\n\} satisfies AtlasAppConfig;\n$/,
      );
    });

    it('should write a uuid v4 id when generated', () => {
      expect(driver.get.contents()).toMatch(UUID_V4);
    });
  });

  it('should write a host route when host id is given', () => {
    const hostId = anAtlasId();
    driver.given
      .options(aGeneratorOptions({ name: 'orders-app', hostId }))
      .when.appConfigGenerated();

    expect(driver.get.contents()).toContain(
      `,\n  routes: [{ hostId: "${hostId}", path: "/orders-app", title: "Orders App", nav: { label: "Orders App", visible: true } }]\n}`,
    );
  });
});

describe('renderAtlasHostConfig', () => {
  let driver: AtlasConfigDriver;

  beforeEach(() => {
    driver = new AtlasConfigDriver();
  });

  it('should write a host config with the given id when generated', () => {
    const hostId = faker.string.uuid();
    driver.given
      .options(aGeneratorOptions({ name: 'orders-host', framework: 'angular' }))
      .when.hostConfigGenerated(hostId);

    expect(driver.get.contents()).toBe(
      `import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "host",\n  id: "${hostId}",\n  name: "Orders Host",\n  framework: "angular"\n} satisfies AtlasHostConfig;\n`,
    );
  });
});

describe('renderAtlasBootstrapHtml', () => {
  let driver: AtlasConfigDriver;

  beforeEach(() => {
    driver = new AtlasConfigDriver();
  });

  it('should title the bootstrap document after the project name when generated', () => {
    driver.given
      .options(aGeneratorOptions({ name: 'orders-host' }))
      .when.bootstrapHtmlGenerated();

    expect(driver.get.contents()).toContain('<title>Orders Host</title>');
  });

  it('should end with a newline when generated', () => {
    driver.given.options(aGeneratorOptions()).when.bootstrapHtmlGenerated();

    expect(driver.get.contents()).toMatch(/\n$/);
  });
});
