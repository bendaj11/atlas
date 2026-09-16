import {
  isControlPort,
  parseControlPort,
  rememberControlPort,
  rememberedControlPort,
} from './control-port';

export class ControlPortDriver {
  private result: unknown;

  constructor() {
    sessionStorage.clear();
  }

  readonly given = {
    sessionStorageItem: (key: string, value: string): this => {
      sessionStorage.setItem(key, value);

      return this;
    },
  };

  readonly when = {
    validated: (value: unknown): void => {
      this.result = isControlPort(value);
    },
    parsed: (value: string | null): void => {
      this.result = parseControlPort(value);
    },
    remembered: (port: number): void => {
      rememberControlPort(port);
    },
    rememberedRead: (): void => {
      this.result = rememberedControlPort();
    },
  };

  readonly get = {
    result: (): unknown => this.result,
    sessionStorageItem: (key: string): string | null =>
      sessionStorage.getItem(key),
  };
}
