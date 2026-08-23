import { beforeEach, describe, expect, it } from '@jest/globals';
import { InteractionDriver } from './interaction.driver.js';

describe('resolveInvocation', () => {
  let driver: InteractionDriver;

  beforeEach(() => {
    driver = new InteractionDriver();
  });

  it('should resolve missing generation configuration when answers are provided', async () => {
    driver.given.scenario('interactive-generation');

    await driver.when.resolve();

    expect(driver.get.invocation()).toStrictEqual(driver.get.generation());
  });

  it('should ask only for missing configuration when generation is interactive', async () => {
    driver.given.scenario('interactive-generation');

    await driver.when.resolve();

    expect(driver.get.questions()).toStrictEqual(
      driver.get.generationQuestions(),
    );
  });

  it('should list generation kinds when generation kind is missing', async () => {
    driver.given.scenario('interactive-generation');

    await driver.when.resolve();

    expect(driver.get.choiceLabels()).toStrictEqual(
      driver.get.generationChoices(),
    );
  });

  it('should resolve invocation when all arguments are provided', async () => {
    driver.given.scenario('configured-generation');

    await driver.when.resolve();

    expect(driver.get.invocation()).toStrictEqual(
      driver.get.configuredGeneration(),
    );
  });

  it('should not prompt when invocation is configured', async () => {
    driver.given.scenario('configured-generation');

    await driver.when.resolve();

    expect(driver.get.questions()).toStrictEqual([]);
  });

  it('should defer widget app selection when configured apps are unavailable', async () => {
    driver.given.scenario('unconfigured-widget');

    await driver.when.resolve();

    expect(driver.get.invocation()).toStrictEqual(driver.get.widget());
  });

  it('should not prompt for widget app when configured apps are unavailable', async () => {
    driver.given.scenario('unconfigured-widget');

    await driver.when.resolve();

    expect(driver.get.questions()).toStrictEqual([]);
  });

  it('should resolve app ID when widget app ID flag is provided', async () => {
    driver.given.scenario('configured-widget');

    await driver.when.resolve();

    expect(driver.get.appId()).toBe(driver.get.widgetAppId());
  });

  it('should not prompt when widget app ID is provided', async () => {
    driver.given.scenario('configured-widget');

    await driver.when.resolve();

    expect(driver.get.questions()).toStrictEqual([]);
  });
});
