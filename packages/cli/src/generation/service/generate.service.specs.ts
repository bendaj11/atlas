import { faker } from '@faker-js/faker';
import {
  anAppConfigSource,
  GenerateServiceDriver,
} from './generate.service.driver.js';

describe('AtlasGenerateService', () => {
  let driver: GenerateServiceDriver;

  beforeEach(async () => {
    driver = new GenerateServiceDriver();

    await driver.given.workspace();
  });

  describe('project', () => {
    describe('when an Angular app is generated interactively', () => {
      beforeEach(async () => {
        driver.given
          .flags(['--framework=angular'])
          .given.prompts(['true', 'scss', '4201'], true);

        await driver.when.projectGenerated(
          'app',
          faker.word.noun().toLowerCase(),
          'angular',
        );
      });

      it('should ask routing, stylesheet, and port when generated', () => {
        expect(driver.get.questions()).toStrictEqual([
          'select:Add Atlas inner routing to this app?',
          'select:Which stylesheet format would you like to use?',
          'input:Which port would you like to use for the dev server?',
        ]);
      });

      it('should offer every stylesheet format when asking', () => {
        expect(driver.get.choiceLabels(1)).toStrictEqual([
          'CSS',
          'SCSS',
          'Sass',
          'Less',
        ]);
      });

      it('should suggest the default app port when no project uses it', () => {
        expect(driver.get.inputDefaults()).toStrictEqual(['4201']);
      });
    });

    it('should suggest the first free port when workspace projects occupy the defaults', async () => {
      await driver.given.project('shell', {
        'atlas.config.ts': 'export default {};\n',
        'vite.config.ts': 'export default { server: { port: 4200 } };\n',
      });
      await driver.given.project('orders', {
        'atlas.config.ts': 'export default {};\n',
        'angular.json': JSON.stringify({
          projects: {
            orders: { architect: { serve: { options: { port: 4201 } } } },
          },
        }),
      });
      driver.given.flags(['--framework=react']).given.prompts(['4202'], true);

      await driver.when.projectGenerated(
        'host',
        faker.word.noun().toLowerCase(),
        'react',
      );

      expect(driver.get.inputDefaults()).toStrictEqual(['4202']);
    });

    it('should write the explicit port into vite.config.ts when --port is given', async () => {
      const name = faker.word.noun().toLowerCase();
      const port = faker.number.int({ min: 5000, max: 6000 });
      driver.given.flags(['--framework=react', `--port=${port}`]);

      await driver.when.projectGenerated('app', name, 'react');

      expect(await driver.get.file(`${name}/vite.config.ts`)).toContain(
        `port: ${port}`,
      );
    });

    it('should return the generated root when a project is generated', async () => {
      const name = faker.word.noun().toLowerCase();
      driver.given.flags(['--framework=react']);

      expect(
        await driver.when.projectGenerated('app', name, 'react'),
      ).toStrictEqual([expect.stringMatching(new RegExp(`/${name}$`))]);
    });

    it('should reject --host for app generation when given', async () => {
      driver.given.flags(['--host=shell']);

      await expect(
        driver.when.projectGenerated('app', faker.word.noun(), 'react'),
      ).rejects.toThrow(
        'Unknown option "--host" for app generation. Use --host-id.',
      );
    });

    describe('when the workspace is turbo with an existing dev task', () => {
      beforeEach(async () => {
        driver.given.workspaceKind('turbo').given.flags(['--framework=react']);
        await driver.given.workspaceFile('turbo.json', {
          tasks: { dev: { cache: false, persistent: true, custom: true } },
        });

        await driver.when.projectGenerated(
          'app',
          faker.word.noun().toLowerCase(),
          'react',
        );
      });

      it('should keep the existing dev task when generated', async () => {
        expect((await driver.get.json('turbo.json'))!.tasks).toMatchObject({
          dev: { cache: false, persistent: true, custom: true },
        });
      });

      it('should add a publish task without a build dependency when generated', async () => {
        expect(
          (
            (await driver.get.json('turbo.json'))!.tasks as Record<
              string,
              unknown
            >
          )['atlas:publish'],
        ).not.toHaveProperty('dependsOn');
      });
    });
  });

  describe('widget', () => {
    const catalog = { id: faker.string.uuid(), name: 'Product Catalog' };
    const orders = { id: faker.string.uuid(), name: 'Orders Portal' };

    beforeEach(async () => {
      await driver.given.project('catalog', {
        'atlas.config.ts': anAppConfigSource({
          ...catalog,
          framework: 'angular',
        }),
      });
      await driver.given.project('orders', {
        'atlas.config.ts': anAppConfigSource({ ...orders, framework: 'react' }),
      });
    });

    it('should offer apps sorted by name when the owner is chosen interactively', async () => {
      driver.given.prompts([orders.id], true);

      await driver.when.widgetGenerated('banner');

      expect(driver.get.choiceLabels(0)).toStrictEqual([
        `${orders.name} (${orders.id})`,
        `${catalog.name} (${catalog.id})`,
      ]);
    });

    it('should generate the widget in the chosen owner when selected interactively', async () => {
      driver.given.prompts([orders.id], true);

      await driver.when.widgetGenerated('banner');

      expect(
        await driver.get.fileExists(
          'orders/src/exported-widgets/banner/index.tsx',
        ),
      ).toBe(true);
    });

    it('should not touch other apps when the owner is chosen', async () => {
      driver.given.prompts([orders.id], true);

      await driver.when.widgetGenerated('banner');

      expect(
        await driver.get.fileExists(
          'catalog/src/exported-widgets/banner/index.ts',
        ),
      ).toBe(false);
    });

    it('should generate without prompting when --app-id is given', async () => {
      await driver.when.widgetGenerated('banner', orders.id);

      expect(driver.get.questions()).toStrictEqual([]);
    });

    it('should reject when the owner is missing non-interactively', async () => {
      await expect(driver.when.widgetGenerated('banner')).rejects.toThrow(
        /--app-id <app-id> is required.*Available apps/,
      );
    });

    it('should reject an existing widget when --force is absent', async () => {
      await driver.when.widgetGenerated('banner', orders.id);

      await expect(
        driver.when.widgetGenerated('banner', orders.id),
      ).rejects.toThrow(
        'Widget "banner" already exists. Use --force to replace it.',
      );
    });
  });
});
