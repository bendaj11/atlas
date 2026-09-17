import { faker } from '@faker-js/faker';
import {
  ALL_STYLESHEET_FORMATS,
  anAtlasId,
} from '../../testkit/generator-options.testkit.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { AngularWorkspaceGeneratorDriver } from './angular-workspace-generator.driver.js';

describe('buildAngularWorkspaceDocument', () => {
  let driver: AngularWorkspaceGeneratorDriver;

  beforeEach(() => {
    driver = new AngularWorkspaceGeneratorDriver();
  });

  it('should register one application project rooted at src when generated', () => {
    driver.when.workspaceGenerated();

    expect(driver.get.project()).toMatchObject({
      projectType: 'application',
      root: '',
      sourceRoot: 'src',
    });
  });

  it('should point build and serve targets at the project esbuild and serve-original targets when generated', () => {
    const name = anAtlasId();
    driver.given.name(name).when.workspaceGenerated();

    expect(driver.get.project().architect).toMatchObject({
      build: {
        options: { target: `${name}:esbuild:production` },
        configurations: {
          development: { target: `${name}:esbuild:development`, dev: true },
        },
      },
      serve: {
        options: { target: `${name}:serve-original:development`, dev: true },
      },
      'serve-original': {
        builder: '@angular-devkit/build-angular:dev-server',
        configurations: {
          production: { buildTarget: `${name}:esbuild:production` },
          development: { buildTarget: `${name}:esbuild:development` },
        },
        defaultConfiguration: 'development',
      },
    });
  });

  it('should resolve dependency real paths when generated', () => {
    driver.when.workspaceGenerated();

    expect(driver.get.project().architect.esbuild!.options).toMatchObject({
      preserveSymlinks: false,
    });
  });

  it('should output to dist under the project name when generated', () => {
    const name = anAtlasId();
    driver.given.name(name).when.workspaceGenerated();

    expect(driver.get.project().architect.esbuild!.options!.outputPath).toBe(
      `dist/${name}`,
    );
  });

  it('should use the native federation builder of the profile for build and serve when major uses the v4 package', () => {
    driver.given
      .profile(anAngularVersionProfile({ major: 21 }))
      .when.workspaceGenerated();

    expect(driver.get.project().architect).toMatchObject({
      build: { builder: '@angular-architects/native-federation-v4:build' },
      serve: { builder: '@angular-architects/native-federation-v4:build' },
    });
  });

  it('should use the main native federation builder for build and serve when major uses the main package', () => {
    driver.given
      .profile(anAngularVersionProfile({ major: 19 }))
      .when.workspaceGenerated();

    expect(driver.get.project().architect).toMatchObject({
      build: { builder: '@angular-architects/native-federation:build' },
      serve: { builder: '@angular-architects/native-federation:build' },
    });
  });

  it('should polyfill zone.js before es-module-shims when profile is zoneful', () => {
    driver.given
      .profile(anAngularVersionProfile({ zoneless: false }))
      .when.workspaceGenerated();

    expect(driver.get.project().architect.esbuild!.options!.polyfills).toEqual([
      'zone.js',
      'es-module-shims',
    ]);
  });

  it('should polyfill only es-module-shims when profile is zoneless', () => {
    driver.given
      .profile(anAngularVersionProfile({ zoneless: true }))
      .when.workspaceGenerated();

    expect(driver.get.project().architect.esbuild!.options!.polyfills).toEqual([
      'es-module-shims',
    ]);
  });

  it('should use the css stylesheet when stylesheet format is omitted', () => {
    driver.given.stylesheetFormat(undefined).when.workspaceGenerated();

    expect(driver.get.project().architect.esbuild!.options!.styles).toEqual([
      'src/styles.css',
    ]);
  });

  it.each(ALL_STYLESHEET_FORMATS)(
    'should use the matching stylesheet when stylesheet format is %s',
    (stylesheetFormat) => {
      driver.given.stylesheetFormat(stylesheetFormat).when.workspaceGenerated();

      expect(driver.get.project().architect.esbuild!.options!.styles).toEqual([
        `src/styles.${stylesheetFormat}`,
      ]);
    },
  );

  describe('when type is host', () => {
    beforeEach(() => {
      driver.given.type('host');
    });

    it('should serve on 4200 and the original dev server on 4300 when dev server port is omitted', () => {
      driver.given.devServerPort(undefined).when.workspaceGenerated();

      expect(driver.get.project().architect).toMatchObject({
        serve: { options: { port: 4200 } },
        'serve-original': { options: { port: 4300 } },
      });
    });

    it('should serve on the dev server port and the original dev server on 4300 when dev server port is another port', () => {
      const devServerPort = faker.number.int({ min: 1024, max: 4299 });
      driver.given.devServerPort(devServerPort).when.workspaceGenerated();

      expect(driver.get.project().architect).toMatchObject({
        serve: { options: { port: devServerPort } },
        'serve-original': { options: { port: 4300 } },
      });
    });

    it('should serve the original dev server on 4200 when dev server port is 4300', () => {
      driver.given.devServerPort(4300).when.workspaceGenerated();

      expect(driver.get.project().architect).toMatchObject({
        serve: { options: { port: 4300 } },
        'serve-original': { options: { port: 4200 } },
      });
    });

    it('should enable build notifications on the serve target when generated', () => {
      driver.when.workspaceGenerated();

      expect(driver.get.project().architect.serve!.options).toMatchObject({
        buildNotifications: {
          enable: true,
          endpoint:
            '/@angular-architects/native-federation:build-notifications',
        },
      });
    });
  });

  describe('when type is app', () => {
    beforeEach(() => {
      driver.given.type('app');
    });

    it('should serve both targets on 4201 when dev server port is omitted', () => {
      driver.given.devServerPort(undefined).when.workspaceGenerated();

      expect(driver.get.project().architect).toMatchObject({
        serve: { options: { port: 4201 } },
        'serve-original': { options: { port: 4201 } },
      });
    });

    it('should serve both targets on the dev server port when dev server port is given', () => {
      const devServerPort = faker.internet.port();
      driver.given.devServerPort(devServerPort).when.workspaceGenerated();

      expect(driver.get.project().architect).toMatchObject({
        serve: { options: { port: devServerPort } },
        'serve-original': { options: { port: devServerPort } },
      });
    });

    it('should omit build notifications from the serve target when generated', () => {
      driver.when.workspaceGenerated();

      expect(driver.get.project().architect.serve!.options).not.toHaveProperty(
        'buildNotifications',
      );
    });
  });
});

