import { faker } from '@faker-js/faker';
import { ATLAS_PACKAGE_VERSION } from '../../shared/versions/generator-versions.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { ReactPackageGeneratorDriver } from './react-package-generator.driver.js';

describe('reactPackage', () => {
  let driver: ReactPackageGeneratorDriver;

  beforeEach(() => {
    driver = new ReactPackageGeneratorDriver();
  });

  it('should name the package after the package name when packaged', () => {
    const packageName = anAtlasId();
    driver.given.packageName(packageName).when.packaged();

    expect(driver.get.manifest().name).toBe(packageName);
  });

  it('should start at version 0.1.0 as a private module package when packaged', () => {
    driver.when.packaged();

    expect(driver.get.manifest()).toMatchObject({
      version: '0.1.0',
      private: true,
      type: 'module',
    });
  });

  it('should include an empty previews list when packaged', () => {
    driver.when.packaged();

    expect(driver.get.manifest().atlas).toEqual({ previews: [] });
  });

  it('should pin react and react-dom to the profile version when packaged', () => {
    const profile = aReactVersionProfile();
    driver.given.profile(profile).when.packaged();

    expect(driver.get.manifest().dependencies).toMatchObject({
      react: profile.version,
      'react-dom': profile.version,
    });
  });

  it('should pin react types to the profile major when packaged', () => {
    const profile = aReactVersionProfile();
    driver.given.profile(profile).when.packaged();

    expect(driver.get.manifest().devDependencies).toMatchObject({
      '@types/react': `^${profile.major}.0.0`,
      '@types/react-dom': `^${profile.major}.0.0`,
    });
  });

  it('should pin atlas packages to the atlas package range when packaged', () => {
    driver.when.packaged();

    expect(driver.get.manifest()).toMatchObject({
      dependencies: {
        '@atlas/schema': `^${ATLAS_PACKAGE_VERSION}`,
        '@atlas/sdk': `^${ATLAS_PACKAGE_VERSION}`,
      },
      devDependencies: { '@atlas/cli': `^${ATLAS_PACKAGE_VERSION}` },
    });
  });

  it('should pin vite tooling and typescript when packaged', () => {
    driver.when.packaged();

    expect(driver.get.manifest().devDependencies).toMatchObject({
      '@types/node': '^22.0.0',
      '@vitejs/plugin-react': '^5.0.4',
      typescript: '~5.9.0',
      vite: '^7.3.6',
    });
  });

  it('should write atlas scripts including bootstrap when type is host', () => {
    const projectName = anAtlasId();
    driver.given.type('host').given.projectName(projectName).when.packaged();

    expect(driver.get.manifest().scripts).toEqual({
      dev: `atlas dev ${projectName}`,
      'framework:dev': 'vite --host 0.0.0.0',
      'atlas:config': `atlas compile-config ${projectName}`,
      build: 'tsc -b && vite build',
      'atlas:publish': `atlas publish ${projectName}`,
      'atlas:bootstrap': `atlas bootstrap ${projectName} --skip-compile`,
    });
  });

  it('should write atlas scripts without bootstrap when type is app', () => {
    const projectName = anAtlasId();
    driver.given.type('app').given.projectName(projectName).when.packaged();

    expect(driver.get.manifest().scripts).toEqual({
      dev: `atlas dev ${projectName}`,
      'framework:dev': 'vite --host 0.0.0.0',
      'atlas:config': `atlas compile-config ${projectName}`,
      build: 'tsc -b && vite build',
      'atlas:publish': `atlas publish ${projectName}`,
    });
  });

  it('should add the atlas runtime dependency when type is host', () => {
    driver.given.type('host').when.packaged();

    expect(driver.get.manifest().dependencies['@atlas/runtime']).toBe(
      `^${ATLAS_PACKAGE_VERSION}`,
    );
  });

  it('should omit the atlas runtime dependency when type is app', () => {
    driver.given.type('app').when.packaged();

    expect(driver.get.manifest().dependencies).not.toHaveProperty(
      '@atlas/runtime',
    );
  });

  it('should add react router at the profile router version when type is host and routed is false', () => {
    const profile = aReactVersionProfile();
    driver.given
      .type('host')
      .given.routed(false)
      .given.profile(profile)
      .when.packaged();

    expect(driver.get.manifest().dependencies['react-router-dom']).toBe(
      profile.routerVersion,
    );
  });

  it.each([true, undefined])(
    'should add react router at the profile router version when type is app and routed is %s',
    (routed) => {
      const profile = aReactVersionProfile();
      driver.given
        .type('app')
        .given.routed(routed)
        .given.profile(profile)
        .when.packaged();

      expect(driver.get.manifest().dependencies['react-router-dom']).toBe(
        profile.routerVersion,
      );
    },
  );

  it('should omit react router when type is app and routed is false', () => {
    driver.given.type('app').given.routed(false).when.packaged();

    expect(driver.get.manifest().dependencies).not.toHaveProperty(
      'react-router-dom',
    );
  });
});

describe('reactIndex', () => {
  let driver: ReactPackageGeneratorDriver;

  beforeEach(() => {
    driver = new ReactPackageGeneratorDriver();
  });

  it('should write a shimmed module document with a root element when generated', () => {
    const pageTitle = faker.company.name();
    driver.when.hostIndexGenerated(pageTitle);

    expect(driver.get.html()).toBe(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <script type="esms-options">{ "shimMode": true, "mapOverrides": true }</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);
  });
});

describe('reactAppIndex', () => {
  let driver: ReactPackageGeneratorDriver;

  beforeEach(() => {
    driver = new ReactPackageGeneratorDriver();
  });

  it('should write an empty-bodied document with the page title when generated', () => {
    const pageTitle = faker.company.name();
    driver.when.appIndexGenerated(pageTitle);

    expect(driver.get.html()).toBe(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
  </head>
  <body></body>
</html>
`);
  });
});
