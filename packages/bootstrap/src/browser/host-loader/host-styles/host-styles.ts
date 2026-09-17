import type { AtlasStylesheet } from '@atlas/schema';
import type { HostLoadContext } from '../host-loader.types.js';

export function loadHostStyles(context: HostLoadContext): void {
  context.manifest.styles?.forEach((stylesheet) =>
    appendHostStylesheet({ ...context, stylesheet }),
  );
}

function appendHostStylesheet({
  stylesheet,
  manifest,
  runtime,
  dependencies,
}: HostLoadContext & { stylesheet: AtlasStylesheet }): void {
  dependencies.validateArtifactUrl({
    url: new URL(stylesheet.href),
    manifest,
    runtime,
  });

  const element = dependencies.document.createElement('link');
  element.rel = 'stylesheet';
  element.href = stylesheet.href;

  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = 'anonymous';
  }

  dependencies.document.head.append(element);
}
