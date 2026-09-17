import type { SupportedFramework } from '../../shared/index.js';

export function getFrameworkLabel(framework: SupportedFramework): string {
  return framework === 'angular' ? 'Angular' : 'React';
}
