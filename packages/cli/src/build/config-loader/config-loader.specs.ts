import { faker } from '@faker-js/faker';
import { ConfigLoaderDriver } from './config-loader.driver.js';

describe('loadCompiledAtlasConfig', () => {
  let driver: ConfigLoaderDriver;

  beforeEach(async () => {
    driver = new ConfigLoaderDriver();

    await driver.given.projectRoot();
  });

  it('should prefer .atlas/atlas.config.js when several candidates exist', async () => {
    const id = faker.string.uuid();
    await driver.given.compiledConfig(
      '.atlas/atlas.config.js',
      `export default { id: '${id}', framework: 'react' };`,
    );
    await driver.given.compiledConfig(
      'dist/atlas.config.js',
      `export default { id: '${faker.string.uuid()}', framework: 'react' };`,
    );

    expect((await driver.get.config()).id).toBe(id);
  });

  it('should fall back to dist/atlas.config.js when .atlas output is absent', async () => {
    const id = faker.string.uuid();
    await driver.given.compiledConfig(
      'dist/atlas.config.js',
      `export default { id: '${id}', framework: 'react' };`,
    );

    expect((await driver.get.config()).id).toBe(id);
  });

  it('should unwrap a nested default export when the module is CommonJS-shaped', async () => {
    const id = faker.string.uuid();
    await driver.given.compiledConfig(
      'atlas.config.js',
      `export default { default: { id: '${id}', framework: 'angular' } };`,
    );

    expect((await driver.get.config()).id).toBe(id);
  });

  it('should reject with config-invalid code when the default export is not a config', async () => {
    await driver.given.compiledConfig('atlas.config.js', 'export default 42;');

    await expect(driver.get.config()).rejects.toMatchObject({
      code: 'ATLAS_CONFIG_INVALID',
    });
  });

  it('should reject with not-compiled code when no candidate exists', async () => {
    await expect(driver.get.config()).rejects.toMatchObject({
      code: 'ATLAS_CONFIG_NOT_COMPILED',
    });
  });
});
