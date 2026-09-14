import { jest } from '@jest/globals';
import type { ExtensionSession } from '../../types/app';
import { aSession } from '../../types/app.testkit';
import type * as AtlasHostModule from '../host/atlas-host/atlas-host';

type AtlasHost = typeof AtlasHostModule;

const validateLocalOverride = jest.fn<AtlasHost['validateLocalOverride']>();
const writeOverrides = jest.fn<AtlasHost['writeOverrides']>();
const writeDisabledOverrides = jest.fn<AtlasHost['writeDisabledOverrides']>();
const writeSuppressedArtifactIds =
  jest.fn<AtlasHost['writeSuppressedArtifactIds']>();
const reloadHostTab = jest.fn<AtlasHost['reloadHostTab']>();
const calls: string[] = [];

jest.unstable_mockModule('../host/atlas-host/atlas-host', () => ({
  reloadHostTab,
  validateLocalOverride,
  writeDisabledOverrides,
  writeOverrides,
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
    writeOverrides.mockImplementation(async () => {
      calls.push('writeOverrides');
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
    overridesWrite: () => writeOverrides.mock.calls[0]?.[0],
    disabledOverridesWrite: () => writeDisabledOverrides.mock.calls[0]?.[0],
    suppressedArtifactIdsWrite: () =>
      writeSuppressedArtifactIds.mock.calls[0]?.[0],
    reloadedTabId: (): number | undefined => reloadHostTab.mock.calls[0]?.[0],
  };
}
