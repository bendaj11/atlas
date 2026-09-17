import { optionalRecord, isRecord, isNonEmptyString } from './records.js';

export class RecordsDriver {
  private value: unknown;

  readonly given = {
    value: (value: unknown): this => {
      this.value = value;

      return this;
    },
  };

  readonly get = {
    isRecord: (): boolean => isRecord(this.value),
    optionalRecord: (): Record<string, unknown> | undefined =>
      optionalRecord(this.value),
    isNonEmptyString: (): boolean => isNonEmptyString(this.value),
  };
}
