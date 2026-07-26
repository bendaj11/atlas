import { beforeEach, describe, expect, it } from '@jest/globals';
import { OverrideSessionDriver } from './override-session.driver.js';

describe('saving override', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should activate selection when override is saved', () => {
    driver.given.disabledOverride().when.overrideSaved();

    expect(driver.get.activeOverride()).toMatchObject({ buildId: 'pr-build' });
  });

  it('should remove disabled selection when override is saved', () => {
    driver.given.disabledOverride().when.overrideSaved();

    expect(driver.get.disabledOverride()).toBeUndefined();
  });
});

describe('toggling override', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should deactivate selection when active override is toggled', () => {
    driver.given.activeOverride().when.overrideToggled();

    expect(driver.get.activeOverride()).toBeUndefined();
  });

  it('should retain selection when active override is toggled', () => {
    driver.given.activeOverride().when.overrideToggled();

    expect(driver.get.disabledOverride()).toMatchObject({ channel: 'pr' });
  });

  it('should keep session unchanged when unknown artifact is toggled', () => {
    const session = driver.get.session();

    driver.when.overrideToggled('app:missing');

    expect(driver.get.session()).toBe(session);
  });
});

describe('clearing overrides', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should remove active selection when one override is cleared', () => {
    driver.given.activeOverride().when.overrideCleared();

    expect(driver.get.activeOverride()).toBeUndefined();
  });

  it('should remove disabled selection when one override is cleared', () => {
    driver.given.disabledOverride().when.overrideCleared();

    expect(driver.get.disabledOverride()).toBeUndefined();
  });

  it('should suppress active local selection when it is cleared', () => {
    driver.given.activeLocalOverride().when.overrideCleared();

    expect(driver.get.suppressedArtifactIds()).toStrictEqual(['orders']);
  });

  it('should hide disabled local selection when it is cleared', () => {
    driver.given.disabledLocalOverride().when.overrideCleared();

    expect(driver.get.disabledOverride()).toBeUndefined();
    expect(driver.get.suppressedArtifactIds()).toStrictEqual(['orders']);
  });

  it('should suppress local selections when all overrides are cleared', () => {
    driver.given.activeLocalOverride().when.allOverridesCleared();

    expect(driver.get.disabledOverride()).toBeUndefined();
    expect(driver.get.suppressedArtifactIds()).toStrictEqual(['orders']);
  });

  it('should preserve scope when all overrides are cleared', () => {
    driver.given.scope('tab').given.activeOverride().when.allOverridesCleared();

    expect(driver.get.session().scope).toBe('tab');
  });
});

describe('disabled local discovery', () => {
  it('should persist raw artifact id instead of typed session key', () => {
    const driver = new OverrideSessionDriver();
    driver.given.disabledOverride();

    expect(driver.get.disabledOverrideIds()).toStrictEqual(['orders']);
  });
});

describe('override scope', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should preserve active selection when scope changes', () => {
    driver.given.activeOverride().when.scopeChanged('tab');

    expect(driver.get.activeOverride()).toMatchObject({ channel: 'pr' });
  });
});
