import type { SupportedFramework } from '../cli/arguments.js';

export function frameworkLabel(framework: SupportedFramework): string {
  return framework === 'angular' ? 'Angular' : 'React';
}
