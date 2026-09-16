import {
  attachAngularComponentStyles,
  type AngularComponentStyleHost,
} from './angular-style-host.js';

interface RecordingStyleHost extends AngularComponentStyleHost {
  addStyles(styles: string[]): void;
}

export class AngularStyleHostDriver {
  private readonly documentHead = {} as HTMLHeadElement;
  private readonly shadowRoot = {} as ShadowRoot;
  private readonly styleHost: RecordingStyleHost = {
    addHost: (host) => this.addedHosts.push(host),
    removeHost: (host) => this.removedHosts.push(host),
    addStyles: () => this.styleHosts.push(...this.addedHosts),
  };
  private readonly addedHosts: Node[] = [];
  private readonly removedHosts: Node[] = [];
  private readonly styleHosts: Node[] = [];
  private styleTarget: Node = this.documentHead;

  given = {
    styleTarget: (target: 'document-head' | 'shadow-root'): this => {
      this.styleTarget =
        target === 'shadow-root' ? this.shadowRoot : this.documentHead;
      return this;
    },
  };

  when = {
    attachComponentStyles: (): void => {
      attachAngularComponentStyles({
        styleHost: this.styleHost,
        styleTarget: this.styleTarget,
        documentHead: this.documentHead,
      });
    },
    attachAndAddUnscopedComponentStyle: (): void => {
      attachAngularComponentStyles({
        styleHost: this.styleHost,
        styleTarget: this.shadowRoot,
        documentHead: this.documentHead,
      });
      this.styleHost.addStyles(['.component-library-style{color:purple}']);
    },
  };

  get = {
    stylesAreAttachedOnlyToShadowRoot: (): boolean =>
      this.removedHosts[0] === this.documentHead &&
      this.addedHosts[0] === this.shadowRoot,
    stylesRemainAtDocumentHead: (): boolean =>
      this.removedHosts.length === 0 && this.addedHosts.length === 0,
    unscopedStylesAreAttachedOnlyToShadowRoot: (): boolean =>
      this.styleHosts.length === 1 && this.styleHosts[0] === this.shadowRoot,
  };
}
