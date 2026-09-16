import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import type { AtlasOverrideDocument as OverrideDocument } from '../../../types/override-document';
import type { Scope } from '../../../types/columbus-state';
import { aHostData } from '../../../types/host-data.testkit';
import { type FakeChrome, installFakeChrome } from '../../chrome.testkit';
import {
  type OverrideStorageLocation,
  readDisabledArtifactVersionOverrides,
  readPersistedOverrideDocument,
  readClearedLocalArtifactIds,
  writeDisabledArtifactVersionOverrides,
  writeOverrideDocument,
  writeClearedLocalArtifactIds,
} from './override-storage';

export class OverrideStorageDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly hostData: HostData = aHostData();
  private readonly location: OverrideStorageLocation = {
    hostId: this.hostData.config.hostId,
    tabId: 7,
    scope: 'all',
  };
  private readonly emptyDocument: OverrideDocument = {
    schemaVersion: '1',
    hostId: this.hostData.config.hostId,
    overrides: [],
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
  private persistedDocument: OverrideDocument | undefined;
  private disabledArtifactVersionOverrides: Map<string, ArtifactVersion> =
    new Map();
  private clearedLocalArtifactIds: Set<string> = new Set();

  constructor() {
    localStorage.clear();
    sessionStorage.clear();
  }

  readonly given = {
    scope: (scope: Scope): this => {
      this.location.scope = scope;

      return this;
    },
    extensionStorage: (key: string, value: unknown): this => {
      this.chrome.localStorage.set(key, value);

      return this;
    },
  };

  readonly when = {
    persistedDocumentRead: async (): Promise<void> => {
      this.persistedDocument = await readPersistedOverrideDocument(
        this.hostData,
      );
    },
    documentWritten: async (
      overrides: OverrideDocument['overrides'],
      disabledAppIds: string[] = [],
    ): Promise<void> => {
      await writeOverrideDocument({
        tabId: 7,
        hostData: this.hostData,
        documentValue: { ...this.emptyDocument, overrides },
        scope: this.location.scope,
        disabledAppIds,
      });
    },
    disabledOverridesWritten: async (
      overrides: Map<string, ArtifactVersion>,
    ): Promise<void> => {
      await writeDisabledArtifactVersionOverrides(this.location, overrides);
    },
    disabledOverridesRead: async (): Promise<void> => {
      this.disabledArtifactVersionOverrides =
        await readDisabledArtifactVersionOverrides(this.location);
    },
    suppressedArtifactIdsWritten: async (ids: Set<string>): Promise<void> => {
      await writeClearedLocalArtifactIds(this.location, ids);
    },
    suppressedArtifactIdsRead: async (): Promise<void> => {
      this.clearedLocalArtifactIds = await readClearedLocalArtifactIds(
        this.location,
      );
    },
  };

  readonly get = {
    hostId: (): string => this.hostData.config.hostId,
    persistedDocument: () => this.persistedDocument,
    disabledArtifactVersionOverrides: () =>
      this.disabledArtifactVersionOverrides,
    clearedLocalArtifactIds: () => this.clearedLocalArtifactIds,
    extensionStorage: (key: string): unknown =>
      this.chrome.localStorage.get(key),
    pageLocalStorage: (key: string): unknown =>
      parse(localStorage.getItem(key)),
    pageSessionStorage: (key: string): unknown =>
      parse(sessionStorage.getItem(key)),
  };
}

function parse(value: string | null): unknown {
  return value === null ? undefined : JSON.parse(value);
}
