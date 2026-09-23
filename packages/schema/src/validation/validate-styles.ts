import {
  toRecord,
  readRequiredString,
  validateHttpUrl,
  validateOptionalSha256Integrity,
  validateUniqueValue,
} from './validators.js';
import type { ValidationIssues } from './validation-issues.js';

export function validateStyles(input: {
  value: unknown;
  issues: ValidationIssues;
}): void {
  if (input.value === undefined) return;

  if (!Array.isArray(input.value)) {
    input.issues.add({ path: '', message: 'Expected styles to be an array.' });

    return;
  }
  const hrefs = new Set<string>();
  input.value.forEach((stylesheet, index) => {
    const issues = input.issues.scopedTo(String(index));
    const style = toRecord(stylesheet);
    const href = readRequiredString({ record: style, key: 'href', issues });

    if (href) {
      validateHttpUrl({ value: href, path: 'href', issues });
      validateUniqueValue({
        value: href,
        path: 'href',
        label: 'stylesheet href',
        seen: hrefs,
        issues,
      });
    }
    validateOptionalSha256Integrity({
      value: style?.integrity,
      path: 'integrity',
      issues,
    });
  });
}
