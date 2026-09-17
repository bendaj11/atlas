import { jest } from '@jest/globals';
import {
  attachAngularComponentStyles,
  type StyleHostMutation,
} from './angular-style-host.js';

export class AngularStyleHostDriver {
  private readonly documentHead = {} as HTMLHeadElement;
  private readonly shadowRoot = {} as ShadowRoot;
  private readonly addHost = jest.fn<StyleHostMutation>();
  private readonly removeHost = jest.fn<StyleHostMutation>();
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
    addHostMock: (): jest.Mock<StyleHostMutation> => this.addHost,
    removeHostMock: (): jest.Mock<StyleHostMutation> => this.removeHost,
    documentHead: (): HTMLHeadElement => this.documentHead,
    shadowRoot: (): ShadowRoot => this.shadowRoot,
  };
}
