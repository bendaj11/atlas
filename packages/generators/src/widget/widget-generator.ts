import { randomUUID } from 'node:crypto';
import {
  convertIdToPascalCase,
  convertIdToTitle,
} from '../shared/text/text.js';
import type {
  AtlasGeneratedFile,
  SupportedGeneratorOptions,
} from '../shared/types/generator-types.js';

export function generateWidgetFilesForFramework(
  options: SupportedGeneratorOptions,
): AtlasGeneratedFile[] {
  const { name, framework } = options;
  const componentName = deriveWidgetComponentName(name);

  if (framework === 'react') {
    return [
      renderWidgetAtlasConfig(name),
      {
        path: `src/exported-widgets/${name}/index.tsx`,
        contents: `export interface ${componentName}Props {
  title?: string;
}

export default function ${componentName}({ title = "${convertIdToTitle(name)}" }: ${componentName}Props) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  );
}
`,
      },
    ];
  }

  return [
    renderWidgetAtlasConfig(name),
    renderAngularWidgetConfig(name),
    {
      path: `src/exported-widgets/${name}/index.ts`,
      contents: `import { Component, input } from "@angular/core";

@Component({
  selector: "atlas-${name}-widget",
  standalone: true,
  template: \`
    <section>
      <h2>{{ title() }}</h2>
    </section>
  \`
})
export default class ${componentName} {
  readonly title = input("${convertIdToTitle(name)}");
}
`,
    },
  ];
}

function deriveWidgetComponentName(name: string): string {
  const pascalName = convertIdToPascalCase(name);

  return pascalName.endsWith('Widget') ? pascalName : `${pascalName}Widget`;
}

function renderWidgetAtlasConfig(name: string): AtlasGeneratedFile {
  return {
    path: `src/exported-widgets/${name}/atlas.config.ts`,
    contents: `import type { AtlasWidgetConfig } from "@atlas/schema" with { "resolution-mode": "import" };

export default {
  id: "${randomUUID()}",
  name: "${convertIdToTitle(name)}"
} satisfies AtlasWidgetConfig;
`,
  };
}

function renderAngularWidgetConfig(name: string): AtlasGeneratedFile {
  return {
    path: `src/exported-widgets/${name}/widget.config.ts`,
    contents: `import type { ApplicationConfig } from "@angular/core";

export const widgetConfig: ApplicationConfig = {
  providers: []
};
`,
  };
}
