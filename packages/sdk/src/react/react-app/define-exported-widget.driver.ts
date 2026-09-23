import type { ReactNode } from 'react';
import { jest } from '@jest/globals';
import type {
  AtlasExportedWidgetMountRequest,
  AtlasExportedWidgetMountResult,
} from '../../lifecycle.js';
import { anExportedWidgetManifest } from '../../testkit/app-context.testkit.js';
import { defineExportedWidget } from './define-exported-widget.js';
import { aMountRequest, aRootAdapter } from './react-app.testkit.js';

interface WidgetProps {
  readonly count: number;
}

export class DefineExportedWidgetDriver {
  private readonly root = aRootAdapter();
  private readonly createElement = jest.fn<
    (request: AtlasExportedWidgetMountRequest<WidgetProps>) => ReactNode
  >((request) => JSON.stringify(request.props));
  private mounted: AtlasExportedWidgetMountResult<WidgetProps> | void =
    undefined;

  readonly when = {
    mounted: async (props: WidgetProps) => {
      const request = aMountRequest();
      this.mounted = await defineExportedWidget<WidgetProps>({
        createRoot: this.root.createRoot,
        createElement: this.createElement,
      }).mount({
        ...request,
        props,
        widget: anExportedWidgetManifest({
          ownerAppId: request.context.manifest.id,
        }),
        ownerManifest: request.context.manifest,
      });
    },
    inputsSet: (props: WidgetProps) => {
      this.mounted?.setInputs?.(props);
    },
    unmounted: () => this.mounted?.unmount?.(),
  };

  readonly get = {
    createElementMock: (): jest.Mock<
      (request: AtlasExportedWidgetMountRequest<WidgetProps>) => ReactNode
    > => this.createElement,
    renderMock: () => this.root.render,
    unmountRootMock: () => this.root.unmount,
  };
}
