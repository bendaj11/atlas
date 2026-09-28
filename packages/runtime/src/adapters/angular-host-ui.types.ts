import type { ApplicationRef, Type } from '@angular/core';

export interface AngularHostComponents {
  notFoundComponent?: Type<unknown>;
  loadingComponent?: Type<unknown>;
  errorComponent?: Type<unknown>;
  widgetLoadingComponent?: Type<unknown>;
  widgetErrorComponent?: Type<unknown>;
  hostErrorComponent?: Type<unknown>;
}

export type AngularHostUiComponents = Omit<
  AngularHostComponents,
  'notFoundComponent'
>;

export interface AngularErrorInputs {
  error: Error;
  retry: () => void;
}

export interface AngularHostUiRenderersInput {
  components: AngularHostUiComponents;
  applicationRef: ApplicationRef;
}
