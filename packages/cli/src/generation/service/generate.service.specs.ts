import { beforeEach, describe, expect, it } from '@jest/globals';
import { GenerateServiceDriver } from './generate.service.driver.js';

describe('AtlasGenerateService', () => {
  let driver: GenerateServiceDriver;

  beforeEach(() => {
    driver = new GenerateServiceDriver();
  });

  it('should ask routing and stylesheet questions when Angular app generation is interactive', async () => {
    await driver.given.generation('interactive-angular');

    await driver.when.generate();

    expect(driver.get.promptState()).toStrictEqual({
      choiceLabels: ['CSS', 'SCSS', 'Sass', 'Less'],
      defaults: ['4201'],
      questions: [
        'select:Add Atlas inner routing to this app?',
        'select:Which stylesheet format would you like to use?',
        'input:Which port would you like to use for the dev server?',
      ],
    });
  });

  it('should suggest first unused port when workspace ports are occupied', async () => {
    await driver.given.generation('occupied-ports');

    await driver.when.generate();

    expect(driver.get.suggestedPorts()).toStrictEqual(['4202']);
  });

  it('should skip port discovery when explicit port is configured', async () => {
    await driver.given.generation('explicit-port');

    await driver.when.generate();

    expect(await driver.get.generatedConfig()).toContain(
      `port: ${driver.get.configuredPort()}`,
    );
  });

  it('should list apps and generate in selected owner when widget is interactive', async () => {
    await driver.given.generation('interactive-widget');

    await driver.when.generate();

    expect(await driver.get.widgetState()).toStrictEqual({
      choiceLabels: [
        ['Orders Portal ({ordersId})', 'Product Catalog ({catalogId})'],
      ],
      generated: true,
      questions: ['select:Which Atlas app should own this widget?'],
      wrongProjectContainsWidget: false,
    });
  });

  it('should generate without prompting when widget owner ID is explicit', async () => {
    await driver.given.generation('explicit-widget');

    await driver.when.generate();

    expect(await driver.get.widgetState()).toMatchObject({
      generated: true,
      questions: [],
    });
  });

  it('should reject generation when widget owner is missing non-interactively', async () => {
    await driver.given.generation('unconfigured-widget');

    await expect(driver.when.generate()).rejects.toThrow(
      /--app-id <app-id> is required.*Available apps/,
    );
  });
});
