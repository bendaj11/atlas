import { jest } from '@jest/globals';
import type { ExtensionSession } from '../../types/app';
import { aSession } from '../../types/app.testkit';
import type { reloadHostTab as reloadHostTabType } from '../host/host-tabs/host-tabs';
import type { validateLocalOverride as validateLocalOverrideType } from './local-override/local-override';
import type * as OverrideStorageModule from './override-storage/override-storage';

type OverrideStorage = typeof OverrideStorageModule;

const validateLocalOverride = jest.fn<typeof validateLocalOverrideType>();
const writeOverrideDocument =
  jest.fn<OverrideStorage['writeOverrideDocument']>();
const writeDisabledOverrides =
  jest.fn<OverrideStorage['writeDisabledOverrides']>();
const writeSuppressedArtifactIds =
  jest.fn<OverrideStorage['writeSuppressedArtifactIds']>();
const reloadHostTab = jest.fn<typeof reloadHostTabType>();
const calls: string[] = [];

jest.unstable_mockModule('../host/host-tabs/host-tabs', () => ({
  reloadHostTab,
}));
jest.unstable_mockModule('./local-override/local-override', () => ({
  validateLocalOverride,
}));
jest.unstable_mockModule('./override-storage/override-storage', () => ({
  writeDisabledOverrides,
  writeOverrideDocument,
  writeSuppressedArtifactIds,
}));

const { persistOverrideSession } = await import('./persist-overrides');

export class PersistOverridesDriver {
  private session: ExtensionSession = aSession();
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
    writeDisabledOverrides.mockImplementation(async () => {
      calls.push('writeDisabledOverrides');
    });
    writeSuppressedArtifactIds.mockImplementation(async () => {
      calls.push('writeSuppressedArtifactIds');
    });
    reloadHostTab.mockImplementation(async () => {
      calls.push('reload');
    });
  }

  readonly given = {
    session: (session: ExtensionSession): this => {
      this.session = session;

      return this;
    },
    validationFailure: (reason: string): this => {
      validateLocalOverride.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    persisted: async (): Promise<this> => {
      try {
        await persistOverrideSession(this.session);
      } catch (error) {
        this.error = error;
      }

      return this;
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    callOrder: (): string[] => calls,
    validatedManifests: () =>
      validateLocalOverride.mock.calls.map(([manifest]) => manifest),
    overridesWrite: () => writeOverrideDocument.mock.calls[0]?.[0],
    disabledOverridesWrite: () => writeDisabledOverrides.mock.calls[0],
    suppressedArtifactIdsWrite: () => writeSuppressedArtifactIds.mock.calls[0],
    reloadedTabId: (): number | undefined => reloadHostTab.mock.calls[0]?.[0],
  };
}
