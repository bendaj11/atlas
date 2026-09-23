import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import { AngularFederationDriver } from './angular-federation.driver.js';

const V4_PACKAGE_MAJORS = [20, 21];
const MAIN_PACKAGE_MAJORS = [18, 19, 22, 23];
const V4_CONFIG_API_MAJORS = [20, 21, 22, 23];
const LEGACY_CONFIG_API_MAJORS = [18, 19];

describe('selectNativeFederationPackage', () => {
  let driver: AngularFederationDriver;

  beforeEach(() => {
    driver = new AngularFederationDriver();
  });

  it.each(V4_PACKAGE_MAJORS)(
    'should return the v4 package when major is %s',
    (major) => {
      driver.given.profile(anAngularVersionProfile({ major }));

      expect(driver.get.package()).toBe(
        '@angular-architects/native-federation-v4',
      );
    },
  );

  it.each(MAIN_PACKAGE_MAJORS)(
    'should return the main package when major is %s',
    (major) => {
      driver.given.profile(anAngularVersionProfile({ major }));

      expect(driver.get.package()).toBe(
        '@angular-architects/native-federation',
      );
    },
  );
});

describe('selectNativeFederationBuilder', () => {
  let driver: AngularFederationDriver;

  beforeEach(() => {
    driver = new AngularFederationDriver();
  });

  it('should suffix the v4 package with build when major uses the v4 package', () => {
    driver.given.profile(anAngularVersionProfile({ major: 20 }));

    expect(driver.get.builder()).toBe(
      '@angular-architects/native-federation-v4:build',
    );
  });

  it('should suffix the main package with build when major uses the main package', () => {
    driver.given.profile(anAngularVersionProfile({ major: 22 }));

    expect(driver.get.builder()).toBe(
      '@angular-architects/native-federation:build',
    );
  });
});

describe('usesNativeFederationV4Package', () => {
  let driver: AngularFederationDriver;

  beforeEach(() => {
    driver = new AngularFederationDriver();
  });

  it.each(V4_PACKAGE_MAJORS)('should return true when major is %s', (major) => {
    driver.given.profile(anAngularVersionProfile({ major }));

    expect(driver.get.usesV4Package()).toBe(true);
  });

  it.each(MAIN_PACKAGE_MAJORS)(
    'should return false when major is %s',
    (major) => {
      driver.given.profile(anAngularVersionProfile({ major }));

      expect(driver.get.usesV4Package()).toBe(false);
    },
  );
});

describe('usesNativeFederationV4ConfigApi', () => {
  let driver: AngularFederationDriver;

  beforeEach(() => {
    driver = new AngularFederationDriver();
  });

  it.each(V4_CONFIG_API_MAJORS)(
    'should return true when major is %s',
    (major) => {
      driver.given.profile(anAngularVersionProfile({ major }));

      expect(driver.get.usesV4ConfigApi()).toBe(true);
    },
  );

  it.each(LEGACY_CONFIG_API_MAJORS)(
    'should return false when major is %s',
    (major) => {
      driver.given.profile(anAngularVersionProfile({ major }));

      expect(driver.get.usesV4ConfigApi()).toBe(false);
    },
  );
});
