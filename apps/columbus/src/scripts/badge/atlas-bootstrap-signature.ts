const ATLAS_LOADER_SOURCE = /^\/atlas\.loader\.js(?:\?[^"']*)?$/i;

export function hasAtlasBootstrapSignature(document: Document): boolean {
  if (!document.getElementById('atlas-host-root')) return false;

  return [...document.querySelectorAll<HTMLScriptElement>('script[src]')].some(
    (script) => ATLAS_LOADER_SOURCE.test(script.getAttribute('src') ?? ''),
  );
}
