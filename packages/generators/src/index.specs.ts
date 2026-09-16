import { GeneratorsDriver } from './index.driver.js';
import {
  ALL_STYLESHEET_FORMATS,
  aGeneratorOptions,
  anAngularGeneratorOptions,
  anAtlasId,
  aReactGeneratorOptions,
} from './testkit/generator-options.testkit.js';

const ANGULAR_HOST_PATHS = [
  'package.json',
  'angular.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'federation.config.mjs',
  'atlas.config.ts',
  'atlas.bootstrap.html',
  'public/.gitkeep',
  'src/index.html',
  'src/styles.css',
  'src/assets/.gitkeep',
  'src/app/app.component.ts',
  'src/app/app.config.ts',
  'src/app/app.routes.ts',
  'src/app/host.config.ts',
  'src/main.ts',
  'src/bootstrap.ts',
];
const REACT_HOST_PATHS = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'atlas.config.ts',
  'atlas.bootstrap.html',
  'index.html',
  'src/styles.css',
  'src/main.tsx',
  'src/bootstrap.tsx',
  'src/host.config.tsx',
];
const ANGULAR_ROUTED_APP_PATHS = [
  'package.json',
  'angular.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'federation.config.mjs',
  'atlas.config.ts',
  'public/.gitkeep',
  'src/index.html',
  'src/styles.css',
  'src/main.ts',
  'src/entry.ts',
  'src/app/app.component.ts',
  'src/app/home/home.component.ts',
  'src/app/details/details.component.ts',
  'src/app/app.config.ts',
  'src/app/app.routes.ts',
  'src/exported-widgets/README.md',
];
const ANGULAR_SINGLE_PAGE_APP_PATHS = [
  'package.json',
  'angular.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'federation.config.mjs',
  'atlas.config.ts',
  'public/.gitkeep',
  'src/index.html',
  'src/styles.css',
  'src/main.ts',
  'src/entry.ts',
  'src/app/app.component.ts',
  'src/app/app.config.ts',
  'src/exported-widgets/README.md',
];
const REACT_ROUTED_APP_PATHS = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'atlas.config.ts',
  'index.html',
  'src/index.css',
  'src/App.tsx',
  'src/home/Home.tsx',
  'src/details/Details.tsx',
  'src/routes.tsx',
  'src/bootstrap.tsx',
  'src/exported-widgets/README.md',
];
const REACT_SINGLE_PAGE_APP_PATHS = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'atlas.config.ts',
  'index.html',
  'src/index.css',
  'src/App.tsx',
  'src/bootstrap.tsx',
  'src/exported-widgets/README.md',
];

describe('generateHostFiles', () => {
  let driver: GeneratorsDriver;

  beforeEach(() => {
    driver = new GeneratorsDriver();
  });

  describe('when framework is angular', () => {
    beforeEach(() => {
      driver.given.options(anAngularGeneratorOptions()).when.hostGenerated();
    });

    it('should generate angular host file set when host is generated', () => {
      expect(driver.get.paths()).toEqual(ANGULAR_HOST_PATHS);
    });

    it('should generate host atlas config when host is generated', () => {
      expect(driver.get.contents('atlas.config.ts')).toContain('type: "host"');
    });
  });

  describe('when framework is react', () => {
    beforeEach(() => {
      driver.given.options(aReactGeneratorOptions()).when.hostGenerated();
    });

    it('should generate react host file set when host is generated', () => {
      expect(driver.get.paths()).toEqual(REACT_HOST_PATHS);
    });

    it('should generate host atlas config when host is generated', () => {
      expect(driver.get.contents('atlas.config.ts')).toContain('type: "host"');
    });
  });

  it.each(ALL_STYLESHEET_FORMATS)(
    'should place angular host stylesheet at matching path when stylesheet format is %s',
    (stylesheetFormat) => {
      driver.given
        .options(anAngularGeneratorOptions({ stylesheetFormat }))
        .when.hostGenerated();

      expect(driver.get.paths()).toContain(`src/styles.${stylesheetFormat}`);
    },
  );

  it('should throw when name is not a lowercase hyphenated id', () => {
    driver.given.options(aGeneratorOptions({ name: 'Orders_App' }));

    expect(() => driver.when.hostGenerated()).toThrow(
      'Invalid name "Orders_App"',
    );
  });

  it('should throw when framework is not supported', () => {
    driver.given.options(aGeneratorOptions({ framework: 'vue' }));

    expect(() => driver.when.hostGenerated()).toThrow(
      'Unsupported Atlas generator framework "vue"',
    );
  });
});

