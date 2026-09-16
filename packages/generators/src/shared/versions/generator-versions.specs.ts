import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import { GeneratorVersionsDriver } from './generator-versions.driver.js';
import {
  atlasPackageRange,
  ATLAS_PACKAGE_VERSION,
} from './generator-versions.js';

const VERIFIED_REACT_MAJORS = [17, 18, 19];
const VERIFIED_ANGULAR_MAJORS = [19, 20, 21, 22];

describe('reactVersionProfile', () => {
  let driver: GeneratorVersionsDriver;

  beforeEach(() => {
    driver = new GeneratorVersionsDriver();
  });

  it('should resolve the default react version when framework version is omitted', () => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: undefined }))
      .when.reactProfileResolved();

    expect(driver.get.reactProfile()).toEqual({
      version: '19.2.8',
      major: 19,
      routerVersion: '^7.9.0',
    });
  });

  it.each(['^', '~', '='])(
    'should strip the %s prefix when framework version is an exact semver',
    (prefix) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion: `${prefix}18.3.1` }))
        .when.reactProfileResolved();

      expect(driver.get.reactProfile().version).toBe('18.3.1');
    },
  );

  it('should keep the range when framework version is not an exact semver', () => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: '>=18.0.0 <19.0.0' }))
      .when.reactProfileResolved();

    expect(driver.get.reactProfile().version).toBe('>=18.0.0 <19.0.0');
  });

  it.each(VERIFIED_REACT_MAJORS)(
    'should resolve major %s when framework version is a verified major',
    (major) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion: `${major}.0.0` }))
        .when.reactProfileResolved();

      expect(driver.get.reactProfile().major).toBe(major);
    },
  );

  it('should pin react router 6 when major is 17', () => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: '17.0.2' }))
      .when.reactProfileResolved();

    expect(driver.get.reactProfile().routerVersion).toBe('^6.30.1');
  });

  it.each([18, 19])('should pin react router 7 when major is %s', (major) => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: `${major}.0.0` }))
      .when.reactProfileResolved();

    expect(driver.get.reactProfile().routerVersion).toBe('^7.9.0');
  });

  it('should throw when major is not verified and unsupported versions are not allowed', () => {
    driver.given.options(
      aGeneratorOptions({
        frameworkVersion: '16.14.0',
        allowUnsupportedVersion: false,
      }),
    );

    expect(() => driver.when.reactProfileResolved()).toThrow(
      'React 16 is not verified by Atlas. Suggested actions: 1) Pass --framework-version with a verified React major (17, 18, 19). 2) Pass --allow-unsupported-version to generate it anyway with the nearest verified companion versions.',
    );
  });

  it('should pin react router 6 when major is below 17 and unsupported versions are allowed', () => {
    driver.given
      .options(
        aGeneratorOptions({
          frameworkVersion: '16.14.0',
          allowUnsupportedVersion: true,
        }),
      )
      .when.reactProfileResolved();

    expect(driver.get.reactProfile().routerVersion).toBe('^6.30.1');
  });

  it.each(['latest', 'next', 'abc'])(
    'should throw when framework version is %s',
    (frameworkVersion) => {
      driver.given.options(aGeneratorOptions({ frameworkVersion }));

      expect(() => driver.when.reactProfileResolved()).toThrow(
        `Invalid React framework version "${frameworkVersion}". Suggested action: Pass --framework-version with a React version or range, for example 19.2.8 or ^19.0.0.`,
      );
    },
  );
});

