import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { HostWidgetsDriver } from './host-widgets.driver.js';

describe.each(['React', 'Angular'] as const)(
  '%s host widget integration',
  (hostFramework) => {
    describe.each(['React', 'Angular'] as const)(
      '%s remote widget',
      (widgetFramework) => {
        let driver: HostWidgetsDriver;

        beforeEach(() => {
          driver = new HostWidgetsDriver({ hostFramework, widgetFramework });
        });

        afterEach(() => driver.when.cleanup());

        it('should render initial inputs when the host mounts a remote widget', async () => {
          await driver.when.openHost();
          await driver.when.showWidget();

          expect(await driver.get.widgetText()).toBe(driver.get.initialText());
        });

        it('should render updated inputs when the host changes widget props', async () => {
          await driver.when.openHost();
          await driver.when.showWidget();
          await driver.when.updateWidget();

          expect(await driver.get.widgetText()).toBe(driver.get.updatedText());
        });

        it('should remove rendered content when the host removes the widget outlet', async () => {
          await driver.when.openHost();
          await driver.when.showWidget();
          await driver.when.hideWidget();

          expect(await driver.get.widgetCount()).toBe(0);
        });
      },
    );
  },
);
