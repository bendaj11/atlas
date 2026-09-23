import type { AtlasDomIsolation } from '@atlas/schema';

export type MountBoundaryKind = 'app' | 'widget';

export interface MountBoundary {
  container: HTMLElement;
  styleTarget: Node & ParentNode;
  remove(): void;
}

export interface MountBoundaryInput {
  parent: HTMLElement;
  id: string;
  isolation: AtlasDomIsolation;
  kind: MountBoundaryKind;
}
