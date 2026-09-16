import '@angular/compiler';
import { readFile } from 'node:fs/promises';
import * as angular from './angular.js';
import * as react from './react.js';
import type { AtlasSdk as AngularAtlasSdk, WidgetBinding } from './angular.js';
import type { AtlasSdk as ReactAtlasSdk } from './react.js';

type FrameworkModule = Readonly<Record<string, unknown>>;

interface SdkPackage {
  readonly exports: Readonly<Record<string, unknown>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta: Readonly<
    Record<string, { readonly optional?: boolean }>
  >;
}

interface CustomerHostSdk {
  showToast(message: string): void;
}

interface ProductEvents {
  'orders.updated': { orderId: string };
  'cart.cleared': undefined;
}

function verifyFrameworkEventTypes(
  angularSdk: AngularAtlasSdk<CustomerHostSdk, ProductEvents>,
  reactSdk: ReactAtlasSdk<CustomerHostSdk, ProductEvents>,
): void {
  angularSdk.events.emit('orders.updated', { orderId: '42' });
  angularSdk.events.emit('cart.cleared');
  reactSdk.events.addEventListener('orders.updated', ({ orderId }) =>
    orderId.toUpperCase(),
  );
  angularSdk.showToast('ready');

  // @ts-expect-error Unknown event names must be rejected.
  angularSdk.events.emit('orders.created', { orderId: '42' });
  // @ts-expect-error Payload must match the selected event name.
  reactSdk.events.emit('orders.updated', { id: '42' });
  // @ts-expect-error Payload-bearing events require a payload.
  reactSdk.events.emit('orders.updated');
  // @ts-expect-error Payloadless events reject payload values.
  angularSdk.events.emit('cart.cleared', {});
}

function verifyAngularWidgetTypes(
  sdk: AngularAtlasSdk,
): WidgetBinding<{ orderId: string }> {
  return sdk.getWidget<{ orderId: string }>('widget-id', {
    inputs: { orderId: '42' },
  });
}

const FRAMEWORK_MODULES: Readonly<Record<string, FrameworkModule>> = {
  angular,
  react,
};

export class FrameworkApiDriver {
  private packageJson!: SdkPackage;

  readonly when = {
    packageRead: async (): Promise<void> => {
      this.packageJson = JSON.parse(
        await readFile(new URL('../package.json', import.meta.url), 'utf8'),
      ) as SdkPackage;
    },
  };

  readonly get = {
    typeContracts: () => [verifyFrameworkEventTypes, verifyAngularWidgetTypes],
    exportNames: (framework: string): string[] =>
      Object.keys(FRAMEWORK_MODULES[framework] ?? {}),
    exportedMember: (framework: string, name: string): unknown =>
      FRAMEWORK_MODULES[framework]?.[name],
    subpath: (name: string): unknown => this.packageJson.exports[name],
    vitePeer: () => ({
      range: this.packageJson.peerDependencies.vite,
      optional: this.packageJson.peerDependenciesMeta.vite?.optional,
    }),
  };
}
