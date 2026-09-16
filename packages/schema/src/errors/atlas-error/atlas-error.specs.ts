import { faker } from '@faker-js/faker';
import { AtlasError } from './atlas-error.js';
import { AtlasErrorDriver } from './atlas-error.driver.js';

const DEFAULT_ACTION = 'Correct the reported condition, then retry.';
const SUGGESTED_ACTIONS: readonly [string, string][] = [
  [
    'Duplicate app id "orders" found.',
    'Remove duplicate manifest entries for "orders" from the host catalog, then retry.',
  ],
  [
    'Project is missing required configuration file "apps/shop/atlas.config.ts".',
    'Restore or create atlas.config.ts in the named project, then retry the failed operation.',
  ],
  [
    'Catalog request returned 503.',
    'Verify the catalog URL is reachable and its JSON matches the Atlas catalog schema, then retry.',
  ],
  [
    'Remote entry blocked by CORS.',
    'Verify the named URL is reachable, permits the host origin through CORS, and serves the expected Atlas artifact, then retry.',
  ],
  [
    'Invalid manifest field.',
    'Correct the named value in Atlas configuration or generated JSON, then retry the failed operation.',
  ],
  [
    'Widget not found.',
    'Verify the named capability is configured and exported by the selected app build, then retry.',
  ],
  [
    'Something else broke.',
    `${DEFAULT_ACTION} If it persists, inspect the preserved cause and stack trace.`,
  ],
];

describe('AtlasError', () => {
  let driver: AtlasErrorDriver;

  beforeEach(() => {
    driver = new AtlasErrorDriver();
  });

  it('should append single suggested action to message when one action is given', () => {
    const summary = faker.lorem.sentence();
    const action = faker.lorem.sentence();
    driver.when.constructed(summary, { suggestedActions: action });

    expect(driver.get.error().message).toBe(
      `${summary} Suggested action: ${action}`,
    );
  });

  it('should number suggested actions in message when several actions are given', () => {
    const summary = faker.lorem.sentence();
    const [first, second] = [faker.lorem.sentence(), faker.lorem.sentence()];
    driver.when.constructed(summary, { suggestedActions: [first, second] });

    expect(driver.get.error().message).toBe(
      `${summary} Suggested actions: 1) ${first} 2) ${second}`,
    );
  });

  it('should fall back to default action when given actions are blank', () => {
    driver.when.constructed(faker.lorem.sentence(), {
      suggestedActions: ['  ', ''],
    });

    expect(driver.get.error().suggestedActions).toEqual([DEFAULT_ACTION]);
  });

  it('should strip an existing action section from summary when summary already carries one', () => {
    const summary = faker.lorem.sentence();
    driver.when.constructed(`${summary} Suggested action: old advice.`, {
      suggestedActions: faker.lorem.sentence(),
    });

    expect(driver.get.error().summary).toBe(summary);
  });

  it('should default surface to universal when surface is omitted', () => {
    driver.when.constructed(faker.lorem.sentence(), {
      suggestedActions: faker.lorem.sentence(),
    });

    expect(driver.get.error().surface).toBe('universal');
  });

  it('should keep code, surface and cause when given', () => {
    const cause = new Error(faker.lorem.sentence());
    const code = faker.string.alpha(8);
    driver.when.constructed(faker.lorem.sentence(), {
      suggestedActions: faker.lorem.sentence(),
      code,
      surface: 'cli',
      cause,
    });

    expect(driver.get.error()).toMatchObject({ code, surface: 'cli', cause });
  });
});

describe('ensureActionableError', () => {
  let driver: AtlasErrorDriver;

  beforeEach(() => {
    driver = new AtlasErrorDriver();
  });

  it('should return same instance when value is already an AtlasError and no options are given', () => {
    const error = new AtlasError(faker.lorem.sentence(), {
      suggestedActions: faker.lorem.sentence(),
    });
    driver.given.value(error).when.ensured();

    expect(driver.get.error()).toBe(error);
  });

  it('should wrap a plain error as cause when value is an Error', () => {
    const cause = new Error(faker.lorem.sentence());
    driver.given.value(cause).when.ensured();

    expect(driver.get.error().cause).toBe(cause);
  });

  it('should use error message as summary when value is an Error', () => {
    const message = faker.lorem.sentence();
    driver.given.value(new Error(message)).when.ensured();

    expect(driver.get.error().summary).toBe(message);
  });

  it('should stringify value into summary when value is not an Error', () => {
    const value = faker.lorem.word();
    driver.given.value(value).when.ensured();

    expect(driver.get.error().summary).toBe(value);
  });

  it('should use string options as the suggested action when options is a string', () => {
    const action = faker.lorem.sentence();
    driver.given
      .value(new Error(faker.lorem.sentence()))
      .given.options(action)
      .when.ensured();

    expect(driver.get.error().suggestedActions).toEqual([action]);
  });

  it('should replace actions and surface without mutating the original when value is an AtlasError and options are given', () => {
    const original = new AtlasError(faker.lorem.sentence(), {
      suggestedActions: 'Run `atlas --help`.',
      surface: 'cli',
    });
    const action = faker.lorem.sentence();
    driver.given
      .value(original)
      .given.options({ suggestedActions: action, surface: 'browser' })
      .when.ensured();

    expect(driver.get.error()).toMatchObject({
      surface: 'browser',
      suggestedActions: [action],
      cause: original,
      summary: original.summary,
    });
  });

  it('should carry code when options include one', () => {
    const code = faker.string.alpha(8);
    driver.given
      .value(new Error(faker.lorem.sentence()))
      .given.options({ suggestedActions: faker.lorem.sentence(), code })
      .when.ensured();

    expect(driver.get.error().code).toBe(code);
  });
});

describe('actionableMessage', () => {
  let driver: AtlasErrorDriver;

  beforeEach(() => {
    driver = new AtlasErrorDriver();
  });

  it('should not duplicate the action section when message already carries one', () => {
    const summary = faker.lorem.sentence();
    const action = faker.lorem.sentence();
    driver.when.messageFormatted(`${summary} Suggested action: stale.`, action);

    expect(driver.get.text()).toBe(`${summary} Suggested action: ${action}`);
  });
});

describe('errorSummary', () => {
  let driver: AtlasErrorDriver;

  beforeEach(() => {
    driver = new AtlasErrorDriver();
  });

  it('should return trimmed message when message has no action section', () => {
    const message = faker.lorem.sentence();
    driver.when.summarized(`  ${message}  `);

    expect(driver.get.text()).toBe(message);
  });

  it('should drop a plural action section when message carries numbered actions', () => {
    const message = faker.lorem.sentence();
    driver.when.summarized(`${message} Suggested actions: 1) a 2) b`);

    expect(driver.get.text()).toBe(message);
  });
});

describe('suggestedActionFor', () => {
  let driver: AtlasErrorDriver;

  beforeEach(() => {
    driver = new AtlasErrorDriver();
  });

  it.each(SUGGESTED_ACTIONS)(
    'should suggest matching action when message is "%s"',
    (message, action) => {
      driver.when.actionSuggested(message);

      expect(driver.get.text()).toBe(action);
    },
  );
});
