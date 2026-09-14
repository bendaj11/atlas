import type { AtlasExtensionManifest as Manifest } from '../../../types/contracts';
import {
  localOverridesOf,
  readRuntimeErrors,
  readStoredOverrides,
  readVisibleAppIds,
  type StoredOverrides,
} from './page-runtime-state';

const DOCUMENT_KEY = 'atlas.runtime-overrides';

export class PageRuntimeStateDriver {
  private stored: StoredOverrides | undefined;
  private localOverrides: ReturnType<typeof localOverridesOf>;
  private runtimeErrors: ReturnType<typeof readRuntimeErrors> = [];
  private visibleAppIds: string[] = [];

  constructor() {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  }

  readonly given = {
    pageLocalStorage: (value: string): this => {
      localStorage.setItem(DOCUMENT_KEY, value);

      return this;
    },
    pageSessionStorage: (value: string): this => {
      sessionStorage.setItem(DOCUMENT_KEY, value);

      return this;
    },
    pageBody: (html: string): this => {
      document.body.innerHTML = html;

      return this;
    },
  };

  readonly when = {
    storedOverridesRead: (hostId: string): this => {
      this.stored = readStoredOverrides(DOCUMENT_KEY, hostId);

      return this;
    },
    localOverridesBuilt: (hostId: string, manifests: Manifest[]): this => {
      this.localOverrides = localOverridesOf(hostId, manifests);

      return this;
    },
    runtimeErrorsRead: (): this => {
      this.runtimeErrors = readRuntimeErrors();

      return this;
    },
    visibleAppIdsRead: (): this => {
      this.visibleAppIds = readVisibleAppIds();

      return this;
    },
  };

  readonly get = {
    stored: () => this.stored,
    localOverrides: () => this.localOverrides,
    runtimeErrors: () => this.runtimeErrors,
    visibleAppIds: (): string[] => this.visibleAppIds,
  };
}
