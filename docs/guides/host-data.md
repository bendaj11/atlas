---
title: Share host data with Apps
description: Declare typed host data, keep it live from a React or Angular Host, and read it in Apps.
---

# Share host data with Apps

This guide shows you how a Host shares read-only state, such as the signed-in user, tenant, or locale, with every mounted App, and how Apps read it. It is for Host and App developers who already have a generated Host and App running. For the API details, see [SDK reference](../reference/sdk.md#host-data).

Host data is for values that Apps read. Put commands and services, such as `refreshSession()`, directly on the SDK instead; see [Custom SDK methods](../reference/sdk.md#custom-sdk-methods).

## Before you begin

- You have a Host generated with `npx atlas g host` and an App generated with `npx atlas g app`. See the [tutorial](../get-started/tutorial.md).
- You can share a TypeScript file between the Host and its Apps, for example through a workspace library.

## 1. Declare the host data type

Declare the Host SDK interface once and share it. The `hostData` property lists your custom fields. Atlas always adds `hostId` and `name`.

```ts
// libs/host-contract/src/index.ts — a shared library in your workspace
export interface CustomerHostSdk {
  readonly hostData: {
    readonly userName: string;
    readonly locale: string;
    readonly tenantId: string;
  };
}
```

Keep the fields shallow. To change a nested value, replace the whole top-level field.

The generators name this interface `CustomerHostSdk` in the Host's `host.config` file. Move it to the shared library and import it from there.

## 2. Provide host data from the Host

Follow the steps for your Host framework.

### React Host

In a React Host, `src/host.config.tsx` exports `useCustomHostSdkOptions`, which `defineReactHost` calls as a React hook. Return `hostData` from it. When the returned values change, Atlas publishes a new snapshot to every mounted App.

1. Create a store for the live value. This example uses a small store; you can use any state library that works with React hooks.

   ```ts
   // src/locale-store.ts
   type Listener = () => void;

   let locale = 'en';
   const listeners = new Set<Listener>();

   export const localeStore = {
     getSnapshot: () => locale,
     subscribe(listener: Listener) {
       listeners.add(listener);

       return () => {
         listeners.delete(listener);
       };
     },
     set(next: string) {
       locale = next;
       listeners.forEach((listener) => listener());
     },
   };
   ```

2. Return `hostData` from `useCustomHostSdkOptions` in `src/host.config.tsx`. Keep the `HostProviders` export that the generator created.

   ```tsx
   import { useSyncExternalStore } from 'react';
   import type { HostSdkOptions } from '@atlas/runtime/react';
   import type { CustomerHostSdk } from '@shop/host-contract';
   import { localeStore } from './locale-store';

   export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
     const locale = useSyncExternalStore(
       localeStore.subscribe,
       localeStore.getSnapshot,
     );

     return {
       hostData: { userName: 'Ada', locale, tenantId: 'tenant-42' },
     };
   }
   ```

   Replace `@shop/host-contract` with the import path of your shared library.

> **Note:** Atlas creates the React Host SDK once, on the first render. After that, only `hostData` changes reach Apps. Custom SDK methods and UI callbacks from later renders are ignored, so define them so they do not depend on render-time values.

> **Expected result:** When you call `localeStore.set('fr')`, every mounted App sees `locale: 'fr'`.

### Angular Host

In an Angular Host, `src/app/host.config.ts` exports `createCustomHostSdkOptions(injector)`, which `defineAngularHost` calls once. Each top-level `hostData` field can be a plain value or an Angular `Signal`. When a Signal changes, Atlas publishes a new snapshot to every mounted App.

1. Expose the live value from a service. This example uses an RxJS `BehaviorSubject`.

   ```ts
   // src/app/session.service.ts
   import { Injectable } from '@angular/core';
   import { BehaviorSubject } from 'rxjs';

   @Injectable({ providedIn: 'root' })
   export class SessionService {
     readonly userName$ = new BehaviorSubject('Ada');
     readonly locale$ = new BehaviorSubject('en');
   }
   ```

2. Return `hostData` from `createCustomHostSdkOptions`. Convert each Observable to a Signal once, with the injector that Atlas passes in.

   ```ts
   import type { Injector } from '@angular/core';
   import { toSignal } from '@angular/core/rxjs-interop';
   import type { HostSdkOptions } from '@atlas/runtime/angular';
   import type { CustomerHostSdk } from '@shop/host-contract';
   import { SessionService } from './session.service';

   export function createCustomHostSdkOptions(
     injector: Injector,
   ): HostSdkOptions<CustomerHostSdk> {
     const session = injector.get(SessionService);

     return {
       hostData: {
         userName: toSignal(session.userName$, { injector, requireSync: true }),
         locale: toSignal(session.locale$, { injector, requireSync: true }),
         tenantId: 'tenant-42',
       },
     };
   }
   ```

   - Use `requireSync: true` only when the Observable emits synchronously on subscribe, as a `BehaviorSubject` does. Otherwise, pass an `initialValue`.
   - Handle Observable errors before `toSignal`. A Signal created from an errored Observable throws when Atlas reads it.
   - Do not put Signals inside nested objects. Atlas watches only top-level fields.

> **Expected result:** When `session.locale$.next('fr')` runs, every mounted App sees `locale: 'fr'`.

#### If you call startHost directly

`defineAngularHost` passes the Host's injector to the runtime as `hostDataInjector`, which keeps Signal fields in sync. If you call `startHost` from `@atlas/runtime/angular` yourself, pass `hostDataInjector` too. Without it, Atlas reads each Signal once at startup and never updates it.

```ts
const runtime = await startHost<CustomerHostSdk>({
  ...options,
  hostDataInjector: injector,
});
```

## 3. Read host data in an App

Read the snapshot through the framework SDK. Both adapters update consumers automatically, even when the Host uses the other framework.

### React App

`useAtlasSdk` returns plain values and re-renders the component when host data changes.

```tsx
import { useAtlasSdk } from '@atlas/sdk/react';
import type { CustomerHostSdk } from '@shop/host-contract';

export function Greeting() {
  const sdk = useAtlasSdk<CustomerHostSdk>();

  return <p>Hello, {sdk.hostData.userName}</p>;
}
```

### Angular App

`injectAtlasSdk` returns `hostData` as a Signal. Call it to read the current snapshot.

```ts
import { Component, computed } from '@angular/core';
import { injectAtlasSdk } from '@atlas/sdk/angular';
import type { CustomerHostSdk } from '@shop/host-contract';

@Component({
  selector: 'app-greeting',
  standalone: true,
  template: `<p>Hello, {{ userName() }}</p>`,
})
export class GreetingComponent {
  private readonly sdk = injectAtlasSdk<CustomerHostSdk>();
  protected readonly userName = computed(() => this.sdk.hostData().userName);
}
```

## Update host data from a custom integration

Prefer the reactive options above. If you start a Host yourself with `startHost` from `@atlas/runtime/react` or `@atlas/runtime/angular`, the returned runtime has an `updateHostData(updates)` method that merges the fields you pass and notifies every App:

```ts
runtime.updateHostData({ locale: 'fr' });
```

`updateAtlasHostData(sdk, updates)` from `@atlas/sdk/host` does the same for an SDK object you created with `createAtlasSdk`.

> **Warning:** Do not pass the object returned by `useAtlasSdk()` or `injectAtlasSdk()` to `updateAtlasHostData`. Those are framework facades over the SDK, and the update does not reach the underlying SDK that Apps read.

## Test components that read host data

Use `mockAtlasEnvironment` from `@atlas/testkit` to supply host data in unit tests. See [Testing Apps and Hosts](testing-apps-and-hosts.md).

## Related

- [SDK reference](../reference/sdk.md)
- [React SDK guide](react/sdk.md)
- [Angular SDK guide](angular/sdk.md)
- [Hosts](../concepts/hosts.md)
