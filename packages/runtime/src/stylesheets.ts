import type { AtlasManifest, AtlasStylesheet } from '@atlas/schema';
import {
  assertManifestStylesTrust,
  type AtlasRemoteTrustPolicy,
} from './loader/runtime-discovery.js';

export type AtlasStyleRelease = () => void;

/** Defines where a remote's declared styles are installed. */
export interface AtlasStylesheetLoadOptions {
  readonly policy?: AtlasRemoteTrustPolicy;
  readonly target?: ParentNode;
}

type AtlasStylesheetLoadInput =
  AtlasRemoteTrustPolicy | AtlasStylesheetLoadOptions;

interface LoadedStylesheet {
  element: HTMLLinkElement;
  ready: Promise<void>;
  references: number;
}

const stylesByTarget = new WeakMap<ParentNode, Map<string, LoadedStylesheet>>();

/** Loads an app's declared styles into its document or isolation boundary. */
export async function loadManifestStyles(
  manifest: AtlasManifest,
  document: Document | undefined,
  input: AtlasStylesheetLoadInput = {},
): Promise<AtlasStyleRelease> {
  if (!document || !manifest.styles?.length) return () => undefined;
  const { policy, target } = stylesheetLoadOptions(input, document);
  if (!target) return () => undefined;
  assertManifestStylesTrust(manifest, policy);
  const results = await Promise.allSettled(
    manifest.styles.map((stylesheet) =>
      acquireStylesheet(document, target, stylesheet, manifest.id),
    ),
  );
  const releases = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) {
    releases.forEach((release) => release());
    throw failure.reason;
  }
  return () => releases.forEach((release) => release());
}

function stylesheetLoadOptions(
  input: AtlasStylesheetLoadInput,
  document: Document,
): Required<Pick<AtlasStylesheetLoadOptions, 'policy'>> &
  Pick<AtlasStylesheetLoadOptions, 'target'> {
  if (isStylesheetLoadOptions(input)) {
    return {
      policy: input.policy ?? defaultManifestPolicy(),
      ...(input.target ? { target: input.target } : { target: document.head }),
    };
  }
  return { policy: input, target: document.head };
}

function isStylesheetLoadOptions(
  input: AtlasStylesheetLoadInput,
): input is AtlasStylesheetLoadOptions {
  return 'target' in input || 'policy' in input;
}

function defaultManifestPolicy(): AtlasRemoteTrustPolicy {
  return {};
}

async function acquireStylesheet(
  document: Document,
  target: ParentNode,
  stylesheet: AtlasStylesheet,
  appId: string,
): Promise<AtlasStyleRelease> {
  const styles = stylesFor(target);
  const existing = styles.get(stylesheet.href);
  if (existing) {
    existing.references += 1;
    await existing.ready;
    return createRelease(styles, stylesheet.href, existing);
  }

  const element = document.createElement('link');
  element.rel = 'stylesheet';
  element.href = stylesheet.href;
  element.dataset.atlasStyle = appId;
  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = 'anonymous';
  }
  const ready = stylesheetReady(element, appId);
  const loaded = { element, ready, references: 1 };
  styles.set(stylesheet.href, loaded);
  target.append(element);
  try {
    await ready;
    return createRelease(styles, stylesheet.href, loaded);
  } catch (error) {
    styles.delete(stylesheet.href);
    element.remove();
    throw error;
  }
}

function stylesheetReady(
  element: HTMLLinkElement,
  appId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    element.addEventListener('load', () => resolve(), { once: true });
    element.addEventListener(
      'error',
      () =>
        reject(
          new Error(
            `Atlas could not load stylesheet for app "${appId}": ${element.href}`,
          ),
        ),
      { once: true },
    );
  });
}

function stylesFor(target: ParentNode): Map<string, LoadedStylesheet> {
  const existing = stylesByTarget.get(target);
  if (existing) return existing;
  const styles = new Map<string, LoadedStylesheet>();
  stylesByTarget.set(target, styles);
  return styles;
}

function createRelease(
  styles: Map<string, LoadedStylesheet>,
  href: string,
  loaded: LoadedStylesheet,
): AtlasStyleRelease {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    loaded.references -= 1;
    if (loaded.references > 0) return;
    styles.delete(href);
    loaded.element.remove();
  };
}
