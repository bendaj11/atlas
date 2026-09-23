/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, anExportedWidgetManifest } from '@atlas/testkit';
import { WidgetLoaderDriver } from './widget-loader.driver.js';

describe('createWidgetLoader', () => {
  let driver: WidgetLoaderDriver;

  beforeEach(() => {
    driver = new WidgetLoaderDriver();
  });

  describe('when one production manifest exports one widget', () => {
    const widget = anExportedWidgetManifest({ ownerAppId: 'catalog' });
    const manifest = anAppManifest({
      id: 'catalog',
      channel: 'production',
      exportedWidgets: [widget],
    });

    beforeEach(() => {
      driver.given.manifests([manifest]);
    });

    describe('when the loader is created', () => {
      beforeEach(() => {
        driver.when.created();
      });

      it('should list the widget when listed by owner app id', () => {
        expect(driver.get.listed('catalog')).toEqual([widget]);
      });

      it('should list nothing when listed by another owner app id', () => {
        expect(driver.get.listed(faker.string.uuid())).toEqual([]);
      });

      it('should name the handle after the widget when the widget id is known', () => {
        expect(driver.get.handleName(widget.id)).toBe(widget.name);
      });

      it('should name the handle after the id when the widget id is unknown', () => {
        const unknownId = faker.string.uuid();

        expect(driver.get.handleName(unknownId)).toBe(unknownId);
      });

      it('should pass the props and owner manifest to the entry when mounted by qualified id', async () => {
        const props = { count: faker.number.int() };

        await driver.when.mounted(`catalog/${widget.id}`, props);

        expect(driver.get.lastRequest()).toMatchObject({
          props,
          ownerManifest: manifest,
        });
      });

      it('should mount the entry into a container attached to the document when mounted', async () => {
        await driver.when.mounted(widget.id);

        expect(driver.get.lastRequest().container.isConnected).toBe(true);
      });

      it('should provide the owner manifest and host id in the context when mounted', async () => {
        await driver.when.mounted(widget.id);

        expect(driver.get.lastRequest().context).toMatchObject({
          manifest,
          hostId: 'host',
        });
      });

      it('should expose the widget manifest on the mounted widget when mounted', async () => {
        await driver.when.mounted(widget.id);

        expect(driver.get.mountedWidget()).toEqual(widget);
      });

      it('should forward inputs to the entry when inputs are set after mounting', async () => {
        const inputs = { count: faker.number.int() };
        await driver.when.mounted(widget.id);

        driver.when.inputsSet(inputs);

        expect(driver.get.setInputsMock()).toHaveBeenCalledWith(inputs);
      });

      it('should unmount the entry when the mounted widget is unmounted', async () => {
        await driver.when.mounted(widget.id);

        await driver.when.unmounted();

        expect(driver.get.entryUnmountMock()).toHaveBeenCalledTimes(1);
      });

      it('should remove the widget card when the mounted widget is unmounted', async () => {
        await driver.when.mounted(widget.id);

        await driver.when.unmounted();

        expect(driver.get.container().children).toHaveLength(0);
      });
    });

    it('should import the widget module once when two mounts run concurrently', async () => {
      driver.given.importDelayed().when.created();

      await driver.when.mountedTwiceConcurrently(widget.id);

      expect(driver.get.importWidgetMock()).toHaveBeenCalledTimes(1);
    });

    describe('when the host provides a loading renderer', () => {
      beforeEach(async () => {
        driver.given.hostLoadingRenderer().when.created();

        await driver.when.mounted(widget.id);
      });

      it('should call the host loading renderer with the widget context when mounting', () => {
        expect(driver.get.renderWidgetLoadingMock()).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          { widgetId: widget.id, widget, ownerManifest: manifest },
        );
      });

      it('should dispose the host loading renderer when the widget mounts', () => {
        expect(driver.get.disposeLoadingMock()).toHaveBeenCalledTimes(1);
      });
    });

    it('should skip the host loading renderer when the handle provides its own loading renderer', async () => {
      driver.given.hostLoadingRenderer().when.created();

      await driver.when.mountedThroughHandle(widget.id, () => undefined);

      expect(driver.get.renderWidgetLoadingMock()).not.toHaveBeenCalled();
    });

    describe('when the host provides an error renderer and the first import fails', () => {
      beforeEach(async () => {
        driver.given
          .hostErrorRenderer()
          .given.importResults([new Error('temporary import failure')])
          .when.created();

        await driver.when.mounted(widget.id);
      });

      it('should call the host error renderer with an ATLAS_WIDGET_MOUNT_FAILED error when mounting fails', () => {
        expect(driver.get.renderWidgetErrorMock()).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            widgetId: widget.id,
            error: expect.objectContaining({
              code: 'ATLAS_WIDGET_MOUNT_FAILED',
            }),
          }),
          expect.any(Function),
        );
      });

      it('should leave the mounted widget manifest undefined when mounting fails', () => {
        expect(driver.get.mountedWidget()).toBeUndefined();
      });

      it('should mount the entry when retried after the failure', async () => {
        await driver.when.retried();

        expect(driver.get.requests()).toHaveLength(1);
      });

      it('should unmount the retried entry when the original mounted widget is unmounted', async () => {
        await driver.when.retried();

        await driver.when.unmounted();

        expect(driver.get.entryUnmountMock()).toHaveBeenCalledTimes(1);
      });

      it('should dispose the error renderer when the mounted widget is unmounted', async () => {
        await driver.when.unmounted();

        expect(driver.get.disposeErrorMock()).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when no manifests are given', () => {
    beforeEach(() => {
      driver.given.manifests([]);
    });

    it('should leave the mounted widget manifest undefined when an unknown widget is mounted without a resolver', async () => {
      driver.when.created();

      await driver.when.mounted(faker.string.uuid());

      expect(driver.get.mountedWidget()).toBeUndefined();
    });

    it('should render the default error status with a retry button when an unknown widget is mounted without a resolver', async () => {
      driver.when.created();

      await driver.when.mounted(faker.string.uuid());

      expect(
        driver.get.container().querySelector('[role="alert"] button')
          ?.textContent,
      ).toBe('Retry');
    });

    it('should mount the resolved widget when a resolver knows the widget', async () => {
      const widget = anExportedWidgetManifest();
      const ownerManifest = anAppManifest({
        id: widget.ownerAppId,
        channel: 'production',
      });
      driver.given
        .resolveWidget(async () => ({ widget, ownerManifest }))
        .when.created();

      await driver.when.mounted(widget.id);

      expect(driver.get.mountedWidget()).toEqual(widget);
    });
  });

  describe('when two production manifests export the same widget id', () => {
    const widgetId = faker.string.uuid();
    const first = anAppManifest({
      id: 'first',
      channel: 'production',
      exportedWidgets: [
        anExportedWidgetManifest({ id: widgetId, ownerAppId: 'first' }),
      ],
    });
    const second = anAppManifest({
      id: 'second',
      channel: 'production',
      exportedWidgets: [
        anExportedWidgetManifest({ id: widgetId, ownerAppId: 'second' }),
      ],
    });

    beforeEach(() => {
      driver.given.manifests([first, second]).when.created();
    });

    it('should name the handle after the first manifest widget when the shared id is requested', () => {
      expect(driver.get.handleName(widgetId)).toBe(
        first.exportedWidgets![0]!.name,
      );
    });

    it('should warn once naming the selected app when the loader is created', () => {
      expect(driver.get.warnMock()).toHaveBeenCalledWith(
        expect.stringContaining(`multiple apps and selected "first"`),
      );
    });
  });
});
