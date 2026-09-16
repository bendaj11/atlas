import { RegistryConfigDriver } from './registry-config.driver.js';

describe('loadAtlasRegistryConfig', () => {
  let driver: RegistryConfigDriver;

  beforeEach(async () => {
    driver = new RegistryConfigDriver();

    await driver.given.workingDirectory();
  });

  it('should return undefined when atlas.registry.ts is absent and no flag is given', async () => {
    expect(await driver.get.config()).toBeUndefined();
  });

  it('should reject when --registry-config names a missing file', async () => {
    driver.given.flags(['--registry-config=missing.ts']);

    await expect(driver.get.config()).rejects.toMatchObject({
      code: 'ATLAS_REGISTRY_CONFIG_MISSING',
    });
  });

  describe('when atlas.registry.ts exports a config', () => {
    beforeEach(async () => {
      await driver.given.configFile(
        'atlas.registry.ts',
        "export default { hostUrls: ['https://a.example'], invalidate: async () => undefined };\n",
      );
    });

    it('should load the default export when compiled', async () => {
      expect(await driver.get.config()).toMatchObject({
        hostUrls: ['https://a.example'],
        invalidate: expect.any(Function),
      });
    });

    it('should remove the compilation directory when loaded', async () => {
      await driver.get.config();

      expect(await driver.get.leftoverDirectories()).toStrictEqual([]);
    });
  });

  it('should reject when the default export is not a registry config', async () => {
    await driver.given.configFile(
      'atlas.registry.ts',
      'export default { hostUrls: 42 };\n',
    );

    await expect(driver.get.config()).rejects.toThrow(
      /must default-export an AtlasRegistryConfig object/,
    );
  });

  it('should reject with the TypeScript diagnostic when the file does not parse', async () => {
    await driver.given.configFile('atlas.registry.ts', 'export default {\n');

    await expect(driver.get.config()).rejects.toThrow(/expected/);
  });

  it('should honor --registry-config when it names another file', async () => {
    await driver.given.configFile(
      'custom.ts',
      'export default { hostUrls: [] };\n',
    );
    driver.given.flags(['--registry-config=custom.ts']);

    expect(await driver.get.config()).toStrictEqual({ hostUrls: [] });
  });
});
