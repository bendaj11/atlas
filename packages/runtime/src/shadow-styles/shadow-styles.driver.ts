import { jest } from '@jest/globals';
import { adaptShadowStyleSheet } from './shadow-styles.js';

export class ShadowStylesDriver {
  private rules: CSSRule[] = [];
  private failure: Error | undefined;
  private readonly selector = jest.fn((value: string) =>
    value.replace(':root', ':host'),
  );

  readonly given = {
    rules: (rules: unknown[]): void => {
      this.rules = rules as CSSRule[];
    },
    inaccessible: (error: Error): void => {
      this.failure = error;
    },
  };

  readonly when = {
    adapt: (): void => {
      const rules = this.rules;
      const failure = this.failure;
      const sheet = {
        get cssRules() {
          if (failure) throw failure;
          return rules;
        },
      } as unknown as CSSStyleSheet;
      adaptShadowStyleSheet(sheet, this.selector);
    },
  };

  readonly get = {
    rules: (): unknown[] => this.rules,
    selectors: (): string[] => this.selector.mock.calls.map(([value]) => value),
  };
}
