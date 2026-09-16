import { OverlayDriver } from './overlay.driver.js';

describe('generatedOverlay', () => {
  let driver: OverlayDriver;

  beforeEach(() => {
    driver = new OverlayDriver();
  });

  it('should keep every file when the workspace did not scaffold', () => {
    driver.given.files(['package.json', 'atlas.config.ts', 'anything.txt']);

    expect(
      driver.get.overlayPaths({
        workspaceScaffolded: false,
        type: 'app',
        framework: 'react',
      }),
    ).toStrictEqual(['package.json', 'atlas.config.ts', 'anything.txt']);
  });

  it('should keep only Atlas integration files for a scaffolded react app', () => {
    driver.given.files([
      'package.json',
      'atlas.config.ts',
      'src/App.tsx',
      'src/unrelated.tsx',
    ]);

    expect(
      driver.get.overlayPaths({
        workspaceScaffolded: true,
        type: 'app',
        framework: 'react',
      }),
    ).toStrictEqual(['atlas.config.ts', 'src/App.tsx']);
  });

  it('should keep the bootstrap template for a scaffolded host', () => {
    driver.given.files(['atlas.bootstrap.html', 'src/main.tsx']);

    expect(
      driver.get.overlayPaths({
        workspaceScaffolded: true,
        type: 'host',
        framework: 'react',
      }),
    ).toStrictEqual(['atlas.bootstrap.html', 'src/main.tsx']);
  });

  it('should keep the angular global stylesheet in any format when scaffolded', () => {
    driver.given.files(['src/styles.scss', 'src/other.scss']);

    expect(
      driver.get.overlayPaths({
        workspaceScaffolded: true,
        type: 'app',
        framework: 'angular',
      }),
    ).toStrictEqual(['src/styles.scss']);
  });
});
