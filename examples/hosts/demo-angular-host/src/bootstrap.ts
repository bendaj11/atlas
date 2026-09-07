import 'zone.js';
import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { initFederation, loadRemoteModule } from '@atlas/sdk/federation';
import {
  AtlasAngularHostAnchors,
  bootstrapAngularHost,
} from '@atlas/runtime/angular';
import type { AtlasHostClientEntry } from '@atlas/sdk/lifecycle';
import atlasConfig from '../atlas.config';
import { AppComponent } from './app.component';

@Component({
  selector: 'atlas-demo-route-anchor',
  standalone: true,
  template: '',
})
class DemoRouteAnchorComponent {}

type HostMountRequest = Parameters<AtlasHostClientEntry['mount']>[0];

export async function bootstrap(request: HostMountRequest) {
  return bootstrapAngularHost({
    component: AppComponent,
    request,
    appConfig: {
      providers: [
        provideRouter([{ path: '**', component: DemoRouteAnchorComponent }]),
      ],
    },
    createHostOptions: (injector) => ({
      router: injector.get(Router),
      location: injector.get(Location),
      anchors: injector.get(AtlasAngularHostAnchors),
      federation: { initFederation, loadRemoteModule },
      hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
      runtimeConfig: request.runtimeConfig,
      ...(request.catalog ? { catalog: request.catalog } : {}),
    }),
  });
}

export const mount: AtlasHostClientEntry['mount'] = bootstrap;
