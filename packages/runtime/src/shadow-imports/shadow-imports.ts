import type { Atrule, CssNode } from 'css-tree';
import generate from 'css-tree/generator';
import parse from 'css-tree/parser';
import walk from 'css-tree/walker';

interface FetchedCss {
  text: string;
  baseUrl: string;
}

type CssFetchCache = Map<string, Promise<FetchedCss>>;

/** Read imports with CORS; browser CSSOM access does not propagate through @import. */
export async function prepareShadowImports(
  sheet: CSSStyleSheet,
  document: Document,
): Promise<void> {
  const rules = Array.from(sheet.cssRules);
  const cache: CssFetchCache = new Map();
  const imports = rules.flatMap((rule, index) =>
    isImportRule(rule) ? [{ rule, index }] : [],
  );
  const replacements = await Promise.all(
    imports.map(async ({ rule }) => {
      const href = new URL(rule.href, sheet.href ?? document.baseURI).href;
      const css = await fetchAndInlineCssImport({
        href,
        ancestors: new Set(sheet.href ? [sheet.href] : []),
        cache,
      });

      return wrapCssInImportConditions(css, rule);
    }),
  );

  for (let position = imports.length - 1; position >= 0; position -= 1) {
    const { rule, index } = imports[position]!;

    sheet.deleteRule(index);

    try {
      sheet.insertRule(replacements[position]!, index);
    } catch (error) {
      sheet.insertRule(rule.cssText, index);

      throw error;
    }
  }
}

function fetchCssOnce(href: string, cache: CssFetchCache): Promise<FetchedCss> {
  const cached = cache.get(href);

  if (cached) return cached;

  const fetching = fetch(href).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return { text: await response.text(), baseUrl: response.url || href };
  });

  cache.set(href, fetching);

  return fetching;
}

async function fetchAndInlineCssImport(input: {
  href: string;
  ancestors: ReadonlySet<string>;
  cache: CssFetchCache;
}): Promise<string> {
  const { href, ancestors, cache } = input;

  if (ancestors.has(href)) return '';

  try {
    const { text, baseUrl } = await fetchCssOnce(href, cache);
    const visited = new Set([...ancestors, href, baseUrl]);
    const tree = parse(text, { parseCustomProperty: true });

    if (tree.type !== 'StyleSheet') throw new Error('Expected a stylesheet');

    absolutizeUrlsInTree(tree, baseUrl);

    const nodes = tree.children.toArray();
    const inlined = await Promise.all(
      nodes.map(async (item) => {
        if (item.type !== 'Atrule' || item.name.toLowerCase() !== 'import')
          return [item];

        const prelude = extractImportPrelude(item);
        const source = prelude[0];

        if (!source || (source.type !== 'String' && source.type !== 'Url'))
          throw new Error('Invalid CSS import');

        const css = await fetchAndInlineCssImport({
          href: new URL(source.value, baseUrl).href,
          ancestors: visited,
          cache,
        });
        const replacement = parse(
          wrapCssInPreludeConditions(css, prelude.slice(1)),
        );

        return replacement.type === 'StyleSheet'
          ? replacement.children.toArray()
          : [];
      }),
    );

    tree.children.fromArray(inlined.flat());

    return generate(tree);
  } catch (cause) {
    throw new Error(`Could not load CSS import: ${href}`, { cause });
  }
}

function extractImportPrelude(rule: Atrule): CssNode[] {
  return rule.prelude?.type === 'AtrulePrelude'
    ? rule.prelude.children.toArray()
    : [];
}

function absolutizeUrlsInTree(tree: CssNode, href: string): void {
  walk(tree, {
    enter(node: CssNode) {
      if (node.type === 'Url') node.value = new URL(node.value, href).href;

      if (
        node.type === 'Function' &&
        ['image-set', '-webkit-image-set'].includes(node.name.toLowerCase())
      )
        node.children.forEach((child) => {
          if (child.type === 'String')
            child.value = new URL(child.value, href).href;
        });
    },
  });
}

function wrapCssInPreludeConditions(
  css: string,
  conditions: CssNode[],
): string {
  return conditions.reduceRight((result, condition) => {
    if (condition.type === 'Identifier' && condition.name === 'layer')
      return `@layer {${result}}`;

    if (condition.type === 'Function' && condition.name === 'layer')
      return `@layer ${condition.children
        .toArray()
        .map((node) => generate(node))
        .join('')} {${result}}`;

    if (condition.type === 'Function' && condition.name === 'supports')
      return `@supports (${condition.children
        .toArray()
        .map((node) => generate(node))
        .join('')}) {${result}}`;
    return `@media ${generate(condition)} {${result}}`;
  }, css);
}

function wrapCssInImportConditions(css: string, rule: CSSImportRule): string {
  let result = `@media ${rule.media.mediaText || 'all'} {${css}}`;

  if (rule.supportsText)
    result = `@supports (${rule.supportsText}) {${result}}`;

  if (rule.layerName !== null && rule.layerName !== undefined)
    result = `@layer ${rule.layerName} {${result}}`;
  return result;
}

function isImportRule(rule: CSSRule): rule is CSSImportRule {
  return 'href' in rule && 'styleSheet' in rule;
}
