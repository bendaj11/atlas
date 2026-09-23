import type { AtlasValidationIssue } from '../errors/atlas-validation-issue.js';

export class ValidationIssues {
  private constructor(
    private readonly prefix: string | undefined,
    private readonly items: AtlasValidationIssue[],
  ) {}

  static create(prefix?: string): ValidationIssues {
    return new ValidationIssues(prefix, []);
  }

  add(input: { path: string; message: string }): void {
    this.items.push({ path: this.pathOf(input.path), message: input.message });
  }

  scopedTo(path: string): ValidationIssues {
    return new ValidationIssues(this.pathOf(path), this.items);
  }

  toArray(): AtlasValidationIssue[] {
    return [...this.items];
  }

  private pathOf(path: string): string {
    if (!this.prefix) return path;

    if (!path) return this.prefix;

    return `${this.prefix}.${path}`;
  }
}
