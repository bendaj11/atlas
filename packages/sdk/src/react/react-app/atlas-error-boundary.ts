import { Component, type ReactNode } from 'react';
import type { AtlasAppContext } from '../../lifecycle.js';

export interface AtlasErrorBoundaryProps {
  context: AtlasAppContext;
  children?: ReactNode;
}

interface AtlasErrorBoundaryState {
  failed: boolean;
}

/** Reports render errors of an Atlas-mounted tree to the host instead of leaving the placement blank. */
export class AtlasErrorBoundary extends Component<
  AtlasErrorBoundaryProps,
  AtlasErrorBoundaryState
> {
  override state = { failed: false };

  static getDerivedStateFromError(): AtlasErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.context.fail(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
