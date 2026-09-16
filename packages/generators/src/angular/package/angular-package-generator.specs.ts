import { faker } from '@faker-js/faker';
import { ATLAS_PACKAGE_VERSION } from '../../shared/versions/generator-versions.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import {
  anAngularVersionProfile,
  aSemver,
} from '../../testkit/version-profiles.testkit.js';
import { AngularPackageGeneratorDriver } from './angular-package-generator.driver.js';

const ANGULAR_DEPENDENCIES = [
  '@angular/animations',
  '@angular/common',
  '@angular/compiler',
  '@angular/core',
  '@angular/platform-browser',
];
const ANGULAR_DEV_DEPENDENCIES = [
  '@angular-devkit/build-angular',
  '@angular/cli',
  '@angular/compiler-cli',
];

describe('angularPackage', () => {
  let driver: AngularPackageGeneratorDriver;

  beforeEach(() => {
    driver = new AngularPackageGeneratorDriver();
  });

  it('should name the package after the package name when packaged', () => {
    const packageName = anAtlasId();
    driver.given.packageName(packageName).when.packaged();

    expect(driver.get.manifest().name).toBe(packageName);
  });

  it('should start at version 0.1.0 as a private package when packaged', () => {
    driver.when.packaged();

    expect(driver.get.manifest()).toMatchObject({
      version: '0.1.0',
      private: true,
    });
  });

  it('should include an empty previews list when packaged', () => {
    driver.when.packaged();

    expect(driver.get.manifest().atlas).toEqual({ previews: [] });
  });

  it('should pin the typescript range of the profile when packaged', () => {
    const profile = anAngularVersionProfile();
    driver.given.profile(profile).when.packaged();

    expect(driver.get.manifest().devDependencies.typescript).toBe(
      profile.typescript,
    );
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

  it.each([...ANGULAR_DEPENDENCIES, ...ANGULAR_DEV_DEPENDENCIES])(
    'should caret the exact profile version for %s when profile version is exact',
    (dependency) => {
      const version = aSemver();
      driver.given
        .profile(anAngularVersionProfile({ version }))
        .when.packaged();

      expect({
        ...driver.get.manifest().dependencies,
        ...driver.get.manifest().devDependencies,
      }).toMatchObject({ [dependency]: `^${version}` });
    },
  );

  it('should keep the profile version range for angular packages when profile version is a range', () => {
    driver.given
      .profile(anAngularVersionProfile({ version: '>=20.0.0 <21.0.0' }))
      .when.packaged();

    expect(driver.get.manifest().dependencies['@angular/core']).toBe(
      '>=20.0.0 <21.0.0',
    );
  });

  it('should pin the native federation package to the profile major when packaged', () => {
    driver.given
      .profile(anAngularVersionProfile({ major: 22 }))
      .when.packaged();

    expect(
      driver.get.manifest().dependencies[
        '@angular-architects/native-federation'
      ],
    ).toBe('^22.0.0');
  });

  it('should add the softarc native federation peer when major uses the v4 package', () => {
    driver.given
      .profile(anAngularVersionProfile({ major: 20 }))
      .when.packaged();

    expect(driver.get.manifest().dependencies).toMatchObject({
      '@angular-architects/native-federation-v4': '^20.0.0',
      '@softarc/native-federation': '^4.3.2',
    });
  });

  it('should omit the softarc native federation peer when major uses the main package', () => {
    driver.given
      .profile(anAngularVersionProfile({ major: 22 }))
      .when.packaged();

    expect(driver.get.manifest().dependencies).not.toHaveProperty(
      '@softarc/native-federation',
    );
  });

  it('should add zone.js at the profile zone range when profile is zoneful', () => {
    const profile = anAngularVersionProfile({ zoneless: false });
    driver.given.profile(profile).when.packaged();

    expect(driver.get.manifest().dependencies['zone.js']).toBe(profile.zone);
  });

  it('should omit zone.js when profile is zoneless', () => {
    driver.given
      .profile(anAngularVersionProfile({ zoneless: true }))
      .when.packaged();

    expect(driver.get.manifest().dependencies).not.toHaveProperty('zone.js');
  });

  it('should write atlas scripts including bootstrap when type is host', () => {
    const projectName = anAtlasId();
    driver.given.type('host').given.projectName(projectName).when.packaged();

    expect(driver.get.manifest().scripts).toEqual({
      dev: `atlas dev ${projectName}`,
      'framework:dev': `ng serve ${projectName}`,
      'atlas:config': `atlas compile-config ${projectName}`,
      build: 'ng build',
      'atlas:publish': `atlas publish ${projectName}`,
      'atlas:bootstrap': `atlas bootstrap ${projectName} --skip-compile`,
    });
  });

  describe('when type is host', () => {
    beforeEach(() => {
      driver.given.type('host').when.packaged();
    });

    it('should add the atlas runtime dependency when packaged', () => {
      expect(driver.get.manifest().dependencies['@atlas/runtime']).toBe(
        `^${ATLAS_PACKAGE_VERSION}`,
      );
    });

    it('should add node types when packaged', () => {
      expect(driver.get.manifest().devDependencies['@types/node']).toBe(
        '^22.0.0',
      );
    });
  });

  it('should add the angular router when type is host and routed is false', () => {
    driver.given.type('host').given.routed(false).when.packaged();

    expect(driver.get.manifest().dependencies).toHaveProperty(
      '@angular/router',
    );
  });

  it('should write atlas scripts without bootstrap when type is app', () => {
    const projectName = anAtlasId();
    driver.given.type('app').given.projectName(projectName).when.packaged();

    expect(driver.get.manifest().scripts).toEqual({
      dev: `atlas dev ${projectName}`,
      'framework:dev': `ng serve ${projectName}`,
      'atlas:config': `atlas compile-config ${projectName}`,
      build: 'ng build',
      'atlas:publish': `atlas publish ${projectName}`,
    });
  });

  describe('when type is app', () => {
    beforeEach(() => {
      driver.given.type('app').when.packaged();
    });

    it('should omit the atlas runtime dependency when packaged', () => {
      expect(driver.get.manifest().dependencies).not.toHaveProperty(
        '@atlas/runtime',
      );
    });

    it('should omit node types when packaged', () => {
      expect(driver.get.manifest().devDependencies).not.toHaveProperty(
        '@types/node',
      );
    });
  });

  it.each([true, undefined])(
    'should add the angular router when type is app and routed is %s',
    (routed) => {
      driver.given.type('app').given.routed(routed).when.packaged();

      expect(driver.get.manifest().dependencies).toHaveProperty(
        '@angular/router',
      );
    },
  );

  it('should omit the angular router when type is app and routed is false', () => {
    driver.given.type('app').given.routed(false).when.packaged();

    expect(driver.get.manifest().dependencies).not.toHaveProperty(
      '@angular/router',
    );
  });
});

describe('angularIndex', () => {
  let driver: AngularPackageGeneratorDriver;

  beforeEach(() => {
    driver = new AngularPackageGeneratorDriver();
  });

  it('should write the page title and body into the document when generated', () => {
    const pageTitle = faker.company.name();
    const body = `<${anAtlasId()}></${anAtlasId()}>`;
    driver.when.indexGenerated({ pageTitle, body });

    expect(driver.get.html()).toBe(
      `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${pageTitle}</title>\n  <base href="/">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`,
    );
  });
});
