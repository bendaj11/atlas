import {
  anAngularGeneratorOptions,
  anAtlasId,
  aReactGeneratorOptions,
} from '../testkit/generator-options.testkit.js';
import { WidgetGeneratorDriver } from './widget-generator.driver.js';

const UUID_V4 =
  /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

describe('generateWidgetFiles', () => {
  let driver: WidgetGeneratorDriver;

  beforeEach(() => {
    driver = new WidgetGeneratorDriver();
  });

  it('should write a widget atlas config with a uuid v4 id and titled name when generated', () => {
    driver.given
      .options(aReactGeneratorOptions({ name: 'order-summary' }))
      .when.generated();

    expect(
      driver.get.contents('src/exported-widgets/order-summary/atlas.config.ts'),
    ).toMatch(
      new RegExp(
        `^import type \\{ AtlasWidgetConfig \\} from "@atlas/schema" with \\{ "resolution-mode": "import" \\};\n\nexport default \\{\n {2}id: "${UUID_V4.source}",\n {2}name: "Order Summary"\n\\} satisfies AtlasWidgetConfig;\n$`,
      ),
    );
  });

  it('should write the atlas config and a tsx component when framework is react', () => {
    const name = anAtlasId();
    driver.given.options(aReactGeneratorOptions({ name })).when.generated();

    expect(driver.get.paths()).toEqual([
      `src/exported-widgets/${name}/atlas.config.ts`,
      `src/exported-widgets/${name}/index.tsx`,
    ]);
  });

  it('should export a titled widget component with a Widget suffix when framework is react and name lacks the suffix', () => {
    driver.given
      .options(aReactGeneratorOptions({ name: 'order-summary' }))
      .when.generated();

    expect(driver.get.contents('src/exported-widgets/order-summary/index.tsx'))
      .toBe(`export interface OrderSummaryWidgetProps {
  title?: string;
}

export default function OrderSummaryWidget({ title = "Order Summary" }: OrderSummaryWidgetProps) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  );
}
`);
  });

  it('should keep a single Widget suffix when framework is react and name already ends with widget', () => {
    driver.given
      .options(aReactGeneratorOptions({ name: 'order-widget' }))
      .when.generated();

    expect(
      driver.get.contents('src/exported-widgets/order-widget/index.tsx'),
    ).toContain('export default function OrderWidget(');
  });

  it('should write the atlas config, a widget config and a ts component when framework is angular', () => {
    const name = anAtlasId();
    driver.given.options(anAngularGeneratorOptions({ name })).when.generated();

    expect(driver.get.paths()).toEqual([
      `src/exported-widgets/${name}/atlas.config.ts`,
      `src/exported-widgets/${name}/widget.config.ts`,
      `src/exported-widgets/${name}/index.ts`,
    ]);
  });

  it('should export a standalone widget component with a signal title input when framework is angular', () => {
    driver.given
      .options(anAngularGeneratorOptions({ name: 'order-summary' }))
      .when.generated();

    expect(driver.get.contents('src/exported-widgets/order-summary/index.ts'))
      .toBe(`import { Component, input } from "@angular/core";

@Component({
  selector: "atlas-order-summary-widget",
  standalone: true,
  template: \`
    <section>
      <h2>{{ title() }}</h2>
    </section>
  \`
})
export default class OrderSummaryWidget {
  readonly title = input("Order Summary");
}
`);
  });

  it('should write an empty application config when framework is angular', () => {
    const name = anAtlasId();
    driver.given.options(anAngularGeneratorOptions({ name })).when.generated();

    expect(driver.get.contents(`src/exported-widgets/${name}/widget.config.ts`))
      .toBe(`import type { ApplicationConfig } from "@angular/core";

export const widgetConfig: ApplicationConfig = {
  providers: []
};
`);
  });
});
