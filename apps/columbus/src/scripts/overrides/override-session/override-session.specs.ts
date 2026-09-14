import { aManifest, anAppManifest } from '../../../types/app.testkit';
import { OverrideSessionDriver } from './override-session.driver';

const ORDERS = anAppManifest({ id: 'orders' });
const PREVIEW = aManifest({ id: 'orders', channel: 'pr' });
const LOCAL = aManifest({ id: 'orders', channel: 'local' });

describe('saveOverrideInSession', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should activate the selected manifest when a selection is saved', () => {
    driver.when.overrideSaved({
      productionManifest: ORDERS,
      selectedManifest: PREVIEW,
    });

    expect(driver.get.activeOverride('app:orders')).toBe(PREVIEW);
  });

  it('should drop the disabled entry when a selection is saved', () => {
    driver.given.disabledOverride('app:orders', PREVIEW).when.overrideSaved({
      productionManifest: ORDERS,
      selectedManifest: LOCAL,
    });

    expect(driver.get.disabledOverride('app:orders')).toBeUndefined();
  });

  it('should remove the active override when an empty selection is saved', () => {
    driver.given.activeOverride('app:orders', PREVIEW).when.overrideSaved({
      productionManifest: ORDERS,
      selectedManifest: undefined,
    });

    expect(driver.get.activeOverride('app:orders')).toBeUndefined();
  });

  it('should unsuppress the app when a selection is saved', () => {
    driver.given.suppressedArtifactIds(['orders']).when.overrideSaved({
      productionManifest: ORDERS,
      selectedManifest: LOCAL,
    });

    expect(driver.get.suppressedArtifactIds()).toEqual([]);
  });
});

describe('toggleOverrideInSession', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should move an active override to disabled when toggled', () => {
    driver.given
      .activeOverride('app:orders', PREVIEW)
      .when.overrideToggled('app:orders');

    expect(driver.get.disabledOverride('app:orders')).toBe(PREVIEW);
  });

  it('should clear the active entry when an active override is toggled', () => {
    driver.given
      .activeOverride('app:orders', PREVIEW)
      .when.overrideToggled('app:orders');

    expect(driver.get.activeOverride('app:orders')).toBeUndefined();
  });

  it('should move a disabled override to active when toggled', () => {
    driver.given
      .disabledOverride('app:orders', PREVIEW)
      .when.overrideToggled('app:orders');

    expect(driver.get.activeOverride('app:orders')).toBe(PREVIEW);
  });

  it('should return nothing when the artifact has no override', () => {
    driver.when.overrideToggled('app:missing');

    expect(driver.get.result()).toBeUndefined();
  });
});

describe('clearOverrideInSession', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should remove the active override when cleared', () => {
    driver.given
      .activeOverride('app:orders', PREVIEW)
      .when.overrideCleared('app:orders');

    expect(driver.get.activeOverride('app:orders')).toBeUndefined();
  });

  it('should remove the disabled override when cleared', () => {
    driver.given
      .disabledOverride('app:orders', PREVIEW)
      .when.overrideCleared('app:orders');

    expect(driver.get.disabledOverride('app:orders')).toBeUndefined();
  });

  it('should suppress the app when an active local override is cleared', () => {
    driver.given
      .activeOverride('app:orders', LOCAL)
      .when.overrideCleared('app:orders');

    expect(driver.get.suppressedArtifactIds()).toEqual(['orders']);
  });

  it('should suppress the app when a disabled local override is cleared', () => {
    driver.given
      .disabledOverride('app:orders', LOCAL)
      .when.overrideCleared('app:orders');

    expect(driver.get.suppressedArtifactIds()).toEqual(['orders']);
  });

  it('should not suppress the app when a non-local override is cleared', () => {
    driver.given
      .activeOverride('app:orders', PREVIEW)
      .when.overrideCleared('app:orders');

    expect(driver.get.suppressedArtifactIds()).toEqual([]);
  });
});

describe('clearAllOverridesInSession', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should remove every override when all are cleared', () => {
    driver.given
      .activeOverride('app:orders', PREVIEW)
      .given.disabledOverride('app:cart', PREVIEW)
      .when.allOverridesCleared();

    expect([
      driver.get.activeOverride('app:orders'),
      driver.get.disabledOverride('app:cart'),
    ]).toEqual([undefined, undefined]);
  });

  it('should suppress local apps when all are cleared', () => {
    driver.given
      .activeOverride('app:orders', LOCAL)
      .given.disabledOverride(
        'app:cart',
        aManifest({ id: 'cart', channel: 'local' }),
      )
      .when.allOverridesCleared();

    expect(driver.get.suppressedArtifactIds()).toEqual(['orders', 'cart']);
  });

  it('should keep the scope when all are cleared', () => {
    driver.given.scope('tab').when.allOverridesCleared();

    expect(driver.get.scope()).toBe('tab');
  });
});

describe('setOverrideScopeInSession', () => {
  let driver: OverrideSessionDriver;

  beforeEach(() => {
    driver = new OverrideSessionDriver();
  });

  it('should change the scope when set', () => {
    driver.when.scopeSet('tab');

    expect(driver.get.scope()).toBe('tab');
  });

  it('should keep active overrides when the scope changes', () => {
    driver.given.activeOverride('app:orders', PREVIEW).when.scopeSet('tab');

    expect(driver.get.activeOverride('app:orders')).toBe(PREVIEW);
  });
});
