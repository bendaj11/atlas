import { jest } from '@jest/globals';
import { adaptShadowStyleSheet } from './shadow-styles.js';

export class ShadowStylesDriver {
  private readonly style = document.head.appendChild(
    document.createElement('style'),
  );
  private readonly adaptSelector = jest.fn((selector: string) =>
    selector.replace(':root', ':host'),
  );
  private failure: Error | undefined;

  readonly given = {
    cssText: (cssText: string) => {
      this.style.textContent = cssText;

      return this;
    },
    inaccessibleRules: (error: Error) => {
      this.failure = error;

      return this;
    },
  };

  readonly when = {
    adapted: () => {
      const sheet = this.style.sheet!;

      if (this.failure) {
        const failure = this.failure;

        Object.defineProperty(sheet, 'cssRules', {
          get() {
            throw failure;
          },
        });
      }

      adaptShadowStyleSheet(sheet, this.adaptSelector);
    },
  };

  readonly get = {
    selectorTexts: () =>
      [...this.style.sheet!.cssRules].flatMap((rule) =>
        rule instanceof CSSStyleRule ? [rule.selectorText] : [],
      ),
    adaptedSelectors: () =>
      this.adaptSelector.mock.calls.map(([selector]) => selector),
  };
}
