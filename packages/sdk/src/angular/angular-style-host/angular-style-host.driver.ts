import { jest } from '@jest/globals';
import {
  attachAngularComponentStyles,
  type StyleHostMutation,
} from './angular-style-host.js';

export class AngularStyleHostDriver {
  private readonly documentHead = document.head;
  private readonly shadowRoot = document
    .createElement('div')
    .attachShadow({ mode: 'open' });
  private readonly addHost = jest.fn<StyleHostMutation>();
  private readonly removeHost = jest.fn<StyleHostMutation>();
  private styleTarget: Node = this.documentHead;
  private head: HTMLHeadElement | undefined = this.documentHead;

  readonly given = {
    styleTarget: (target: 'document-head' | 'shadow-root') => {
      this.styleTarget =
        target === 'shadow-root' ? this.shadowRoot : this.documentHead;

      return this;
    },
    documentHead: (head: 'present' | 'missing') => {
      this.head = head === 'present' ? this.documentHead : undefined;

      return this;
    },
  };

  readonly when = {
    componentStylesAttached: () => {
      attachAngularComponentStyles({
        styleHost: { addHost: this.addHost, removeHost: this.removeHost },
        styleTarget: this.styleTarget,
        documentHead: this.head,
      });
    },
  };

  readonly get = {
    addHostMock: () => this.addHost,
    removeHostMock: () => this.removeHost,
    documentHead: () => this.documentHead,
    shadowRoot: () => this.shadowRoot,
  };
}
