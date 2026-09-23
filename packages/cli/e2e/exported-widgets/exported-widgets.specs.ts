import { faker } from '@faker-js/faker';
import { ExportedWidgetsDriver } from './exported-widgets.driver.js';

describe('discoverExportedWidgets', () => {
  let driver: ExportedWidgetsDriver;

  beforeEach(async () => {
    driver = new ExportedWidgetsDriver();

    await driver.given.projectRoot();
  });

  it('should return no widgets when the exported-widgets directory is absent', async () => {
    expect(await driver.get.widgets(faker.internet.url())).toStrictEqual([]);
  });

  it('should describe each widget sorted by name when configs are valid', async () => {
    const remoteEntryUrl = faker.internet.url();
    const id = faker.string.uuid();
    const name = faker.commerce.productName();
    driver.given.framework('react');
    await driver.given.widgetFile('zeta', 'index.tsx');
    await driver.given.widgetFile(
      'zeta',
      'atlas.config.ts',
      `export default { id: '${faker.string.uuid()}', name: 'Z' };`,
    );
    await driver.given.widgetFile('alpha', 'index.tsx');
    await driver.given.widgetFile(
      'alpha',
      'atlas.config.ts',
      `export default { id: '${id}', name: '${name}' };`,
    );

    expect(await driver.get.widgets(remoteEntryUrl)).toStrictEqual([
      {
        schemaVersion: '1',
        id,
        name,
        ownerAppId: driver.get.configId(),
        framework: 'react',
        remoteEntryUrl,
        expose: './widgets/alpha',
        contractVersion: '1',
      },
      expect.objectContaining({ expose: './widgets/zeta' }),
    ]);
  });

  it('should require index.ts when framework is angular', async () => {
    driver.given.framework('angular');
    await driver.given.widgetFile('alpha', 'index.tsx');

    await expect(driver.get.widgets(faker.internet.url())).rejects.toThrow(
      'Exported widget "alpha" must contain src/exported-widgets/alpha/index.ts.',
    );
  });

  it('should reject with generation hint when atlas.config.ts is missing', async () => {
    await driver.given.widgetFile('alpha', 'index.tsx');

    await expect(driver.get.widgets(faker.internet.url())).rejects.toThrow(
      `Run atlas g widget alpha --app-id=${driver.get.configId()}`,
    );
  });

  it('should reject when the widget config id is not a UUIDv4', async () => {
    await driver.given.widgetFile('alpha', 'index.tsx');
    await driver.given.widgetFile(
      'alpha',
      'atlas.config.ts',
      "export default { id: 'not-a-uuid', name: 'Alpha' };",
    );

    await expect(driver.get.widgets(faker.internet.url())).rejects.toThrow(
      /must export \{ id: UUIDv4, name: string \} as default/,
    );
  });
});
