import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
  AtlasOverrideDocument as OverrideDocument,
} from '../../../types/contracts';
import type { Scope } from '../../../types/app';
import { aHostData } from '../../../types/app.testkit';
import { type FakeChrome, installFakeChrome } from '../../chrome.testkit';
import {
  type OverrideStorageLocation,
  readDisabledOverrides,
  readPersistedOverrideDocument,
  readSuppressedArtifactIds,
  writeDisabledOverrides,
  writeOverrideDocument,
  writeSuppressedArtifactIds,
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
  private disabledOverrides: Map<string, Manifest> = new Map();
  private suppressedArtifactIds: Set<string> = new Set();

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
    persistedDocumentRead: async (): Promise<this> => {
      this.persistedDocument = await readPersistedOverrideDocument(
        this.hostData,
      );

      return this;
    },
    documentWritten: async (
      overrides: OverrideDocument['overrides'],
      disabledAppIds: string[] = [],
    ): Promise<this> => {
      await writeOverrideDocument({
        tabId: 7,
        hostData: this.hostData,
        documentValue: { ...this.emptyDocument, overrides },
        scope: this.location.scope,
        disabledAppIds,
      });

      return this;
    },
    disabledOverridesWritten: async (
      overrides: Map<string, Manifest>,
    ): Promise<this> => {
      await writeDisabledOverrides(this.location, overrides);

      return this;
    },
    disabledOverridesRead: async (): Promise<this> => {
      this.disabledOverrides = await readDisabledOverrides(this.location);

      return this;
    },
    suppressedArtifactIdsWritten: async (ids: Set<string>): Promise<this> => {
      await writeSuppressedArtifactIds(this.location, ids);

      return this;
    },
    suppressedArtifactIdsRead: async (): Promise<this> => {
      this.suppressedArtifactIds = await readSuppressedArtifactIds(
        this.location,
      );

      return this;
    },
  };

  readonly get = {
    hostId: (): string => this.hostData.config.hostId,
    persistedDocument: () => this.persistedDocument,
    disabledOverrides: () => this.disabledOverrides,
    suppressedArtifactIds: () => this.suppressedArtifactIds,
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
