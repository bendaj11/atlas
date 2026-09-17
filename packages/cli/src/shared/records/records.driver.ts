import { optionalRecord, isRecord, isNonEmptyString } from './records.js';

export class RecordsDriver {
  private value: unknown;

  readonly given = {
    value: (value: unknown) => {
      this.value = value;

      return this;
    },
  };

  readonly get = {
    isRecord: () => isRecord(this.value),
    optionalRecord: () => optionalRecord(this.value),
    isNonEmptyString: () => isNonEmptyString(this.value),
  };
}
