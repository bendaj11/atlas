import { faker } from '@faker-js/faker';
import { ChecksDriver } from './checks.driver.js';

describe('VerificationChecks', () => {
  let driver: ChecksDriver;

  beforeEach(() => {
    driver = new ChecksDriver();
  });

  it('should list checks in recording order when reported', () => {
    const subject = faker.lorem.word();
    driver.given.pass(subject, 'ok').given.failure(subject, 'bad');

    expect(driver.get.report(faker.internet.url()).checks).toStrictEqual([
      { status: 'pass', subject, message: 'ok' },
      { status: 'failure', subject, message: 'bad' },
    ]);
  });

  it('should count failures and warnings when reported', () => {
    driver.given
      .pass('a', 'ok')
      .given.warning('b', 'hmm')
      .given.failure('c', 'bad')
      .given.failure('d', 'bad');

    expect(driver.get.report(faker.internet.url())).toMatchObject({
      failures: 2,
      warnings: 1,
    });
  });

  it('should include the host id when one is given', () => {
    const hostId = faker.string.uuid();

    expect(driver.get.report(faker.internet.url(), hostId).hostId).toBe(hostId);
  });

  it('should omit the host id when none is given', () => {
    expect(driver.get.report(faker.internet.url())).not.toHaveProperty(
      'hostId',
    );
  });
});
