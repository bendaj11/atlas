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
    validated: (value: unknown): this => {
      this.result = isControlPort(value);

      return this;
    },
    parsed: (value: string | null): this => {
      this.result = parseControlPort(value);

      return this;
    },
    remembered: (port: number): this => {
      rememberControlPort(port);

      return this;
    },
    rememberedRead: (): this => {
      this.result = rememberedControlPort();

      return this;
    },
  };

  readonly get = {
    result: (): unknown => this.result,
    sessionStorageItem: (key: string): string | null =>
      sessionStorage.getItem(key),
  };
}
