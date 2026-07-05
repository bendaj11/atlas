import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";
import { assertSupportedGeneratorFramework, title } from "./common-generator.js";
import { reactVersionProfile } from "./generator-versions.js";

export function generateWidgetFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertSupportedGeneratorFramework(options);
  const baseName = pascal(options.name);
  const componentName = baseName.endsWith("Widget") ? baseName : `${baseName}Widget`;
  if (options.framework === "react") {
    const root = reactVersionProfile(options).major === 17
      ? 'import type { ReactNode } from "react";\nimport { render, unmountComponentAtNode } from "react-dom";\n\nfunction createRoot(container: Element) {\n  return { render(element: ReactNode) { render(element, container); }, unmount() { unmountComponentAtNode(container); } };\n}'
      : 'import { createRoot } from "react-dom/client";';
    return [{
      path: `src/exported-components/${options.name}/index.tsx`,
      contents: `import { createElement } from "react";\n${root}\nimport { defineExportedComponent } from "@atlas/sdk/react";\n\nexport interface ${componentName}Props {\n  title?: string;\n}\n\nfunction ${componentName}({ title = "${title(options.name)}" }: ${componentName}Props) {\n  return <section><h2>{title}</h2></section>;\n}\n\nexport default defineExportedComponent<${componentName}Props>({\n  createRoot,\n  createElement: ({ props }) => createElement(${componentName}, props)\n});\n`
    }];
  }
  const selector = `atlas-${options.name}-widget`;
  return [{
    path: `src/exported-components/${options.name}/index.ts`,
    contents: `import "zone.js";\nimport { Component, InjectionToken, inject } from "@angular/core";\nimport { bootstrapApplication } from "@angular/platform-browser";\nimport { defineExportedComponent } from "@atlas/sdk/angular";\n\nexport interface ${componentName}Props {\n  title?: string;\n}\n\nconst PROPS = new InjectionToken<${componentName}Props>("${componentName}Props");\n\n@Component({ selector: "${selector}", standalone: true, template: \`<section><h2>{{ props.title || "${title(options.name)}" }}</h2></section>\` })\nclass ${componentName} { readonly props = inject(PROPS); }\n\nexport default defineExportedComponent<${componentName}Props>(async ({ container, props }) => {\n  const element = document.createElement("${selector}");\n  container.append(element);\n  const app = await bootstrapApplication(${componentName}, { providers: [{ provide: PROPS, useValue: props }] });\n  return { unmount() { app.destroy(); element.remove(); } };\n});\n`
  }];
}

function pascal(value: string): string {
  return title(value).replace(/\s+/g, "");
}
