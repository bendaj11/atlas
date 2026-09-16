import { faker } from '@faker-js/faker';
import { AtlasValidationErrorDriver } from './atlas-validation-error.driver.js';

describe('AtlasValidationError', () => {
  let driver: AtlasValidationErrorDriver;

  beforeEach(() => {
    driver = new AtlasValidationErrorDriver();
  });

  it('should keep the summary unchanged when no issues are given', () => {
    const summary = faker.lorem.sentence();
    driver.given.issues([]).when.constructed(summary);

    expect(driver.get.error().summary).toBe(summary);
  });

  it('should list each issue as path and message after the summary when issues are given', () => {
    const summary = faker.lorem.sentence();
    const first = { path: faker.lorem.word(), message: faker.lorem.sentence() };
    const second = {
      path: faker.lorem.word(),
      message: faker.lorem.sentence(),
    };
    driver.given.issues([first, second]).when.constructed(summary);

    expect(driver.get.error().summary).toBe(
      `${summary} ${first.path}: ${first.message} ${second.path}: ${second.message}`,
    );
  });

  it('should print message alone when an issue has no path', () => {
    const summary = faker.lorem.sentence();
    const message = faker.lorem.sentence();
    driver.given.issues([{ path: '', message }]).when.constructed(summary);

    expect(driver.get.error().summary).toBe(`${summary} ${message}`);
  });

  it('should expose issues, code and a suggested action when constructed', () => {
    const issues = [
      { path: faker.lorem.word(), message: faker.lorem.sentence() },
    ];
    driver.given.issues(issues).when.constructed(faker.lorem.sentence());

    expect(driver.get.error()).toMatchObject({
      name: 'AtlasValidationError',
      code: 'ATLAS_INVALID_JSON',
      issues,
      suggestedActions: [
        'Correct every listed field in the Atlas JSON source, regenerate the artifact if generated, then retry.',
      ],
    });
  });
});