describe('buildAngularRootTsconfig', () => {
  let driver: AngularWorkspaceGeneratorDriver;

  beforeEach(() => {
    driver = new AngularWorkspaceGeneratorDriver();
  });

  it('should target ES2022 with strict templates when generated', () => {
    driver.when.rootTsconfigGenerated();

    expect(driver.get.tsconfig()).toEqual({
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        strict: true,
        experimentalDecorators: true,
        useDefineForClassFields: false,
        lib: ['ES2022', 'DOM'],
        skipLibCheck: true,
      },
      angularCompilerOptions: {
        strictTemplates: true,
        strictInjectionParameters: true,
      },
    });
  });
});

describe('buildAngularAppTsconfig', () => {
  let driver: AngularWorkspaceGeneratorDriver;

  beforeEach(() => {
    driver = new AngularWorkspaceGeneratorDriver();
  });

  it('should extend the root tsconfig and include atlas sources when generated', () => {
    driver.when.appTsconfigGenerated();

    expect(driver.get.tsconfig()).toEqual({
      extends: './tsconfig.json',
      compilerOptions: { outDir: './out-tsc/app' },
      files: ['src/main.ts', 'atlas.config.ts'],
      include: ['src/**/*.ts', '.atlas/**/*.ts'],
    });
  });
});

describe('renderAngularFederationConfig', () => {
  let driver: AngularWorkspaceGeneratorDriver;

  beforeEach(() => {
    driver = new AngularWorkspaceGeneratorDriver();
  });

  describe('when major uses the v4 config api', () => {
    beforeEach(() => {
      driver.given.profile(anAngularVersionProfile({ major: 22 }));
    });

    it('should write an esm config file when generated', () => {
      driver.when.federationConfigGenerated();

      expect(driver.get.federationConfigFile()).toBe('federation.config.mjs');
    });

    it('should call the v4 factory with the remote name, exposure and native federation package when type is host', () => {
      driver.given
        .name('orders-host')
        .given.type('host')
        .when.federationConfigGenerated();

      expect(driver.get.federationConfig()).toBe(
        `import { createAngularV4FederationConfig } from "@atlas/sdk/federation-config";

export default await createAngularV4FederationConfig({
  projectRoot: import.meta.dirname,
  name: "atlas_orders_host",
  expose: "host",
  nativeFederationPackage: "@angular-architects/native-federation",
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: []
});
`,
      );
    });

    it('should expose the app when type is app', () => {
      driver.given.type('app').when.federationConfigGenerated();

      expect(driver.get.federationConfig()).toContain('expose: "app"');
    });
  });

  it('should name the v4 native federation package when major uses the v4 package', () => {
    driver.given
      .profile(anAngularVersionProfile({ major: 20 }))
      .when.federationConfigGenerated();

    expect(driver.get.federationConfig()).toContain(
      'nativeFederationPackage: "@angular-architects/native-federation-v4"',
    );
  });

  describe('when major uses the legacy config api', () => {
    beforeEach(() => {
      driver.given.profile(anAngularVersionProfile({ major: 19 }));
    });

    it('should write a commonjs config file when generated', () => {
      driver.when.federationConfigGenerated();

      expect(driver.get.federationConfigFile()).toBe('federation.config.js');
    });

    it('should call the legacy factory with the remote name and exposure when type is app', () => {
      driver.given
        .name('orders-app')
        .given.type('app')
        .when.federationConfigGenerated();

      expect(driver.get.federationConfig()).toBe(
        `const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "atlas_orders_app",
  expose: "app",
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: []
});
`,
      );
    });

    it('should expose the host when type is host', () => {
      driver.given.type('host').when.federationConfigGenerated();

      expect(driver.get.federationConfig()).toContain('expose: "host"');
    });
  });
});
