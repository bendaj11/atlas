import { jest } from '@jest/globals';
import type {
  AtlasExportedWidgetMountRequest,
  AtlasExportedWidgetMountResult,
} from '../../lifecycle.js';
import { anExportedWidgetManifest } from '../../testkit/app-context.testkit.js';
import { defineExportedWidget } from './define-exported-widget.js';
import { aMountRequest, aRootAdapter } from './react-app.testkit.js';
import type { RenderRoot, UnmountRoot } from './react-app.types.js';

interface WidgetProps {
  readonly count: number;
}

export class DefineExportedWidgetDriver {
  private readonly root = aRootAdapter();
  private readonly createElement = jest.fn<
    (request: AtlasExportedWidgetMountRequest<WidgetProps>) => unknown
  >((request) => request.props);
  private mounted: AtlasExportedWidgetMountResult<WidgetProps> | void =
    undefined;

  readonly when = {
    mounted: async (props: WidgetProps): Promise<void> => {
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
    inputsSet: (props: WidgetProps): void => {
      this.mounted?.setInputs?.(props);
    },
    unmounted: async (): Promise<void> => {
      await this.mounted?.unmount?.();
    },
  };

  readonly get = {
    createElementMock: (): jest.Mock<
      (request: AtlasExportedWidgetMountRequest<WidgetProps>) => unknown
    > => this.createElement,
    renderMock: (): jest.Mock<RenderRoot> => this.root.render,
    unmountRootMock: (): jest.Mock<UnmountRoot> => this.root.unmount,
  };
}
