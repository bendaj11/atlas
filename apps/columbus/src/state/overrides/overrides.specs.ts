import { anAppManifest } from '@atlas/testkit';
import { aColumbusState } from '../../types/columbus-state.testkit';
import { OverridesDriver } from './overrides.driver';

const OVERRIDE_STATUSES = [
  ['APPLYING', { isError: false, isPending: true }],
  ['APPLYING', { isError: true, isPending: true }],
  ['ERROR', { isError: true, isPending: false }],
  ['IDLE', { isError: false, isPending: false }],
] as const;

describe('persistOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  it('should persist the columbusState when persisting succeeds', async () => {
    const columbusState = aColumbusState();

    await driver.when.persisted(columbusState);

    expect(driver.get.persistedColumbusState()).toBe(columbusState);
  });

  it('should reject with the failure reason when persisting fails', async () => {
    await driver.given
      .persistFailure('Host tab gone.')
      .when.persisted(aColumbusState());

    expect(driver.get.failureMessage()).toContain('Host tab gone.');
  });

  it('should reject with a retry hint when persisting fails', async () => {
    await driver.given
      .persistFailure('Host tab gone.')
      .when.persisted(aColumbusState());

    expect(driver.get.failureMessage()).toContain('and retry.');
  });
});

describe('hasOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  it('should report false when columbusState is missing', () => {
    expect(driver.get.hasOverrides(undefined)).toBe(false);
  });

  it('should report false when columbusState has no overrides', () => {
    expect(driver.get.hasOverrides(aColumbusState())).toBe(false);
  });

  it('should report true when columbusState has an active override', () => {
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        ['app:orders', anAppManifest()],
      ]),
    });

    expect(driver.get.hasOverrides(columbusState)).toBe(true);
  });

  it('should report true when columbusState has a disabled override', () => {
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([
        ['app:orders', anAppManifest()],
      ]),
    });

    expect(driver.get.hasOverrides(columbusState)).toBe(true);
  });
});

describe('overrideStatusOf', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  it.each(OVERRIDE_STATUSES)(
    'should report %s when mutation state is %o',
    (status, mutation) => {
      expect(driver.get.overrideStatus(mutation)).toBe(status);
    },
  );
});
