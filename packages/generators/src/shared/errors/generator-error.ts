import { AtlasError } from '@atlas/schema';

export type GeneratorErrorCode =
  | 'ATLAS_GENERATOR_INVALID_ID'
  | 'ATLAS_GENERATOR_UNSUPPORTED_FRAMEWORK'
  | 'ATLAS_GENERATOR_INVALID_VERSION'
  | 'ATLAS_GENERATOR_UNVERIFIED_VERSION';

interface GeneratorErrorOptions {
  summary: string;
  suggestedActions: string | readonly string[];
  code: GeneratorErrorCode;
}

export function generatorError(options: GeneratorErrorOptions): AtlasError {
  const { summary, suggestedActions, code } = options;

  return new AtlasError(summary, { suggestedActions, code });
}
