import { randomUUID } from 'node:crypto';
import {
  generateAngularAppFiles,
  generateAngularHostFiles,
} from './angular/generator/angular-generator.js';
import {
  generateReactAppFiles,
  generateReactHostFiles,
} from './react/generator/react-generator.js';
import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './shared/types/generator-types.js';
import { validateGeneratorOptions } from './shared/validation/validation.js';
import { generateWidgetFiles as generateWidgetTemplates } from './widget/widget-generator.js';

export type {
  AngularStylesheetFormat,
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
  AtlasProjectType,
} from './shared/types/generator-types.js';
export {
  assertValidGeneratorName,
  validateGeneratorOptions,
} from './shared/validation/validation.js';
export {
  DEFAULT_APP_DEV_PORT,
  DEFAULT_HOST_BOOTSTRAP_PORT,
  DEFAULT_HOST_CLIENT_PORT,
  defaultDevServerPort,
  hostClientPort,
} from './shared/ports/ports.js';

export function generateHostFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  validateGeneratorOptions(options);
  const hostId = randomUUID();

  return options.framework === 'angular'
    ? generateAngularHostFiles({ options, hostId })
    : generateReactHostFiles({ options, hostId });
}

export function generateAppFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  validateGeneratorOptions(options);

  return options.framework === 'angular'
    ? generateAngularAppFiles(options)
    : generateReactAppFiles(options);
}

export function generateWidgetFiles(
  options: AtlasGeneratorOptions,
): AtlasGeneratedFile[] {
  validateGeneratorOptions(options);

  return generateWidgetTemplates(options);
}
