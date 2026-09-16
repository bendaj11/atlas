import { anAppManifest } from '@atlas/testkit';
import { ArtifactVersionOverrideReducersDriver } from './artifact-version-override-reducers.driver';

const ORDERS = anAppManifest({ id: 'orders' });
const PREVIEW = anAppManifest({ id: 'orders', channel: 'pr' });
const LOCAL = anAppManifest({ id: 'orders', channel: 'local' });

describe('saveArtifactVersionOverride', () => {
  let driver: ArtifactVersionOverrideReducersDriver;

  beforeEach(() => {
    driver = new ArtifactVersionOverrideReducersDriver();
  });

  it('should activate the selected manifest when a selection is saved', () => {
    driver.when.overrideSaved({
      productionArtifactVersion: ORDERS,
      selectedArtifactVersion: PREVIEW,
    });

    expect(driver.get.activeOverride('app:orders')).toBe(PREVIEW);
  });

  it('should drop the disabled entry when a selection is saved', () => {
    driver.given.disabledOverride('app:orders', PREVIEW).when.overrideSaved({
      productionArtifactVersion: ORDERS,
      selectedArtifactVersion: LOCAL,
    });

    expect(driver.get.disabledOverride('app:orders')).toBeUndefined();
  });

  it('should remove the active override when an empty selection is saved', () => {
    driver.given.activeOverride('app:orders', PREVIEW).when.overrideSaved({
      productionArtifactVersion: ORDERS,
      selectedArtifactVersion: undefined,
    });

    expect(driver.get.activeOverride('app:orders')).toBeUndefined();
  });

  it('should unsuppress the app when a selection is saved', () => {
    driver.given.clearedLocalArtifactIds(['orders']).when.overrideSaved({
      productionArtifactVersion: ORDERS,
      selectedArtifactVersion: LOCAL,
    });

    expect(driver.get.clearedLocalArtifactIds()).toEqual([]);
  });
});

describe('toggleArtifactVersionOverride', () => {
  let driver: ArtifactVersionOverrideReducersDriver;

  beforeEach(() => {
    driver = new ArtifactVersionOverrideReducersDriver();
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

describe('clearArtifactVersionOverride', () => {
  let driver: ArtifactVersionOverrideReducersDriver;

  beforeEach(() => {
    driver = new ArtifactVersionOverrideReducersDriver();
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

    expect(driver.get.clearedLocalArtifactIds()).toEqual(['orders']);
  });

  it('should suppress the app when a disabled local override is cleared', () => {
    driver.given
      .disabledOverride('app:orders', LOCAL)
      .when.overrideCleared('app:orders');

    expect(driver.get.clearedLocalArtifactIds()).toEqual(['orders']);
  });

  it('should not suppress the app when a non-local override is cleared', () => {
    driver.given
      .activeOverride('app:orders', PREVIEW)
      .when.overrideCleared('app:orders');

    expect(driver.get.clearedLocalArtifactIds()).toEqual([]);
  });
});

describe('clearAllArtifactVersionOverrides', () => {
  let driver: ArtifactVersionOverrideReducersDriver;

  beforeEach(() => {
    driver = new ArtifactVersionOverrideReducersDriver();
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
        anAppManifest({ id: 'cart', channel: 'local' }),
      )
      .when.allOverridesCleared();

    expect(driver.get.clearedLocalArtifactIds()).toEqual(['orders', 'cart']);
  });

  it('should keep the scope when all are cleared', () => {
    driver.given.scope('tab').when.allOverridesCleared();

    expect(driver.get.scope()).toBe('tab');
  });
});

describe('setArtifactVersionOverrideScope', () => {
  let driver: ArtifactVersionOverrideReducersDriver;

  beforeEach(() => {
    driver = new ArtifactVersionOverrideReducersDriver();
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
