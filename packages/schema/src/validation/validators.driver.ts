import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';
import { ValidationIssues } from './validation-issues.js';
import * as validators from './validators.js';
import type { UnknownRecord } from './validators.js';

type ValidatorName = Exclude<
  keyof typeof validators,
  'asRecord' | 'isNonEmptyString'
>;

export class ValidatorsDriver {
  private readonly issues = ValidationIssues.create();
  private record: UnknownRecord | undefined;
  private result: unknown;

  given = {
    record: (record: UnknownRecord | undefined): this => {
      this.record = record;

      return this;
    },
  };

  when = {
    recordValidated: (
      name:
        | 'requiredString'
        | 'optionalString'
        | 'requiredIdentifier'
        | 'requiredUrlSafePathSegment'
        | 'requiredSafeRelativePath',
      input: { key: string; label?: string },
    ): void => {
      this.result = validators[name]({
        record: this.record,
        key: input.key,
        label: input.label ?? input.key,
        issues: this.issues,
      });
    },
    literalRequired: (input: { key: string; expected: string }): void => {
      this.result = validators.requiredLiteral({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    oneOfValidated: (
      name: 'requiredOneOf' | 'optionalOneOf',
      input: { key: string; allowed: readonly string[] },
    ): void => {
      this.result = validators[name]({
        ...input,
        record: this.record,
        issues: this.issues,
      });
    },
    valueValidated: (
      name: Extract<ValidatorName, `validate${string}`>,
      input: Record<string, unknown>,
    ): void => {
      this.result = (validators[name] as (input: unknown) => unknown)({
        ...input,
        issues: this.issues,
      });
    },
  };

  get = {
    issues: (): AtlasValidationIssue[] => this.issues.list(),
    result: (): unknown => this.result,
  };
}
