import { faker } from '@faker-js/faker';
import type { AtlasDomIsolation } from '@atlas/schema';
import { createMountBoundary } from './mount-boundary.js';
import type {
  MountBoundary,
  MountBoundaryKind,
} from './mount-boundary.types.js';

const ALL_ISOLATIONS: readonly AtlasDomIsolation[] = [
  'shared-dom',
  'shadow-dom',
  'scoped',
];
const ALL_KINDS: readonly MountBoundaryKind[] = ['app', 'widget'];

export class MountBoundaryDriver {
  private parent = document.body.appendChild(document.createElement('div'));
  private id = faker.string.uuid();
  private isolation = faker.helpers.arrayElement(ALL_ISOLATIONS);
  private kind = faker.helpers.arrayElement(ALL_KINDS);
  private boundary: MountBoundary | undefined;
  private error: unknown;

  readonly given = {
    headlessDocument: () => {
      const headless = document.implementation.createHTMLDocument();

      headless.head.remove();

      this.parent = headless.body.appendChild(headless.createElement('div'));

      return this;
    },
    id: (id: string) => {
      this.id = id;

      return this;
    },
    isolation: (isolation: AtlasDomIsolation) => {
      this.isolation = isolation;

      return this;
    },
    kind: (kind: MountBoundaryKind) => {
      this.kind = kind;

      return this;
    },
  };

  readonly when = {
    created: () => {
      try {
        this.boundary = createMountBoundary({
          parent: this.parent,
          id: this.id,
          isolation: this.isolation,
          kind: this.kind,
        });
      } catch (error) {
        this.error = error;
      }
    },
    removed: () => this.boundary!.remove(),
  };

  readonly get = {
    container: () => this.boundary!.container,
    styleTarget: () => this.boundary!.styleTarget,
    parentChild: () => this.parent.firstElementChild,
    parentChildCount: () => this.parent.childElementCount,
    error: () => this.error,
  };
}
