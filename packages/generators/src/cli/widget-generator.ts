import { randomUUID } from "node:crypto";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";
import { assertSupportedGeneratorFramework, title } from "./common-generator.js";

export function generateWidgetFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertSupportedGeneratorFramework(options);
  const baseName = pascal(options.name);
  const componentName = baseName.endsWith("Widget") ? baseName : `${baseName}Widget`;
  if (options.framework === "react") {
    return [widgetConfig(options.name), {
      path: `src/exported-widgets/${options.name}/index.tsx`,
      contents: `export interface ${componentName}Props {
  title?: string;
}

export default function ${componentName}({ title = "${title(options.name)}" }: ${componentName}Props) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  );
}
`
    }];
  }
  return [widgetConfig(options.name), {
    path: `src/exported-widgets/${options.name}/index.ts`,
    contents: `import { Component, input } from "@angular/core";

@Component({
  selector: "atlas-${options.name}-widget",
  standalone: true,
  template: \`
    <section>
      <h2>{{ title() }}</h2>
    </section>
  \`
})
export default class ${componentName} {
  readonly title = input("${title(options.name)}");
}
`
  }];
}

function widgetConfig(name: string): AtlasGeneratedFile {
  return {
    path: `src/exported-widgets/${name}/atlas.config.ts`,
    contents: `import type { AtlasWidgetConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "${randomUUID()}",
  name: "${title(name)}"
} satisfies AtlasWidgetConfig;
`
  };
}

function pascal(value: string): string {
  return title(value).replace(/\s+/g, "");
}
