import type { AtlasManifest, AtlasStylesheet } from "@atlas/schema";
import { assertManifestStylesTrust, type AtlasRemoteTrustPolicy } from "./loader/runtime-discovery.js";

export type AtlasStyleRelease = () => void;

interface LoadedStylesheet {
  element: HTMLLinkElement;
  ready: Promise<void>;
  references: number;
}

const documentStyles = new WeakMap<Document, Map<string, LoadedStylesheet>>();

/** Loads an app's declared styles once per document and returns a reference-counted release function. */
export async function loadManifestStyles(
  manifest: AtlasManifest,
  document: Document | undefined,
  policy: AtlasRemoteTrustPolicy = defaultManifestPolicy()
): Promise<AtlasStyleRelease> {
  if (!document || !manifest.styles?.length) return () => undefined;
  assertManifestStylesTrust(manifest, policy);
  const results = await Promise.allSettled(manifest.styles.map((stylesheet) => acquireStylesheet(document, stylesheet, manifest.id)));
  const releases = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failure) {
    releases.forEach((release) => release());
    throw failure.reason;
  }
  return () => releases.forEach((release) => release());
}

function defaultManifestPolicy(): AtlasRemoteTrustPolicy { return {}; }

async function acquireStylesheet(document: Document, stylesheet: AtlasStylesheet, mfId: string): Promise<AtlasStyleRelease> {
  const styles = stylesFor(document);
  const existing = styles.get(stylesheet.href);
  if (existing) {
    existing.references += 1;
    await existing.ready;
    return createRelease(styles, stylesheet.href, existing);
  }

  const element = document.createElement("link");
  element.rel = "stylesheet";
  element.href = stylesheet.href;
  element.dataset.atlasStyle = mfId;
  if (stylesheet.integrity) {
    element.integrity = stylesheet.integrity;
    element.crossOrigin = "anonymous";
  }
  const ready = stylesheetReady(element, mfId);
  const loaded = { element, ready, references: 1 };
  styles.set(stylesheet.href, loaded);
  document.head.append(element);
  try {
    await ready;
    return createRelease(styles, stylesheet.href, loaded);
  } catch (error) {
    styles.delete(stylesheet.href);
    element.remove();
    throw error;
  }
}

function stylesheetReady(element: HTMLLinkElement, mfId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    element.addEventListener("load", () => resolve(), { once: true });
    element.addEventListener("error", () => reject(new Error(`Atlas could not load stylesheet for app "${mfId}": ${element.href}`)), { once: true });
  });
}

function stylesFor(document: Document): Map<string, LoadedStylesheet> {
  const existing = documentStyles.get(document);
  if (existing) return existing;
  const styles = new Map<string, LoadedStylesheet>();
  documentStyles.set(document, styles);
  return styles;
}

function createRelease(styles: Map<string, LoadedStylesheet>, href: string, loaded: LoadedStylesheet): AtlasStyleRelease {
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
