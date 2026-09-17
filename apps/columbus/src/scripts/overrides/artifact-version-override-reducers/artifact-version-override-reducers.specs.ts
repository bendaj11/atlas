import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aColumbusState } from '../../../testkit/columbus-state.testkit';
import {
  clearAllArtifactVersionOverrides,
  clearArtifactVersionOverride,
  saveArtifactVersionOverride,
  setArtifactVersionOverrideScope,
  toggleArtifactVersionOverride,
} from './artifact-version-override-reducers';

describe('saveArtifactVersionOverride', () => {
  it('should enable the selected version under the deployed artifact id when a selection is saved', () => {
    const deployed = anAppManifest();
    const selected = anAppManifest({ id: deployed.id });

    expect(
      saveArtifactVersionOverride({
        columbusState: aColumbusState(),
        selection: {
          deployedArtifactVersion: deployed,
          selectedOverrideArtifactVersion: selected,
        },
      }).enabledArtifactVersionOverrides,
    ).toStrictEqual(new Map([[deployed.id, selected]]));
  });

  it('should drop the disabled override when a selection is saved', () => {
    const deployed = anAppManifest();
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([
        [deployed.id, anAppManifest({ id: deployed.id })],
      ]),
    });

    expect(
      saveArtifactVersionOverride({
        columbusState,
        selection: {
          deployedArtifactVersion: deployed,
          selectedOverrideArtifactVersion: anAppManifest({ id: deployed.id }),
        },
      }).disabledArtifactVersionOverrides,
    ).toStrictEqual(new Map());
  });

  it('should remove the enabled override when an empty selection is saved', () => {
    const deployed = anAppManifest();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        [deployed.id, anAppManifest({ id: deployed.id })],
      ]),
    });

    expect(
      saveArtifactVersionOverride({
        columbusState,
        selection: {
          deployedArtifactVersion: deployed,
          selectedOverrideArtifactVersion: undefined,
        },
      }).enabledArtifactVersionOverrides,
    ).toStrictEqual(new Map());
  });

  it('should remove the deployed artifact id from the cleared local ids when a selection is saved', () => {
    const deployed = anAppManifest();
    const columbusState = aColumbusState({
      clearedLocalArtifactIds: new Set([deployed.id]),
    });

    expect(
      saveArtifactVersionOverride({
        columbusState,
        selection: {
          deployedArtifactVersion: deployed,
          selectedOverrideArtifactVersion: anAppManifest({ id: deployed.id }),
        },
      }).clearedLocalArtifactIds,
    ).toStrictEqual(new Set());
  });
});

describe('toggleArtifactVersionOverride', () => {
  it('should return nothing when the artifact has no override', () => {
    expect(
      toggleArtifactVersionOverride({
        columbusState: aColumbusState(),
        artifactKey: faker.string.uuid(),
      }),
    ).toBeUndefined();
  });

  describe('when the artifact has an enabled override', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    it('should move the override to disabled when toggled', () => {
      expect(
        toggleArtifactVersionOverride({
          columbusState,
          artifactKey: override.id,
        })?.disabledArtifactVersionOverrides,
      ).toStrictEqual(new Map([[override.id, override]]));
    });

    it('should remove the enabled override when toggled', () => {
      expect(
        toggleArtifactVersionOverride({
          columbusState,
          artifactKey: override.id,
        })?.enabledArtifactVersionOverrides,
      ).toStrictEqual(new Map());
    });
  });

  it('should move the override to enabled when the artifact has a disabled override and is toggled', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      toggleArtifactVersionOverride({
        columbusState,
        artifactKey: override.id,
      })?.enabledArtifactVersionOverrides,
    ).toStrictEqual(new Map([[override.id, override]]));
  });
});

describe('clearArtifactVersionOverride', () => {
  it('should remove the enabled override when cleared', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearArtifactVersionOverride({ columbusState, artifactKey: override.id })
        .enabledArtifactVersionOverrides,
    ).toStrictEqual(new Map());
  });

  it('should remove the disabled override when cleared', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearArtifactVersionOverride({ columbusState, artifactKey: override.id })
        .disabledArtifactVersionOverrides,
    ).toStrictEqual(new Map());
  });

  it('should add the artifact id to the cleared local ids when an enabled local override is cleared', () => {
    const override = anAppManifest({ channel: 'local' });
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearArtifactVersionOverride({ columbusState, artifactKey: override.id })
        .clearedLocalArtifactIds,
    ).toStrictEqual(new Set([override.id]));
  });

  it('should add the artifact id to the cleared local ids when a disabled local override is cleared', () => {
    const override = anAppManifest({ channel: 'local' });
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearArtifactVersionOverride({ columbusState, artifactKey: override.id })
        .clearedLocalArtifactIds,
    ).toStrictEqual(new Set([override.id]));
  });

  it('should keep the cleared local ids empty when an enabled pr override is cleared', () => {
    const override = anAppManifest({ channel: 'pr' });
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearArtifactVersionOverride({ columbusState, artifactKey: override.id })
        .clearedLocalArtifactIds,
    ).toStrictEqual(new Set());
  });
});

describe('clearAllArtifactVersionOverrides', () => {
  it('should keep the scope when all are cleared', () => {
    const columbusState = aColumbusState();

    expect(clearAllArtifactVersionOverrides(columbusState).scope).toBe(
      columbusState.scope,
    );
  });

  it('should remove every enabled override when all are cleared', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearAllArtifactVersionOverrides(columbusState)
        .enabledArtifactVersionOverrides,
    ).toStrictEqual(new Map());
  });

  it('should remove every disabled override when all are cleared', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      clearAllArtifactVersionOverrides(columbusState)
        .disabledArtifactVersionOverrides,
    ).toStrictEqual(new Map());
  });

  it('should add the local override ids to the cleared local ids when all are cleared', () => {
    const enabled = anAppManifest({ channel: 'local' });
    const disabled = anAppManifest({ channel: 'local' });
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[enabled.id, enabled]]),
      disabledArtifactVersionOverrides: new Map([[disabled.id, disabled]]),
    });

    expect(
      clearAllArtifactVersionOverrides(columbusState).clearedLocalArtifactIds,
    ).toStrictEqual(new Set([enabled.id, disabled.id]));
  });

  it('should keep the cleared local ids empty when only pr overrides are cleared', () => {
    const enabled = anAppManifest({ channel: 'pr' });
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[enabled.id, enabled]]),
    });

    expect(
      clearAllArtifactVersionOverrides(columbusState).clearedLocalArtifactIds,
    ).toStrictEqual(new Set());
  });
});

describe('setArtifactVersionOverrideScope', () => {
  it('should change the scope when set', () => {
    const columbusState = aColumbusState({ scope: 'all' });

    expect(
      setArtifactVersionOverrideScope({ columbusState, scope: 'tab' }).scope,
    ).toBe('tab');
  });

  it('should keep the enabled overrides when the scope changes', () => {
    const override = anAppManifest();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    expect(
      setArtifactVersionOverrideScope({ columbusState, scope: 'tab' })
        .enabledArtifactVersionOverrides,
    ).toStrictEqual(new Map([[override.id, override]]));
  });
});