describe('generateAppFiles', () => {
  let driver: GeneratorsDriver;

  beforeEach(() => {
    driver = new GeneratorsDriver();
  });

  describe('when framework is angular and routing is enabled', () => {
    beforeEach(() => {
      driver.given
        .options(anAngularGeneratorOptions({ routing: true }))
        .when.appGenerated();
    });

    it('should generate routed angular app file set when app is generated', () => {
      expect(driver.get.paths()).toEqual(ANGULAR_ROUTED_APP_PATHS);
    });

    it('should generate app atlas config when app is generated', () => {
      expect(driver.get.contents('atlas.config.ts')).toContain('type: "app"');
    });
  });

  it('should generate single-page angular app file set when framework is angular and routing is disabled', () => {
    driver.given
      .options(anAngularGeneratorOptions({ routing: false }))
      .when.appGenerated();

    expect(driver.get.paths()).toEqual(ANGULAR_SINGLE_PAGE_APP_PATHS);
  });

  it('should generate routed react app file set when framework is react and routing is enabled', () => {
    driver.given
      .options(aReactGeneratorOptions({ routing: true }))
      .when.appGenerated();

    expect(driver.get.paths()).toEqual(REACT_ROUTED_APP_PATHS);
  });

  it('should generate single-page react app file set when framework is react and routing is disabled', () => {
    driver.given
      .options(aReactGeneratorOptions({ routing: false }))
      .when.appGenerated();

    expect(driver.get.paths()).toEqual(REACT_SINGLE_PAGE_APP_PATHS);
  });

  it('should generate routed app file set when routing is omitted', () => {
    driver.given
      .options(aReactGeneratorOptions({ routing: undefined }))
      .when.appGenerated();

    expect(driver.get.paths()).toEqual(REACT_ROUTED_APP_PATHS);
  });

  it('should write host route into app atlas config when host id is given', () => {
    const hostId = anAtlasId();
    driver.given
      .options(aGeneratorOptions({ name: 'orders-app', hostId }))
      .when.appGenerated();

    expect(driver.get.contents('atlas.config.ts')).toContain(
      `routes: [{ hostId: "${hostId}", path: "/orders-app", title: "Orders App", nav: { label: "Orders App", visible: true } }]`,
    );
  });

  it('should omit routes from app atlas config when host id is omitted', () => {
    driver.given
      .options(aGeneratorOptions({ hostId: undefined }))
      .when.appGenerated();

    expect(driver.get.contents('atlas.config.ts')).not.toContain('routes:');
  });

  it('should throw when host id is not a lowercase hyphenated id', () => {
    driver.given.options(aGeneratorOptions({ hostId: 'Main.Host' }));

    expect(() => driver.when.appGenerated()).toThrow(
      'Invalid host id "Main.Host"',
    );
  });
});

describe('generateWidgetFiles', () => {
  let driver: GeneratorsDriver;

  beforeEach(() => {
    driver = new GeneratorsDriver();
  });

  it('should generate angular widget file set when framework is angular', () => {
    const name = anAtlasId();
    driver.given
      .options(anAngularGeneratorOptions({ name }))
      .when.widgetGenerated();

    expect(driver.get.paths()).toEqual([
      `src/exported-widgets/${name}/atlas.config.ts`,
      `src/exported-widgets/${name}/widget.config.ts`,
      `src/exported-widgets/${name}/index.ts`,
    ]);
  });

  it('should generate react widget file set when framework is react', () => {
    const name = anAtlasId();
    driver.given
      .options(aReactGeneratorOptions({ name }))
      .when.widgetGenerated();

    expect(driver.get.paths()).toEqual([
      `src/exported-widgets/${name}/atlas.config.ts`,
      `src/exported-widgets/${name}/index.tsx`,
    ]);
  });

  it('should throw when framework is not supported', () => {
    driver.given.options(aGeneratorOptions({ framework: 'vue' }));

    expect(() => driver.when.widgetGenerated()).toThrow(
      'Unsupported Atlas generator framework "vue"',
    );
  });
});
