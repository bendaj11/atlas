import { faker } from '@faker-js/faker';
import { InteractionDriver } from './interaction.driver.js';

describe('resolveInvocation', () => {
  let driver: InteractionDriver;

  beforeEach(() => {
    driver = new InteractionDriver();
  });

  describe('when generation is interactive and nothing is configured', () => {
    const name = faker.word.noun();

    beforeEach(async () => {
      driver.given.values(['g']).given.prompts(['app', name, 'angular'], true);

      await driver.when.resolved();
    });

    it('should fill the invocation from the answers when resolved', () => {
      expect(driver.get.invocation()).toStrictEqual({
        appId: undefined,
        command: 'g',
        framework: 'angular',
        name,
        subcommand: 'app',
        version: undefined,
      });
    });

    it('should ask for kind, name, and framework in order when resolved', () => {
      expect(driver.get.questions()).toStrictEqual([
        'select:What would you like to generate?',
        'input:App name',
        'select:Framework',
      ]);
    });

    it('should list every generation kind when asking for the kind', () => {
      expect(driver.get.choiceLabels(0)).toStrictEqual([
        'Application',
        'Host',
        'Exported widget',
      ]);
    });
  });

  describe('when generation is fully configured', () => {
    const name = faker.word.noun();

    beforeEach(async () => {
      driver.given
        .values(['g', 'host', name, '--framework=react'])
        .given.prompts([], false);

      await driver.when.resolved();
    });

    it('should read the invocation from the arguments when resolved', () => {
      expect(driver.get.invocation()).toStrictEqual({
        appId: undefined,
        command: 'g',
        framework: 'react',
        name,
        subcommand: 'host',
        version: undefined,
      });
    });

    it('should not prompt when resolved', () => {
      expect(driver.get.questions()).toStrictEqual([]);
    });
  });

  it('should ask for the widget name only when generating a widget interactively', async () => {
    const name = faker.word.noun();
    driver.given.values(['g', 'widget']).given.prompts([name], true);

    await driver.when.resolved();

    expect(driver.get.questions()).toStrictEqual(['input:Widget name']);
  });

  it('should leave the app id unresolved when a widget has no --app-id', async () => {
    driver.given
      .values(['g', 'widget', faker.word.noun()])
      .given.prompts([], true);

    await driver.when.resolved();

    expect(driver.get.invocation().appId).toBeUndefined();
  });

  it('should carry --app-id when a widget is configured', async () => {
    const appId = faker.string.uuid();
    driver.given
      .values(['g', 'widget', faker.word.noun(), `--app-id=${appId}`])
      .given.prompts([], false);

    await driver.when.resolved();

    expect(driver.get.invocation().appId).toBe(appId);
  });

  it.each(['build', 'bootstrap', 'publish', 'deploy', 'remove-preview'])(
    'should ask for the project when %s has no subcommand interactively',
    async (command) => {
      const project = faker.word.noun();
      driver.given.values([command]).given.prompts([project], true);

      await driver.when.resolved();

      expect(driver.get.invocation().subcommand).toBe(project);
    },
  );

  it('should carry --version when given', async () => {
    const version = faker.system.semver();
    driver.given.values(['deploy', 'orders', `--version=${version}`]);

    await driver.when.resolved();

    expect(driver.get.invocation().version).toBe(version);
  });
});
