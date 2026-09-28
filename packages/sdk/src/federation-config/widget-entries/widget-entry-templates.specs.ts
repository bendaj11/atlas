import { faker } from '@faker-js/faker';
import { createRequire } from 'node:module';
import { WidgetEntryTemplatesDriver } from './widget-entry-templates.driver.js';

const widgetEntryTemplates: typeof import('./widget-entry-templates.cjs') =
  createRequire(import.meta.url)('./widget-entry-templates.cts');
const { buildAngularWidgetEntrySource } = widgetEntryTemplates;

const ZONE_IMPORTS = ['import "zone.js";', "import 'zone.js';"];

describe('buildAngularWidgetEntrySource', () => {
  let driver: WidgetEntryTemplatesDriver;

  beforeEach(() => {
    driver = new WidgetEntryTemplatesDriver();
  });

  it('should import zone.js when the app has no entry', () => {
    const name = faker.string.alpha(10).toLowerCase();

    expect(
      buildAngularWidgetEntrySource({
        projectRoot: driver.get.projectRoot(),
        name,
      }),
    ).toBe(`import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from "../../src/exported-widgets/${name}/index";

export default createExportedWidget(Widget);
`);
  });

  it.each(ZONE_IMPORTS)(
    'should import zone.js when the app entry has %s and the project has no package.json',
    (zoneImport) => {
      const name = faker.string.alpha(10).toLowerCase();

      driver.given.appEntry(`${zoneImport}\n${faker.lorem.lines()}`);

      expect(
        buildAngularWidgetEntrySource({
          projectRoot: driver.get.projectRoot(),
          name,
        }),
      ).toBe(`import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from "../../src/exported-widgets/${name}/index";

export default createExportedWidget(Widget);
`);
    },
  );

  it('should import zone.js when the app entry imports zone.js and zone.js is only a dev dependency', () => {
    const name = faker.string.alpha(10).toLowerCase();

    driver.given
      .appEntry(`import "zone.js";\n${faker.lorem.lines()}`)
      .given.devDependencies({ 'zone.js': faker.system.semver() });

    expect(
      buildAngularWidgetEntrySource({
        projectRoot: driver.get.projectRoot(),
        name,
      }),
    ).toBe(`import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from "../../src/exported-widgets/${name}/index";

export default createExportedWidget(Widget);
`);
  });

  it('should import zone.js and pass the widget config when the app entry imports zone.js and the widget has a widget config', () => {
    const name = faker.string.alpha(10).toLowerCase();

    driver.given
      .appEntry(`import "zone.js";\n${faker.lorem.lines()}`)
      .given.widgetConfig(name);

    expect(
      buildAngularWidgetEntrySource({
        projectRoot: driver.get.projectRoot(),
        name,
      }),
    ).toBe(`import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from "../../src/exported-widgets/${name}/index";
import { widgetConfig } from "../../src/exported-widgets/${name}/widget.config";

export default createExportedWidget(Widget, widgetConfig);
`);
  });

  describe('when the app entry does not import zone.js', () => {
    beforeEach(() => {
      driver.given.appEntry(faker.lorem.lines());
    });

    it('should provide zoneless change detection without importing zone.js when the widget has no widget config', () => {
      const name = faker.string.alpha(10).toLowerCase();

      expect(
        buildAngularWidgetEntrySource({
          projectRoot: driver.get.projectRoot(),
          name,
        }),
      ).toBe(`import { provideZonelessChangeDetection } from "@angular/core";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from "../../src/exported-widgets/${name}/index";

export default createExportedWidget(Widget, { providers: [provideZonelessChangeDetection()] });
`);
    });

    it('should provide zoneless change detection ahead of the widget config providers when the widget has a widget config', () => {
      const name = faker.string.alpha(10).toLowerCase();

      driver.given.widgetConfig(name);

      expect(
        buildAngularWidgetEntrySource({
          projectRoot: driver.get.projectRoot(),
          name,
        }),
      ).toBe(`import { provideZonelessChangeDetection } from "@angular/core";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from "../../src/exported-widgets/${name}/index";
import { widgetConfig } from "../../src/exported-widgets/${name}/widget.config";

export default createExportedWidget(Widget, { ...widgetConfig, providers: [provideZonelessChangeDetection(), ...widgetConfig.providers] });
`);
    });
  });
});
