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

export function loadHostStyles(context: HostStylesContext): void {
  context.manifest.styles?.forEach((stylesheet) =>
    appendHostStylesheet({ ...context, stylesheet }),
  );
}

function appendHostStylesheet({
  stylesheet,
  manifest,
  runtime,
  dependencies,
}: HostStylesContext & { stylesheet: AtlasStylesheet }): void {
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
