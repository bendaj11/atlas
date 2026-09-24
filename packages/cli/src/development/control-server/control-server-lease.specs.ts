import { anOverrideDocument } from '@atlas/testkit/internal';
import { LEASE_LIFETIME_MS } from '../constants.js';
import { ControlServerLeaseDriver } from './control-server-lease.driver.js';

describe('control-server-lease', () => {
  let driver: ControlServerLeaseDriver;

  beforeEach(() => {
    driver = new ControlServerLeaseDriver();
  });

  afterEach(async () => {
    await driver.when.cleanedUp();
  });

  it('should return no leases when none were written for the port', async () => {
    expect(await driver.get.activeLeases()).toStrictEqual([]);
  });

  it('should read back the document and readiness when a lease was written', async () => {
    const document = anOverrideDocument();
    await driver.given.lease(document, true);

    expect(await driver.get.activeLeases()).toStrictEqual([
      {
        document,
        processId: process.pid,
        ready: true,
        renewedAt: expect.any(Number),
      },
    ]);
  });

  it('should keep one lease per host and artifact when the same document is renewed', async () => {
    const document = anOverrideDocument();
    await driver.given.lease(document, false);
    await driver.given.lease(document, true);

    expect(
      (await driver.get.activeLeases()).map(({ ready }) => ready),
    ).toStrictEqual([true]);
  });

  it('should keep the lease when less than its lifetime has elapsed', async () => {
    const document = anOverrideDocument();
    await driver.given.lease(document, true);

    driver.when.timeElapsed(LEASE_LIFETIME_MS - 1);

    expect(await driver.get.activeLeases()).toHaveLength(1);
  });

  it('should forget the lease when its lifetime has elapsed', async () => {
    const document = anOverrideDocument();
    await driver.given.lease(document, true);

    driver.when.timeElapsed(LEASE_LIFETIME_MS);

    expect(await driver.get.activeLeases()).toStrictEqual([]);
  });

  it('should forget the lease when it is removed', async () => {
    const document = anOverrideDocument();
    await driver.given.lease(document, true);

    await driver.when.removed(document);

    expect(await driver.get.activeLeases()).toStrictEqual([]);
  });
});
