import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import {
  connectAtlasNavigationResolver,
  connectAtlasWidgetResolver,
  createAtlasEventBus,
  createAtlasSdk,
  subscribeAtlasHostData,
  updateAtlasHostData,
  type AtlasWidgetLoadingRenderer,
} from '../dist/host.js';
import { createMemoryNavigation } from '../../testkit/dist/index.js';
import { AtlasError } from '../../schema/dist/index.js';
import { createHostSdk } from './host.driver.js';

test('event bus dispatches across apps and removes listeners', () => {
  const bus = createAtlasEventBus<{ 'orders.updated': { orderId: string } }>();
  const received: Array<{ orderId: string }> = [];
  const listener = (payload: { orderId: string }) => received.push(payload);
  bus.addEventListener('orders.updated', listener);
  bus.emit('orders.updated', { orderId: '42' });
  bus.removeEventListener('orders.updated', listener);
  bus.emit('orders.updated', { orderId: '43' });
  assert.deepEqual(received, [{ orderId: '42' }]);
});

test('host updates replace custom host data for mounted apps', () => {
  interface ProjectHostSdk {
    hostData: { projectId: string; userId: string | null };
  }
  const sdk = createAtlasSdk<ProjectHostSdk>({
    hostId: 'host',
    navigation: createMemoryNavigation(),
    hostData: { projectId: 'project-42', userId: null },
  });

  updateAtlasHostData(sdk, { userId: 'user-42' });

  assert.deepEqual(sdk.hostData, {
    hostId: 'host',
    name: 'host',
    projectId: 'project-42',
    userId: 'user-42',
  });
});

test('host-data subscription stops after cleanup', () => {
  interface ProjectHostSdk {
    hostData: { userId: string | null };
  }
  const sdk = createAtlasSdk<ProjectHostSdk>({
    hostId: 'host',
    navigation: createMemoryNavigation(),
    hostData: { userId: null },
  });
  let notifications = 0;
  const unsubscribe = subscribeAtlasHostData(sdk, () => {
    notifications += 1;
  });

  updateAtlasHostData(sdk, { userId: 'user-42' });
  unsubscribe();
  updateAtlasHostData(sdk, { userId: null });

  assert.equal(notifications, 1);
});

test('host runtime connects synchronous getWidget after SDK construction', () => {
  const sdk = createHostSdk();
  assert.throws(
    () => sdk.getWidget('widget-id'),
    (error) =>
      error instanceof AtlasError &&
      error.code === 'ATLAS_WIDGET_RUNTIME_NOT_READY' &&
      error.surface === 'browser' &&
      error.suggestedActions[0]?.includes('Wait for the Atlas host'),
  );
  connectAtlasWidgetResolver(sdk, (id) => ({
    id,
    name: 'Widget',
    async mount() {
      return { async unmount() {} };
    },
  }));
  assert.equal(sdk.getWidget('widget-id').name, 'Widget');
});

test('host runtime resolves cross-app navigation by stable app id', () => {
  const sdk = createHostSdk();
  let destination: [string, unknown] | undefined;
  connectAtlasNavigationResolver(sdk, (appId, state) => {
    destination = [appId, state];
  });

  sdk.navigateTo('orders-app', { orderId: '42', tab: 'history' });

  assert.deepEqual(destination, [
    'orders-app',
    { orderId: '42', tab: 'history' },
  ]);
});

test('host SDK forwards per-widget loading options to runtime', () => {
  const sdk = createHostSdk();
  const renderLoading: AtlasWidgetLoadingRenderer = () => undefined;
  let receivedRenderLoading: AtlasWidgetLoadingRenderer | undefined;
  connectAtlasWidgetResolver(sdk, (_id, options) => {
    receivedRenderLoading = options?.renderLoading;
    return {
      id: 'widget-id',
      name: 'Widget',
      async mount() {
        return { async unmount() {} };
      },
    };
  });

  sdk.getWidget('widget-id', { renderLoading });

  assert.equal(receivedRenderLoading, renderLoading);
});

test('host properties cannot replace core SDK capabilities', () => {
  assert.throws(
    () =>
      createAtlasSdk({
        hostId: 'host',
        navigation: createMemoryNavigation(),
        events: 'invalid',
      } as never),
    /conflicts with a core SDK capability/,
  );
});

test('event bus once listener is removed after its first event', () => {
  const bus = createAtlasEventBus<{ 'session.expired': undefined }>();
  let calls = 0;
  bus.once('session.expired', () => {
    calls += 1;
  });
  bus.emit('session.expired');
  bus.emit('session.expired');
  assert.equal(calls, 1);
});

test('host SDK exposes consumer-typed host extensions', async () => {
  interface CommerceHostSdk {
    hostData: { storeId: string };
    showToast(message: string): void;
    openOrder(orderId: string): Promise<boolean>;
  }
  const shown: string[] = [];
  const sdk = createAtlasSdk<CommerceHostSdk>({
    hostId: 'host',
    navigation: createMemoryNavigation(),
    hostData: { name: 'Host', storeId: 'store-7' },
    showToast(message: string) {
      shown.push(message);
    },
    async openOrder(orderId: string) {
      return orderId === '42';
    },
  });
  assert.equal(sdk.hostData.storeId, 'store-7');
  sdk.showToast('Order ready');
  assert.equal(await sdk.openOrder('42'), true);
  assert.deepEqual(shown, ['Order ready']);
});
