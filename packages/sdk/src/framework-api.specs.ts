import { FrameworkApiDriver } from './framework-api.driver.js';

const FRAMEWORKS = ['angular', 'react'];
const SHARED_API_NAMES = [
  'defineApp',
  'defineExportedWidget',
  'createHostNavigation',
];
const FRAMEWORK_SPECIFIC_API = [
  ['angular', 'injectAtlasSdk'],
  ['angular', 'provideAtlasSdk'],
  ['angular', 'WidgetOutlet'],
  ['react', 'useAtlasSdk'],
  ['react', 'AtlasSdkProvider'],
];
const SHARED_SUBPATHS = ['./federation', './federation-config'];

describe('framework subpaths', () => {
  let driver: FrameworkApiDriver;

  beforeEach(() => {
    driver = new FrameworkApiDriver();
  });

  it.each(
    FRAMEWORKS.flatMap((framework) =>
      SHARED_API_NAMES.map((name) => [framework, name]),
    ),
  )(
    'should export a function when %s is asked for shared api %s',
    (framework, name) => {
      expect(typeof driver.get.exportedMember(framework, name)).toBe(
        'function',
      );
    },
  );

  it.each(FRAMEWORK_SPECIFIC_API)(
    'should export a function when %s is asked for %s',
    (framework, name) => {
      expect(typeof driver.get.exportedMember(framework, name)).toBe(
        'function',
      );
    },
  );

  it.each(FRAMEWORKS)(
    'should not repeat the framework name in export names when %s subpath is inspected',
    (framework) => {
      expect(driver.get.exportNames(framework)).not.toContainEqual(
        expect.stringMatching(/Angular|React|Vue/),
      );
    },
  );

  it('should keep the typed event and widget contracts compiling when the suite is type-checked', () => {
    expect(driver.get.typeContracts()).toHaveLength(2);
  });

  describe('when package.json is read', () => {
    beforeEach(async () => {
      await driver.when.packageRead();
    });

    it.each(SHARED_SUBPATHS)(
      'should declare %s when package exports are read',
      (subpath) => {
        expect(driver.get.subpath(subpath)).toBeDefined();
      },
    );

    it('should not declare a vue subpath when package exports are read', () => {
      expect(driver.get.subpath('./vue')).toBeUndefined();
    });

    it('should accept every installed vite version as optional peer when peers are read', () => {
      expect(driver.get.vitePeer()).toEqual({ range: '*', optional: true });
    });
  });
});
