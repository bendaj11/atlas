import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import { publishRuntimeSnapshot } from './runtime-snapshot.js';

interface SnapshotElement {
  id: string;
  type: string;
  textContent: string;
}

export class RuntimeSnapshotDriver {
  private existing: SnapshotElement | undefined;
  private created: SnapshotElement | undefined;
  private readonly append = jest.fn();

  readonly given = {
    existingSnapshotElement: (
      element: SnapshotElement,
    ): RuntimeSnapshotDriver => {
      this.existing = element;

      return this;
    },
  };

  readonly when = {
    published: (input: {
      runtime: AtlasHostRuntimeConfig;
      catalog: AtlasHostCatalog;
    }): void => {
      publishRuntimeSnapshot({
        ...input,
        document: {
          getElementById: () =>
            (this.existing as unknown as HTMLElement) ?? null,
          createElement: (() => {
            this.created = { id: '', type: '', textContent: '' };

            return this.created;
          }) as unknown as Document['createElement'],
          head: { append: this.append } as unknown as HTMLHeadElement,
        },
      });
    },
  };

  readonly get = {
    createdElement: (): SnapshotElement | undefined => this.created,
    appendMock: () => this.append,
  };
}
