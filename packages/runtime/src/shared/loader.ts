import { ATLAS_LOADER_HTML } from '@atlas/schema';

export function createLoaderElement(input: {
  document: Document;
  label: string;
  compact?: boolean;
}): Element {
  const template = input.document.createElement('template');
  template.innerHTML = ATLAS_LOADER_HTML;

  const loader = template.content.firstElementChild!;

  loader.setAttribute('aria-label', input.label);

  if (input.compact && loader instanceof HTMLElement)
    loader.style.padding = '0.25rem';

  return loader;
}