describe('angularVersionProfile', () => {
  let driver: GeneratorVersionsDriver;

  beforeEach(() => {
    driver = new GeneratorVersionsDriver();
  });

  it('should resolve the default angular version when framework version is omitted', () => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: undefined }))
      .when.angularProfileResolved();

    expect(driver.get.angularProfile()).toEqual({
      version: '20.3.0',
      major: 20,
      typescript: '>=5.8.0 <6.0.0',
      zone: '^0.15.0',
      zoneless: true,
      requiresZonelessProvider: true,
    });
  });

  it.each(VERIFIED_ANGULAR_MAJORS)(
    'should resolve major %s when framework version is a verified major',
    (major) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion: `${major}.0.0` }))
        .when.angularProfileResolved();

      expect(driver.get.angularProfile().major).toBe(major);
    },
  );

  it.each([
    [19, '>=5.5.0 <5.9.0', '^0.15.0'],
    [20, '>=5.8.0 <6.0.0', '^0.15.0'],
    [21, '>=5.9.0 <6.0.0', '^0.15.0'],
    [22, '>=6.0.0 <6.1.0', '^0.16.0'],
  ])(
    'should resolve companion versions when major is %s',
    (major, typescript, zone) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion: `${major}.0.0` }))
        .when.angularProfileResolved();

      expect(driver.get.angularProfile()).toMatchObject({ typescript, zone });
    },
  );

  it('should keep the range as version when framework version is a range', () => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: '^21.0.0' }))
      .when.angularProfileResolved();

    expect(driver.get.angularProfile().version).toBe('^21.0.0');
  });

  it.each(['19.2.0', '20.0.0', '20.1.5'])(
    'should mark the profile zoneful when framework version is %s',
    (frameworkVersion) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion }))
        .when.angularProfileResolved();

      expect(driver.get.angularProfile().zoneless).toBe(false);
    },
  );

  it.each(['20.2.0', '20.10.1', '21.0.0', '22.0.0'])(
    'should mark the profile zoneless when framework version is %s',
    (frameworkVersion) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion }))
        .when.angularProfileResolved();

      expect(driver.get.angularProfile().zoneless).toBe(true);
    },
  );

  it('should require the zoneless provider when framework version is a zoneless 20 release', () => {
    driver.given
      .options(aGeneratorOptions({ frameworkVersion: '20.2.0' }))
      .when.angularProfileResolved();

    expect(driver.get.angularProfile().requiresZonelessProvider).toBe(true);
  });

  it.each(['20.0.0', '21.0.0'])(
    'should not require the zoneless provider when framework version is %s',
    (frameworkVersion) => {
      driver.given
        .options(aGeneratorOptions({ frameworkVersion }))
        .when.angularProfileResolved();

      expect(driver.get.angularProfile().requiresZonelessProvider).toBe(false);
    },
  );

  it('should throw when major is not verified and unsupported versions are not allowed', () => {
    driver.given.options(
      aGeneratorOptions({
        frameworkVersion: '18.2.0',
        allowUnsupportedVersion: false,
      }),
    );

    expect(() => driver.when.angularProfileResolved()).toThrow(
      'Angular 18 is not verified by Atlas. Suggested actions: 1) Pass --framework-version with a verified Angular major (19, 20, 21, 22). 2) Pass --allow-unsupported-version to generate it anyway with the nearest verified companion versions.',
    );
  });

  it('should use the companions of the nearest higher verified major when major is below the matrix and unsupported versions are allowed', () => {
    driver.given
      .options(
        aGeneratorOptions({
          frameworkVersion: '18.2.0',
          allowUnsupportedVersion: true,
        }),
      )
      .when.angularProfileResolved();

    expect(driver.get.angularProfile()).toMatchObject({
      major: 18,
      typescript: '>=5.5.0 <5.9.0',
      zone: '^0.15.0',
    });
  });

  it('should use the companions of the nearest lower verified major when major is above the matrix and unsupported versions are allowed', () => {
    driver.given
      .options(
        aGeneratorOptions({
          frameworkVersion: '24.0.0',
          allowUnsupportedVersion: true,
        }),
      )
      .when.angularProfileResolved();

    expect(driver.get.angularProfile()).toMatchObject({
      major: 24,
      typescript: '>=6.0.0 <6.1.0',
      zone: '^0.16.0',
    });
  });

  it('should throw when framework version does not start with a major', () => {
    driver.given.options(aGeneratorOptions({ frameworkVersion: 'latest' }));

    expect(() => driver.when.angularProfileResolved()).toThrow(
      'Invalid Angular framework version "latest". Suggested action: Pass --framework-version with an Angular version or range, for example 20.3.0 or ^20.0.0.',
    );
  });
});

describe('exactSemver', () => {
  let driver: GeneratorVersionsDriver;

  beforeEach(() => {
    driver = new GeneratorVersionsDriver();
  });

  it.each(['1.2.3', '^1.2.3', '~1.2.3', '=1.2.3', '1.2.3-beta.1'])(
    'should return the bare version when input is %s',
    (input) => {
      driver.when.exactSemverResolved(input);

      expect(driver.get.exactVersion()).toBe(input.replace(/^[=~^]/, ''));
    },
  );

  it.each(['1', '1.2', '>=1.2.3', '1.2.3 || 2.0.0', 'latest'])(
    'should return undefined when input is %s',
    (input) => {
      driver.when.exactSemverResolved(input);

      expect(driver.get.exactVersion()).toBeUndefined();
    },
  );
});

describe('atlasPackageRange', () => {
  it('should return a caret range of the atlas package version when called', () => {
    expect(atlasPackageRange()).toBe(`^${ATLAS_PACKAGE_VERSION}`);
  });
});

describe('ATLAS_PACKAGE_VERSION', () => {
  it('should be an exact semver when read', () => {
    expect(ATLAS_PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
