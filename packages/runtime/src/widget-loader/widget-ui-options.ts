import type { AtlasWidgetUiOptions } from './widget-loader.types.js';

export function pickWidgetUiOptionsFrom(
  source: AtlasWidgetUiOptions,
): AtlasWidgetUiOptions {
  return {
    ...(source.renderWidgetLoading
      ? { renderWidgetLoading: source.renderWidgetLoading }
      : {}),
    ...(source.renderWidgetError
      ? { renderWidgetError: source.renderWidgetError }
      : {}),
  };
}
