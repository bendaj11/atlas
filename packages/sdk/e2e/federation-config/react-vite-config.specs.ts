import { ReactViteConfigDriver } from './react-vite-config.driver.js';

const IGNORED_SPECIFIERS = [
  'types-only',
  'unused-lib',
  'comment-only',
  '@company/design-system/theme',
  'peer-lib',
  'side-effects',
  'style-lib/styles.css',
];
const BUNDLED_SOURCES = ['@company/design-system', 'unused-lib', './feature'];
const RELOADING_SOURCES = ['src/entry.tsx', 'src/app/OrderSummary.tsx'];

describe('createReactWidgetEntries', () => {
  let driver: ReactViteConfigDriver;

  beforeEach(() => {
    driver = new ReactViteConfigDriver();
    driver.given.exampleProject('apps/catalog-react');
  });

  it('should write a widget entry that defines the exported widget when React 19 is targeted', async () => {
    driver.given.reactMajor(19);

    await driver.when.widgetEntriesCreated();

    expect(await driver.get.widgetEntrySource('product-count')).toMatch(
      /defineExportedWidget[\s\S]*src\/exported-widgets\/product-count\/index/,
    );
  });

  it('should use the legacy react-dom root when React 17 is targeted', async () => {
    driver.given.reactMajor(17);

    await driver.when.widgetEntriesCreated();

    expect(await driver.get.widgetEntrySource('product-count')).toMatch(
      /unmountComponentAtNode/,
    );
  });

  it('should not import the client root when React 17 is targeted', async () => {
    driver.given.reactMajor(17);

    await driver.when.widgetEntriesCreated();

    expect(await driver.get.widgetEntrySource('product-count')).not.toMatch(
      /react-dom\/client/,
    );
  });
});

