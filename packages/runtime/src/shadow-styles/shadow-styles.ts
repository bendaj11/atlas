import { generate, List, parse, walk, type CssNode } from 'css-tree';

/** Adapt document-root selectors without changing declarations or asset URLs. */
export function adaptShadowRootSelector(selector: string): string {
  const tree = parse(selector, { context: 'selectorList' });
  let changed = false;

  walk(tree, {
    visit: 'Selector',
    leave(node) {
      const children: CssNode[] = [];
      let compound: CssNode[] = [];
      const flush = () => {
        const roots = compound.filter(isRoot);
        if (roots.length) {
          const qualifier = compound.filter((child) => !isRoot(child));
          const host = qualifier.length
            ? `:host(${qualifier.map((child) => generate(child)).join('')})`
            : ':host';
          const replacement = parse(host, { context: 'selector' });
          if (replacement.type === 'Selector')
            children.push(...replacement.children.toArray());
          changed = true;
        } else children.push(...compound);
        compound = [];
      };

      node.children.forEach((child) => {
        if (child.type === 'Combinator') {
          flush();
          children.push(child);
        } else compound.push(child);
      });
      flush();
      node.children = new List<CssNode>().fromArray(children);
    },
  });

  return changed ? generate(tree) : selector;
}

function isRoot(node: CssNode): boolean {
  return (
    node.type === 'PseudoClassSelector' && node.name.toLowerCase() === 'root'
  );
}

export function adaptShadowStyleSheet(
  sheet: CSSStyleSheet,
  adaptSelector = adaptShadowRootSelector,
): void {
  adaptRules(sheet.cssRules, adaptSelector);
}

function adaptRules(
  rules: CSSRuleList,
  adaptSelector: (selector: string) => string,
): void {
  for (const rule of Array.from(rules)) {
    if ('selectorText' in rule && typeof rule.selectorText === 'string') {
      rule.selectorText = adaptSelector(rule.selectorText);
    }
    if ('cssRules' in rule) {
      adaptRules((rule as CSSGroupingRule).cssRules, adaptSelector);
    } else if ('styleSheet' in rule) {
      const imported = (rule as CSSImportRule).styleSheet;
      if (imported) adaptRules(imported.cssRules, adaptSelector);
    }
  }
}
