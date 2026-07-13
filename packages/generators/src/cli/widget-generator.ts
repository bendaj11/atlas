import { randomUUID } from "node:crypto";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";
import { assertSupportedGeneratorFramework, title } from "./common-generator.js";
import { reactVersionProfile } from "./generator-versions.js";

export function generateWidgetFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  assertSupportedGeneratorFramework(options);
  const baseName = pascal(options.name);
  const componentName = baseName.endsWith("Widget") ? baseName : `${baseName}Widget`;
  if (options.framework === "react") {
    const root = reactVersionProfile(options).major === 17
      ? `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) {
      render(element, container);
    },
    unmount() {
      unmountComponentAtNode(container);
    }
  };
}`
      : 'import { createRoot } from "react-dom/client";';
    return [widgetConfig(options.name), {
      path: `src/exported-widgets/${options.name}/index.tsx`,
      contents: `import { createElement } from "react";
${root}
import { defineExportedWidget } from "@atlas/sdk/react";

export interface ${componentName}Props {
  title?: string;
}

function ${componentName}({ title = "${title(options.name)}" }: ${componentName}Props) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  );
}

export default defineExportedWidget<${componentName}Props>({
  createRoot,
  createElement: ({ props }) => createElement(${componentName}, props)
});
`
    }];
  }
  const selector = `atlas-${options.name}-widget`;
  return [widgetConfig(options.name), {
    path: `src/exported-widgets/${options.name}/index.ts`,
    contents: `import "zone.js";
import { Component, InjectionToken, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { defineExportedWidget } from "@atlas/sdk/angular";

export interface ${componentName}Props {
  title?: string;
}

const PROPS = new InjectionToken<${componentName}Props>("${componentName}Props");

@Component({
  selector: "${selector}",
  standalone: true,
  template: \`
    <section>
      <h2>{{ props.title || "${title(options.name)}" }}</h2>
    </section>
  \`
})
class ${componentName} {
  readonly props = inject(PROPS);
}

export default defineExportedWidget<${componentName}Props>(async ({ container, props }) => {
  const element = document.createElement("${selector}");
  container.append(element);

  const app = await bootstrapApplication(${componentName}, {
    providers: [{ provide: PROPS, useValue: props }]
  });

  return {
    unmount() {
      app.destroy();
      element.remove();
    }
  };
});
`
  }];
}

function widgetConfig(name: string): AtlasGeneratedFile {
  return {
    path: `src/exported-widgets/${name}/atlas.widget.ts`,
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
