export function isElement(node: Node | EventTarget): node is Element {
  return typeof Element === 'undefined'
    ? 'getAttribute' in node && 'setAttribute' in node
    : node instanceof Element;
}

export function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value;
}

export function hasQuerySelectorAll(node: Node): node is Node & ParentNode {
  return (
    'querySelectorAll' in node && typeof node.querySelectorAll === 'function'
  );
}
