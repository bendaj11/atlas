import { jest } from '@jest/globals';
import type { validateLocalOverride as validateLocalOverrideType } from '../local-override/local-override';
import type * as OverrideStorageModule from '../override-storage/override-storage';
import { reloadHostTabMock } from '../../../testkit/mocks/host-tabs';

const validateLocalOverride = jest.fn<typeof validateLocalOverrideType>();
const writeOverrideDocument =
  jest.fn<typeof OverrideStorageModule.writeOverrideDocument>();
const writeDisabledArtifactVersionOverrides =
  jest.fn<typeof OverrideStorageModule.writeDisabledArtifactVersionOverrides>();
const writeClearedLocalArtifactIds =
  jest.fn<typeof OverrideStorageModule.writeClearedLocalArtifactIds>();

jest.unstable_mockModule('../local-override/local-override', () => ({
  validateLocalOverride,
}));
jest.unstable_mockModule('../override-storage/override-storage', () => ({
  writeDisabledArtifactVersionOverrides,
  writeOverrideDocument,
  writeClearedLocalArtifactIds,
}));

export class PersistOverridesDriver {
  constructor() {
    jest.clearAllMocks();
    validateLocalOverride.mockResolvedValue(undefined);
    writeOverrideDocument.mockResolvedValue(undefined);
    writeDisabledArtifactVersionOverrides.mockResolvedValue(undefined);
    writeClearedLocalArtifactIds.mockResolvedValue(undefined);
    reloadHostTabMock.mockResolvedValue(undefined);
  }

  readonly given = {
    validationFailure: (error: Error) => {
      validateLocalOverride.mockRejectedValue(error);

      return this;
    },
  };

  readonly get = {
    validateLocalOverride: () => validateLocalOverride,
    writeOverrideDocument: () => writeOverrideDocument,
    writeDisabledArtifactVersionOverrides: () =>
      writeDisabledArtifactVersionOverrides,
    writeClearedLocalArtifactIds: () => writeClearedLocalArtifactIds,
    reloadHostTab: () => reloadHostTabMock,
  };
}
