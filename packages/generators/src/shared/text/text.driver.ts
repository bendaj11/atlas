import {
  convertIdToPascalCase,
  convertIdToTitle,
  formatJsonDocument,
} from './text.js';

export class TextDriver {
  private result!: string;

  readonly when = {
    titled: (value: string) => {
      this.result = convertIdToTitle(value);
    },
    pascalCased: (value: string) => {
      this.result = convertIdToPascalCase(value);
    },
    serialized: (value: unknown) => {
      this.result = formatJsonDocument(value);
    },
  };

  readonly get = {
    result: () => this.result,
  };
}
