import { ATLAS_LOADER_HTML } from '@atlas/schema';

export function createLoaderElement(input: {
  document: Document;
  label: string;
}): Element {
  const template = input.document.createElement('template');
  template.innerHTML = ATLAS_LOADER_HTML;

  const loader = template.content.firstElementChild!;

  loader.setAttribute('aria-label', input.label);

  return loader;
}
