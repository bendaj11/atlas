import { generateAngularHostFiles, generateAngularMicrofrontendFiles } from "./cli/angular-generator.js";
import { assertSupportedGeneratorFramework, assertValidGeneratorOptions } from "./cli/common-generator.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./cli/generator-types.js";
import { generateReactHostFiles, generateReactMicrofrontendFiles } from "./cli/react-generator.js";
import { generateWidgetFiles as generateWidgetTemplates } from "./cli/widget-generator.js";

export type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./cli/generator-types.js";

export function generateHostFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  return options.framework === "angular"
    ? generateAngularHostFiles(options)
    : generateReactHostFiles(options);
}

export function generateMicrofrontendFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  return options.framework === "angular"
    ? generateAngularMicrofrontendFiles(options)
    : generateReactMicrofrontendFiles(options);
}

export function generateWidgetFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertValidGeneratorOptions(options);
  assertSupportedGeneratorFramework(options);
  const files = generateWidgetTemplates(options);
  if (options.framework === "angular") return files;
  return files.map((file) => ({
    ...file,
    contents: file.contents.replace(
      'import { defineExportedComponent } from "@atlas/sdk/react";',
      'import { defineExportedComponent } from "@atlas/sdk/react";\n\nif (import.meta.hot) await import("@vitejs/plugin-react/preamble");'
    )
  }));
}