describe('createReactAppViteConfig', () => {
  let driver: ReactViteConfigDriver;

  beforeEach(() => {
    driver = new ReactViteConfigDriver();
  });

  describe('when an empty React app with one widget is configured', () => {
    beforeEach(async () => {
      await driver.given.emptyProject();

      driver.when.appConfigCreated();
    });

    it('should register the Atlas plugins in order when configured', () => {
      expect(driver.get.pluginNames()).toStrictEqual([
        'atlas-react-shared-fallbacks',
        'atlas-react-source-reload',
        'atlas-federation-build-notifications',
        'atlas-native-federation-metadata',
      ]);
    });

    it('should write a development facade for the entry when configured', async () => {
      expect(
        await driver.get.projectFile('.atlas/react-development/entry.ts'),
      ).toBe(
        'import "@vitejs/plugin-react/preamble";\nexport { default } from "../../src/bootstrap.tsx";\n',
      );
    });

    it('should use the entry and the widget as rollup inputs when configured', () => {
      expect(driver.get.rollupInputNames()).toStrictEqual([
        'entry',
        'widgets/summary',
      ]);
    });

    it.each(RELOADING_SOURCES)(
      'should send a full reload when %s changes',
      (file) => {
        driver.when.hotUpdateHandled(file);

        expect(driver.get.sendMock()).toHaveBeenCalledWith({
          type: 'full-reload',
          path: '*',
        });
      },
    );

    it('should stop HMR propagation when a source file changes', () => {
      driver.when.hotUpdateHandled('src/entry.tsx');

      expect(driver.get.hotUpdateResult()).toStrictEqual([]);
    });

    it('should leave HMR untouched when a non-source file changes', () => {
      driver.when.hotUpdateHandled('README.md');

      expect(driver.get.sendMock()).not.toHaveBeenCalled();
    });
  });

  describe('when the automatic sharing fixture is configured', () => {
    beforeEach(async () => {
      await driver.given.fixtureProject();

      driver.when.appConfigCreated();
    });

    it('should share framework packages and every imported declared specifier when configured', () => {
      expect(driver.get.sharedPackageNames()).toStrictEqual([
        '@atlas/sdk',
        '@atlas/sdk/federation',
        '@atlas/sdk/host',
        '@atlas/sdk/lifecycle',
        '@atlas/sdk/navigation',
        '@atlas/sdk/react',
        '@company/design-system/button',
        'cjs-lib',
        'lazy-lib/modal',
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'react/jsx-runtime',
      ]);
    });

    it.each(IGNORED_SPECIFIERS)(
      'should not share %s when it is type-only, side-effect-only, commented or unused',
      (specifier) => {
        expect(driver.get.sharedPackageNames()).not.toContain(specifier);
      },
    );

    it('should externalize a discovered exact entry point when the build resolves it', () => {
      expect(driver.get.external('@company/design-system/button')).toBe(true);
    });

    it.each(BUNDLED_SOURCES)(
      'should bundle %s when it is not a shared entry point',
      (source) => {
        expect(driver.get.external(source)).toBe(false);
      },
    );

    it('should map a discovered dependency to its Vite id in development metadata when served', () => {
      expect(
        driver.get
          .servedMetadata('atlas-native-federation-metadata')
          .shared.find(
            ({ packageName }) =>
              packageName === '@company/design-system/button',
          ),
      ).toEqual(
        expect.objectContaining({
          outFileName: '@id/@company/design-system/button',
          requiredVersion: '^4.2.0',
          singleton: true,
          strictVersion: true,
          version: '4.2.3',
        }),
      );
    });

    describe('when the production build runs', () => {
      beforeEach(async () => {
        await driver.when.productionBuilt();
      });

      it('should emit every shared fallback referenced by the metadata when built', async () => {
        const metadata = JSON.parse(
          await driver.get.projectFile('dist/remoteEntry.json'),
        ) as { shared: Array<{ outFileName: string }> };

        expect(
          await driver.get.missingDistFiles(
            metadata.shared.map(({ outFileName }) => outFileName),
          ),
        ).toEqual([]);
      });

      it('should keep shared imports external in the entry bundle when built', async () => {
        expect(await driver.get.projectFile('dist/entry.js')).toMatch(
          /from"@company\/design-system\/button"/,
        );
      });

      it('should expose CommonJS named exports from the shared fallback when built', async () => {
        expect(await driver.get.distModule('shared/cjs-lib.js')).toMatchObject({
          named: 'named CommonJS export',
          default: expect.objectContaining({ named: 'named CommonJS export' }),
        });
      });
    });
  });

  it('should bundle a package when the skip option matches it', async () => {
    await driver.given.fixtureProject();
    driver.given.skip([
      (packageName) =>
        packageName === '@company/design-system' ||
        packageName.startsWith('@company/design-system/'),
    ]);

    driver.when.appConfigCreated();

    expect(driver.get.external('@company/design-system/button')).toBe(false);
  });

  it('should throw ATLAS_SHARED_ENTRY_NOT_EXPORTED when an imported package subpath is missing', async () => {
    await driver.given.fixtureProject();
    await driver.given.entrySource(
      'import { missing } from "unused-lib/missing"; export default missing;\n',
    );

    expect(() => driver.when.appConfigCreated()).toThrow(
      expect.objectContaining({
        code: 'ATLAS_SHARED_ENTRY_NOT_EXPORTED',
        message: expect.stringContaining(
          'Atlas could not resolve shared dependency entry "unused-lib/missing".',
        ),
      }),
    );
  });
});

describe('createReactHostViteConfig', () => {
  let driver: ReactViteConfigDriver;

  beforeEach(() => {
    driver = new ReactViteConfigDriver();
  });

  describe('when the React host example is configured', () => {
    beforeEach(() => {
      driver.given
        .exampleProject('hosts/demo-react-host')
        .when.hostConfigCreated();
    });

    it('should write a development facade re-exporting the bootstrap when configured', async () => {
      expect(
        await driver.get.projectFile('.atlas/react-development/host.ts'),
      ).toBe(
        'import "@vitejs/plugin-react/preamble";\nexport * from "../../src/bootstrap.tsx";\n',
      );
    });

    it('should serve the remote name derived from the project name when metadata is requested', () => {
      expect(driver.get.servedMetadata('atlas-host-metadata').name).toBe(
        'atlas_demo_react_host',
      );
    });

    it('should serve the development host facade as the host expose when metadata is requested', () => {
      expect(
        driver.get.servedMetadata('atlas-host-metadata').exposes,
      ).toStrictEqual([
        { key: './host', outFileName: '.atlas/react-development/host.ts' },
      ]);
    });

    it('should share the React framework packages by Vite id when metadata is requested', () => {
      expect(driver.get.servedMetadata('atlas-host-metadata').shared).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            packageName: 'react',
            outFileName: '@id/react',
            singleton: true,
            strictVersion: true,
          }),
          expect.objectContaining({ packageName: '@atlas/sdk/react' }),
        ]),
      );
    });
  });
});
