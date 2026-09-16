import { randomUUID } from 'node:crypto';
import {
  generateAngularHostFiles,
  generateAngularAppFiles,
} from './angular/generator/angular-generator.js';
import {
  assertSupportedGeneratorFramework,
  assertValidGeneratorOptions,
} from './shared/validation/validation.js';
import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './shared/types/generator-types.js';
import {
  generateReactHostFiles,
  generateReactAppFiles,
} from './react/generator/react-generator.js';
import { generateWidgetFiles as generateWidgetTemplates } from './widget/widget-generator.js';

export type {
  AngularStylesheetFormat,
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './shared/types/generator-types.js';

export function generateHostFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  const hostId = randomUUID();
  return options.framework === 'angular'
    ? generateAngularHostFiles(options, hostId)
    : generateReactHostFiles(options, hostId);
}

export function generateAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  return options.framework === 'angular'
    ? generateAngularAppFiles(options)
    : generateReactAppFiles(options);
}

export function generateWidgetFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  return generateWidgetTemplates(options);
}
