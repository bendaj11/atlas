import { randomUUID } from "node:crypto";
import { generateAngularHostFiles, generateAngularAppFiles } from "./cli/angular-generator.js";
import { assertSupportedGeneratorFramework, assertValidGeneratorOptions } from "./cli/common-generator.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./cli/generator-types.js";
import { generateReactHostFiles, generateReactAppFiles } from "./cli/react-generator.js";
import { generateWidgetFiles as generateWidgetTemplates } from "./cli/widget-generator.js";

export type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./cli/generator-types.js";

export function generateHostFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  const hostId = randomUUID();
  return options.framework === "angular"
    ? generateAngularHostFiles(options, hostId)
    : generateReactHostFiles(options, hostId);
}

export function generateAppFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  return options.framework === "angular"
    ? generateAngularAppFiles(options)
    : generateReactAppFiles(options);
}

export function generateWidgetFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  return generateWidgetTemplates(options);
}
