import type { SupportedFramework } from '../../shared/index.js';

export function frameworkLabel(framework: SupportedFramework): string {
  return framework === 'angular' ? 'Angular' : 'React';
}
