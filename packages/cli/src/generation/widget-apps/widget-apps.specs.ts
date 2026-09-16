import { faker } from '@faker-js/faker';
import { WidgetAppsDriver } from './widget-apps.driver.js';

function appConfig(id: string, name: string, framework = 'react'): string {
  return `export default { id: '${id}', name: '${name}', framework: '${framework}' };\n`;
}

describe('resolveWidgetApp', () => {
  let driver: WidgetAppsDriver;

  beforeEach(async () => {
    driver = new WidgetAppsDriver();

    await driver.given.workspace();
  });

  it('should reject when the workspace has no configured apps', async () => {
    await expect(driver.get.app()).rejects.toThrow(/found no configured apps/);
  });

  describe('when two apps and a host are configured', () => {
    const first = { id: faker.string.uuid(), name: 'Alpha' };
    const second = { id: faker.string.uuid(), name: 'Beta' };

    beforeEach(async () => {
      await driver.given.projectConfig(
        'beta',
        appConfig(second.id, second.name),
      );
      await driver.given.projectConfig(
        'alpha',
        appConfig(first.id, first.name),
      );
      await driver.given.projectConfig(
        'shell',
        "export default { type: 'host', id: 'shell', framework: 'react' };\n",
      );
    });

    it('should return the requested app when --app-id matches', async () => {
      expect(await driver.get.app(second.id)).toMatchObject({
        id: second.id,
        name: second.name,
        framework: 'react',
      });
    });

    it('should reject listing available apps when --app-id does not match', async () => {
      await expect(driver.get.app(faker.string.uuid())).rejects.toThrow(
        `Available apps: ${first.name} (${first.id}), ${second.name} (${second.id}).`,
      );
    });

    it('should reject requiring --app-id when not interactive', async () => {
      driver.given.interactive(false);

      await expect(driver.get.app()).rejects.toThrow(
        /--app-id <app-id> is required/,
      );
    });

    it('should offer apps sorted by name when interactive', async () => {
      driver.given.interactive(true).given.selection(first.id);

      await driver.get.app();

      expect(driver.get.selectMock()).toHaveBeenCalledWith(
        'Which Atlas app should own this widget?',
        [
          { label: `${first.name} (${first.id})`, value: first.id },
          { label: `${second.name} (${second.id})`, value: second.id },
        ],
      );
    });

    it('should return the selected app when interactive', async () => {
      driver.given.interactive(true).given.selection(second.id);

      expect((await driver.get.app()).id).toBe(second.id);
    });
  });

  it('should reject when an app config has no literal id', async () => {
    await driver.given.projectConfig(
      'orders',
      "export default { id: computeId(), name: 'Orders', framework: 'react' };\n",
    );

    await expect(driver.get.app()).rejects.toThrow(
      /Could not determine the stable Atlas app ID/,
    );
  });

  it('should reject when an app config has an unsupported framework', async () => {
    await driver.given.projectConfig(
      'orders',
      appConfig(faker.string.uuid(), 'Orders', 'vue'),
    );

    await expect(driver.get.app()).rejects.toThrow(
      /Could not determine a supported app framework/,
    );
  });
});
