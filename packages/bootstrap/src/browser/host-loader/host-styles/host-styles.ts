import type { AtlasStylesheet } from '@atlas/schema';
import type {
  HostLoadContext,
  HostLoaderDependencies,
} from '../host-loader.types.js';

export type HostStylesDependencies = Pick<
  HostLoaderDependencies,
  'document' | 'validateArtifactUrl'
>;

export interface HostStylesContext extends Pick<
  HostLoadContext,
  'manifest' | 'runtime'
> {
  dependencies: HostStylesDependencies;
}

export function loadHostStyles(context: HostStylesContext): () => void {
  const stylesheets = context.manifest.styles ?? [];

  for (const stylesheet of stylesheets)
    context.dependencies.validateArtifactUrl({
      url: new URL(stylesheet.href),
      manifest: context.manifest,
      runtime: context.runtime,
    });

  const links = stylesheets.map((stylesheet) =>
    appendHostStylesheet({
      document: context.dependencies.document,
      stylesheet,
    }),
  );

  return () => {
    for (const link of links) link.remove();
  };
}

function appendHostStylesheet({
  document,
  stylesheet,
}: {
  document: HostStylesDependencies['document'];
  stylesheet: AtlasStylesheet;
}): HTMLLinkElement {
  const element = document.createElement('link');
  element.rel = 'stylesheet';
  element.href = stylesheet.href;

  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = 'anonymous';
  }

  document.head.append(element);

  return element;
}
