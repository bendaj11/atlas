import type { AtlasManifest, AtlasStylesheet } from '@atlas/schema';
import {
  assertManifestStylesTrust,
  PERMISSIVE_TRUST_POLICY,
} from '../loader/trust/trust-policy.js';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';
import { prepareShadowImports } from '../shadow-imports/shadow-imports.js';
import { adaptShadowStyleSheet } from '../shadow-styles/shadow-styles.js';
import {
  AtlasStylesheetAdaptError,
  AtlasStylesheetLoadError,
} from './stylesheets.errors.js';
import type {
  AtlasStyleRelease,
  AtlasStylesheetLoadInput,
  AtlasStylesheetLoadOptions,
  LoadedStylesheet,
} from './stylesheets.types.js';

const loadedStylesByTarget = new WeakMap<
  ParentNode,
  Map<string, LoadedStylesheet>
>();

/** Loads an app's declared styles into its document or isolation boundary. */
export async function loadManifestStyles(
  manifest: AtlasManifest,
  document: Document | undefined,
  input: AtlasStylesheetLoadInput = {},
): Promise<AtlasStyleRelease> {
  if (!document || !manifest.styles?.length) return () => undefined;

  const { policy, target } = normalizeStylesheetLoadInput(input, document);

  assertManifestStylesTrust(manifest, policy);

  const results = await Promise.allSettled(
    manifest.styles.map((stylesheet) =>
      acquireStylesheet({ document, target, stylesheet, appId: manifest.id }),
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

function normalizeStylesheetLoadInput(
  input: AtlasStylesheetLoadInput,
  document: Document,
): { policy: AtlasRemoteTrustPolicy; target: ParentNode } {
  if (isStylesheetLoadOptions(input)) {
    return {
      policy: input.policy ?? PERMISSIVE_TRUST_POLICY,
      target: input.target ?? document.head,
    };
  }

  return { policy: input, target: document.head };
}

function isStylesheetLoadOptions(
  input: AtlasStylesheetLoadInput,
): input is AtlasStylesheetLoadOptions {
  return 'target' in input || 'policy' in input;
}

async function acquireStylesheet(input: {
  document: Document;
  target: ParentNode;
  stylesheet: AtlasStylesheet;
  appId: string;
}): Promise<AtlasStyleRelease> {
  const { document, target, stylesheet, appId } = input;
  const loadedStyles = getLoadedStylesOfTarget(target);
  const existing = loadedStyles.get(stylesheet.href);

  if (existing) {
    existing.references += 1;

    await existing.ready;

    return createStylesheetRelease(loadedStyles, stylesheet.href, existing);
  }

  const element = document.createElement('link');
  element.rel = 'stylesheet';
  element.href = stylesheet.href;
  element.dataset.atlasStyle = appId;

  if ('host' in target) element.crossOrigin = 'anonymous';

  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = 'anonymous';
  }

  const ready = waitForStylesheetReady({ element, appId, target });
  const loaded = { element, ready, references: 1 };

  loadedStyles.set(stylesheet.href, loaded);
  target.append(element);

  try {
    await ready;

    return createStylesheetRelease(loadedStyles, stylesheet.href, loaded);
  } catch (error) {
    loadedStyles.delete(stylesheet.href);
    element.remove();

    throw error;
  }
}

function waitForStylesheetReady(input: {
  element: HTMLLinkElement;
  appId: string;
  target: ParentNode;
}): Promise<void> {
  const { element, appId, target } = input;

  return new Promise((resolve, reject) => {
    element.addEventListener(
      'load',
      async () => {
        try {
          if ('host' in target && element.sheet) {
            await prepareShadowImports(element.sheet, element.ownerDocument);
            adaptShadowStyleSheet(element.sheet);
          }

          resolve();
        } catch (cause) {
          reject(
            new AtlasStylesheetAdaptError({ appId, href: element.href, cause }),
          );
        }
      },
      { once: true },
    );
    element.addEventListener(
      'error',
      () => reject(new AtlasStylesheetLoadError({ appId, href: element.href })),
      { once: true },
    );
  });
}

function getLoadedStylesOfTarget(
  target: ParentNode,
): Map<string, LoadedStylesheet> {
  const existing = loadedStylesByTarget.get(target);

  if (existing) return existing;

  const loadedStyles = new Map<string, LoadedStylesheet>();

  loadedStylesByTarget.set(target, loadedStyles);

  return loadedStyles;
}

function createStylesheetRelease(
  loadedStyles: Map<string, LoadedStylesheet>,
  href: string,
  loaded: LoadedStylesheet,
): AtlasStyleRelease {
  let released = false;

  return () => {
    if (released) return;

    released = true;
    loaded.references -= 1;

    if (loaded.references > 0) return;

    loadedStyles.delete(href);
    loaded.element.remove();
  };
}
