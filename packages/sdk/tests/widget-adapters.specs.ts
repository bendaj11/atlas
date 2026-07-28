import assert from 'node:assert/strict';
import '@angular/compiler';
import { test } from '@jest/globals';
import type { ApplicationRef, EnvironmentInjector } from '@angular/core';
import {
  AngularWidgetOutletController,
  createAngularAtlasSdk,
} from '../dist/angular-widget.js';
import {
  connectAtlasWidgetResolver,
  createAtlasSdk,
  type AtlasWidgetHandle,
} from '../dist/host.js';
import { createReactAtlasSdk } from '../dist/react-widget.js';
import { createMemoryNavigation } from '../../testkit/dist/index.js';

test('React SDK caches widget component identity', () => {
  const sdk = createTestSdk();
  const reactSdk = createReactAtlasSdk(sdk);
  const Loading = () => null;

  const first = reactSdk.getWidget<{ name: string }>('widget-id', {
    loadingComponent: Loading,
  });
  const second = reactSdk.getWidget<{ name: string }>('widget-id', {
    loadingComponent: Loading,
  });

  assert.equal(first, second);
});

test('Angular SDK creates an immutable typed widget binding', () => {
  const sdk = createTestSdk();
  connectAtlasWidgetResolver(sdk, createWidgetHandle);
  const angularSdk = createAngularAtlasSdk(
    sdk,
    Object.create(null) as ApplicationRef,
    Object.create(null) as EnvironmentInjector,
  );

  const binding = angularSdk.getWidget<{ count: number }>('widget-id', {
    inputs: { count: 1 },
  });

  assert.deepEqual(
    { binding, frozen: Object.isFrozen(binding) },
    { binding: { widgetId: 'widget-id', inputs: { count: 1 } }, frozen: true },
  );
});

test('Angular widget outlet mounts, updates, and unmounts one widget', async () => {
  const mountedInputs: object[] = [];
  let mountCount = 0;
  let unmountCount = 0;
  const angularSdk = createTestAngularSdk(
    <TInputs extends object>(widgetId: string): AtlasWidgetHandle<TInputs> => ({
      id: widgetId,
      name: 'Widget',
      async mount(_container, inputs) {
        mountCount += 1;
        mountedInputs.push(inputs);
        return {
          setInputs(nextInputs) {
            mountedInputs.push(nextInputs);
          },
          async unmount() {
            unmountCount += 1;
          },
        };
      },
    }),
  );
  const controller = createWidgetOutletController<{ count: number }>();

  await controller.render(
    angularSdk.getWidget('widget-id', { inputs: { count: 1 } }),
  );
  await controller.render(
    angularSdk.getWidget('widget-id', { inputs: { count: 2 } }),
  );
  await controller.destroy();

  assert.deepEqual(
    { mountCount, mountedInputs, unmountCount },
    {
      mountCount: 1,
      mountedInputs: [{ count: 1 }, { count: 2 }],
      unmountCount: 1,
    },
  );
});

test('Angular widget outlet replaces a changed widget', async () => {
  const lifecycle: string[] = [];
  const angularSdk = createTestAngularSdk(
    <TInputs extends object>(widgetId: string): AtlasWidgetHandle<TInputs> => ({
      id: widgetId,
      name: widgetId,
      async mount() {
        lifecycle.push(`mount:${widgetId}`);
        return {
          async unmount() {
            lifecycle.push(`unmount:${widgetId}`);
          },
        };
      },
    }),
  );
  const controller = createWidgetOutletController<object>();

  await controller.render(angularSdk.getWidget('first', { inputs: {} }));
  await controller.render(angularSdk.getWidget('second', { inputs: {} }));
  await controller.destroy();

  assert.deepEqual(lifecycle, [
    'mount:first',
    'unmount:first',
    'mount:second',
    'unmount:second',
  ]);
});

test('Angular widget outlet unmounts a widget that finishes mounting after destruction', async () => {
  let finishMount: () => void = () => undefined;
  let notifyMountStarted: () => void = () => undefined;
  const mountStarted = new Promise<void>((resolve) => {
    notifyMountStarted = resolve;
  });
  const mountFinished = new Promise<void>((resolve) => {
    finishMount = resolve;
  });
  let unmounted = false;
  const angularSdk = createTestAngularSdk(
    <TInputs extends object>(widgetId: string): AtlasWidgetHandle<TInputs> => ({
      id: widgetId,
      name: widgetId,
      async mount() {
        notifyMountStarted();
        await mountFinished;
        return {
          async unmount() {
            unmounted = true;
          },
        };
      },
    }),
  );
  const controller = createWidgetOutletController<object>();

  const rendering = controller.render(
    angularSdk.getWidget('widget-id', { inputs: {} }),
  );
  await mountStarted;
  const destroying = controller.destroy();
  finishMount();
  await Promise.all([rendering, destroying]);

  assert.equal(unmounted, true);
});

function createTestAngularSdk(
  resolveWidget: <TInputs extends object>(
    widgetId: string,
  ) => AtlasWidgetHandle<TInputs>,
) {
  const sdk = createTestSdk();
  connectAtlasWidgetResolver(sdk, resolveWidget);
  return createAngularAtlasSdk(
    sdk,
    Object.create(null) as ApplicationRef,
    Object.create(null) as EnvironmentInjector,
  );
}

function createWidgetHandle<TInputs extends object>(
  widgetId: string,
): AtlasWidgetHandle<TInputs> {
  return {
    id: widgetId,
    name: 'Widget',
    async mount() {
      return { async unmount() {} };
    },
  };
}

function createWidgetOutletController<
  TInputs extends object,
>(): AngularWidgetOutletController<TInputs> {
  return new AngularWidgetOutletController(
    Object.create(null) as HTMLElement,
    (error) => {
      throw error;
    },
  );
}

function createTestSdk() {
  return createAtlasSdk({
    hostId: 'host',
    navigation: createMemoryNavigation(),
  });
}
