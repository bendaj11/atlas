import { json, pascal, title } from './text.js';

export class TextDriver {
  private result!: string;

  readonly when = {
    titled: (value: string): void => {
      this.result = title(value);
    },
    pascalCased: (value: string): void => {
      this.result = pascal(value);
    },
    serialized: (value: unknown): void => {
      this.result = json(value);
    },
  };

  readonly get = {
    result: (): string => this.result,
  };
}
