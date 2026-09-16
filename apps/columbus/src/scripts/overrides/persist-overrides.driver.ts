import { jest } from '@jest/globals';
import type { ColumbusState } from '../../types/app';
import { aColumbusState } from '../../types/app.testkit';
import type { reloadHostTab as reloadHostTabType } from '../host/host-tabs/host-tabs';
import type { validateLocalOverride as validateLocalOverrideType } from './local-override/local-override';
import type * as OverrideStorageModule from './override-storage/override-storage';

type OverrideStorage = typeof OverrideStorageModule;

const validateLocalOverride = jest.fn<typeof validateLocalOverrideType>();
const writeOverrideDocument =
  jest.fn<OverrideStorage['writeOverrideDocument']>();
const writeDisabledArtifactVersionOverrides =
  jest.fn<OverrideStorage['writeDisabledArtifactVersionOverrides']>();
const writeClearedLocalArtifactIds =
  jest.fn<OverrideStorage['writeClearedLocalArtifactIds']>();
const reloadHostTab = jest.fn<typeof reloadHostTabType>();
const calls: string[] = [];

jest.unstable_mockModule('../host/host-tabs/host-tabs', () => ({
  reloadHostTab,
}));
jest.unstable_mockModule('./local-override/local-override', () => ({
  validateLocalOverride,
}));
jest.unstable_mockModule('./override-storage/override-storage', () => ({
  writeDisabledArtifactVersionOverrides,
  writeOverrideDocument,
  writeClearedLocalArtifactIds,
}));

const { persistColumbusState } = await import('./persist-overrides');

export class PersistOverridesDriver {
  private columbusState: ColumbusState = aColumbusState();
  private error: unknown;

  constructor() {
    jest.clearAllMocks();
    calls.length = 0;
    validateLocalOverride.mockImplementation(async () => {
      calls.push('validate');
    });
    writeOverrideDocument.mockImplementation(async () => {
      calls.push('writeOverrideDocument');
    });
    writeDisabledArtifactVersionOverrides.mockImplementation(async () => {
      calls.push('writeDisabledArtifactVersionOverrides');
    });
    writeClearedLocalArtifactIds.mockImplementation(async () => {
      calls.push('writeClearedLocalArtifactIds');
    });
    reloadHostTab.mockImplementation(async () => {
      calls.push('reload');
    });
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState): this => {
      this.columbusState = columbusState;

      return this;
    },
    validationFailure: (reason: string): this => {
      validateLocalOverride.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    persisted: async (): Promise<void> => {
      try {
        await persistColumbusState(this.columbusState);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    callOrder: (): string[] => calls,
    validatedManifests: () =>
      validateLocalOverride.mock.calls.map(([manifest]) => manifest),
    overridesWrite: () => writeOverrideDocument.mock.calls[0]?.[0],
    disabledOverridesWrite: () =>
      writeDisabledArtifactVersionOverrides.mock.calls[0],
    suppressedArtifactIdsWrite: () =>
      writeClearedLocalArtifactIds.mock.calls[0],
    reloadedTabId: (): number | undefined => reloadHostTab.mock.calls[0]?.[0],
  };
}
