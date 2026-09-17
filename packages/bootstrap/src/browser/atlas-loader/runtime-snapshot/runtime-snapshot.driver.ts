import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { RUNTIME_SNAPSHOT_ELEMENT_ID } from '../atlas-loader.constants.js';
import { publishRuntimeSnapshot } from './runtime-snapshot.js';

export class RuntimeSnapshotDriver {
  constructor() {
    document.head.replaceChildren();
  }

  readonly given = {
    existingSnapshotContent: (content: string) => {
      const element = document.createElement('script');
      element.id = RUNTIME_SNAPSHOT_ELEMENT_ID;
      element.type = 'application/json';
      element.textContent = content;

      document.head.append(element);

      return this;
    },
  };

  readonly when = {
    published: (input: {
      runtime: AtlasHostRuntimeConfig;
      catalog: AtlasHostCatalog;
    }) => {
      publishRuntimeSnapshot({ ...input, document });
    },
  };

  readonly get = {
    snapshotElements: () =>
      Array.from(document.head.querySelectorAll('script'), (element) => ({
        id: element.id,
        type: element.type,
        textContent: element.textContent,
      })),
  };
}
