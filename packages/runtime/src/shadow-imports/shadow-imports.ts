import { generate, parse, walk, type Atrule, type CssNode } from 'css-tree';

/** Read imports with CORS; browser CSSOM access does not propagate through @import. */
export async function prepareShadowImports(
  sheet: CSSStyleSheet,
  document: Document,
): Promise<void> {
  const rules = Array.from(sheet.cssRules);

  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    if (!rule || !('href' in rule) || !('styleSheet' in rule)) continue;
    const imported = rule as CSSImportRule;
    const href = new URL(imported.href, sheet.href ?? document.baseURI).href;
    const css = await readImport(href, new Set(sheet.href ? [sheet.href] : []));
    const replacement = wrapImport(css, imported);

    sheet.deleteRule(index);
    try {
      sheet.insertRule(replacement, index);
    } catch (error) {
      sheet.insertRule(imported.cssText, index);
      throw error;
    }
  }
}

async function readImport(
  href: string,
  ancestors: ReadonlySet<string>,
): Promise<string> {
  if (ancestors.has(href)) return '';
  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const baseUrl = response.url || href;
    const visited = new Set([...ancestors, href, baseUrl]);
    // Preserve original declarations: CSSOM serialization can drop variable shorthands.
    const tree = parse(await response.text(), { parseCustomProperty: true });
    if (tree.type !== 'StyleSheet') throw new Error('Expected a stylesheet');
    absolutizeUrls(tree, baseUrl);

    for (const item of tree.children.toArray()) {
      if (item.type !== 'Atrule' || item.name.toLowerCase() !== 'import')
        continue;
      const prelude = importPrelude(item);
      const source = prelude[0];
      if (!source || (source.type !== 'String' && source.type !== 'Url'))
        throw new Error('Invalid CSS import');
      const css = await readImport(
        new URL(source.value, baseUrl).href,
        visited,
      );
      const replacement = parse(wrapPrelude(css, prelude.slice(1)));
      const entry = tree.children.toArray().indexOf(item);
      const nodes = tree.children.toArray();
      nodes.splice(
        entry,
        1,
        ...(replacement.type === 'StyleSheet'
          ? replacement.children.toArray()
          : []),
      );
      tree.children.fromArray(nodes);
    }
    return generate(tree);
  } catch (cause) {
    throw new Error(`Could not load CSS import: ${href}`, { cause });
  }
}

function importPrelude(rule: Atrule): CssNode[] {
  return rule.prelude?.type === 'AtrulePrelude'
    ? rule.prelude.children.toArray()
    : [];
}

function absolutizeUrls(tree: CssNode, href: string): void {
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

function wrapPrelude(css: string, conditions: CssNode[]): string {
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

function wrapImport(css: string, rule: CSSImportRule): string {
  let result = `@media ${rule.media.mediaText || 'all'} {${css}}`;
  if (rule.supportsText)
    result = `@supports (${rule.supportsText}) {${result}}`;
  if (rule.layerName !== null && rule.layerName !== undefined)
    result = `@layer ${rule.layerName} {${result}}`;
  return result;
}
