import { asRecord, isRecord, nonEmptyString } from './records.js';

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
    asRecord: (): Record<string, unknown> | undefined => asRecord(this.value),
    nonEmptyString: (): boolean => nonEmptyString(this.value),
  };
}
