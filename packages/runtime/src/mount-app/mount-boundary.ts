import { AtlasStyleTargetMissingError } from './mount-app.errors.js';
import type {
  MountBoundary,
  MountBoundaryInput,
} from './mount-boundary.types.js';

export function createMountBoundary(input: MountBoundaryInput): MountBoundary {
  const { parent, id, isolation, kind } = input;
  const document = parent.ownerDocument ?? globalThis.document;
  const element = document?.createElement('div');

  if (!element) {
    return {
      container: parent,
      styleTarget: requireStyleTarget(document?.head, id),
      remove() {},
    };
  }

  element.dataset[kind === 'app' ? 'atlasApp' : 'atlasWidget'] = id;

  parent.append(element);

  if (isolation === 'shadow-dom') {
    const root = element.attachShadow({ mode: 'open' });
    const container = element.ownerDocument.createElement('div');
    container.dataset.atlasIsolationRoot = '';

    root.append(container);

    return { container, styleTarget: root, remove: () => element.remove() };
  }

  try {
    return {
      container: element,
      styleTarget: requireStyleTarget(element.ownerDocument.head, id),
      remove: () => element.remove(),
    };
  } catch (error) {
    element.remove();

    throw error;
  }
}

function requireStyleTarget(
  target: (Node & ParentNode) | null | undefined,
  boundaryId: string,
): Node & ParentNode {
  if (target) return target;

  throw new AtlasStyleTargetMissingError(boundaryId);
}
