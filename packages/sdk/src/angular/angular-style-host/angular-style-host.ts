export type StyleHostMutation = (host: Node) => void;

/** Minimal Angular style-host contract needed by Atlas mount isolation. */
export interface AngularComponentStyleHost {
  addHost: StyleHostMutation;
  removeHost: StyleHostMutation;
}

export interface AngularComponentStyleHostMount {
  readonly styleHost: AngularComponentStyleHost;
  readonly styleTarget: Node;
  readonly documentHead: HTMLHeadElement | undefined;
}

/** Redirects Angular's runtime component styles from the document to an Atlas mount boundary. */
export function attachAngularComponentStyles(
  input: AngularComponentStyleHostMount,
): void {
  const { documentHead, styleHost, styleTarget } = input;

  if (!documentHead || styleTarget === documentHead) return;
  styleHost.removeHost(documentHead);
  styleHost.addHost(styleTarget);
}
