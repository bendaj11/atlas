import type {
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountResult,
} from '../../lifecycle.js';
import { withAtlasProviders } from './atlas-providers.js';
import type { ExportedWidgetOptions } from './react-app.types.js';

/** Defines an exported widget entry; `setInputs` re-renders the same root with new props. */
export function defineExportedWidget<TProps extends object>(
  options: ExportedWidgetOptions<TProps>,
): AtlasExportedWidgetEntry<TProps> {
  return {
    mount(request): AtlasExportedWidgetMountResult<TProps> {
      const root = options.createRoot(request.container);
      const renderProps = (props: TProps): void => {
        root.render(
          withAtlasProviders(
            request,
            options.createElement({ ...request, props }),
          ),
        );
      };

      renderProps(request.props);

      return {
        setInputs: renderProps,
        unmount: () => root.unmount(),
      };
    },
  };
}
