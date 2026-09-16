import { jest } from '@jest/globals';
import {
  attachAngularComponentStyles,
  type AngularComponentStyleHost,
} from './angular-style-host.js';

export class AngularStyleHostDriver {
  private readonly documentHead = {} as HTMLHeadElement;
  private readonly shadowRoot = {} as ShadowRoot;
  private readonly addHost = jest.fn<AngularComponentStyleHost['addHost']>();
  private readonly removeHost =
    jest.fn<AngularComponentStyleHost['removeHost']>();
  private styleTarget: Node = this.documentHead;
  private head: HTMLHeadElement | undefined = this.documentHead;

  readonly given = {
    styleTarget: (target: 'document-head' | 'shadow-root'): this => {
      this.styleTarget =
        target === 'shadow-root' ? this.shadowRoot : this.documentHead;

      return this;
    },
    documentHead: (head: 'present' | 'missing'): this => {
      this.head = head === 'present' ? this.documentHead : undefined;

      return this;
    },
  };

  readonly when = {
    componentStylesAttached: (): void => {
      attachAngularComponentStyles({
        styleHost: { addHost: this.addHost, removeHost: this.removeHost },
        styleTarget: this.styleTarget,
        documentHead: this.head,
      });
    },
  };

  readonly get = {
    addHostMock: (): jest.Mock<AngularComponentStyleHost['addHost']> =>
      this.addHost,
    removeHostMock: (): jest.Mock<AngularComponentStyleHost['removeHost']> =>
      this.removeHost,
    documentHead: (): HTMLHeadElement => this.documentHead,
    shadowRoot: (): ShadowRoot => this.shadowRoot,
  };
}
