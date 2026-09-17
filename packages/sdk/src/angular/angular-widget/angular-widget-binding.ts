import type { ApplicationRef, EnvironmentInjector } from '@angular/core';
import type { AtlasSdk as AtlasSdkValue } from '../../host.js';
import { sdkError } from '../../core/sdk-error/sdk-error.js';
import { createAngularLoadingRenderer } from './angular-loading-renderer.js';
import type {
  AngularGetWidgetOptions,
  AngularWidgetBinding,
  AngularWidgetRuntime,
} from './angular-widget.types.js';

export interface CreateWidgetBindingRequest<TInputs extends object> {
  readonly sdk: Pick<AtlasSdkValue, 'getWidget'>;
  readonly applicationRef: ApplicationRef;
  readonly environmentInjector: EnvironmentInjector;
  readonly widgetId: string;
  readonly options: AngularGetWidgetOptions<TInputs>;
}

const widgetRuntimes = new WeakMap<object, AngularWidgetRuntime>();

/** Creates the frozen binding a template passes to `[atlasWidget]` and records its runtime handle. */
export function createWidgetBinding<TInputs extends object>(
  request: CreateWidgetBindingRequest<TInputs>,
): AngularWidgetBinding<TInputs> {
  const { sdk, applicationRef, environmentInjector, widgetId, options } =
    request;

  const renderLoading = options.loadingComponent
    ? createAngularLoadingRenderer({
        loadingComponent: options.loadingComponent,
        applicationRef,
        environmentInjector,
      })
    : undefined;
  const handle = sdk.getWidget<object>(
    widgetId,
    renderLoading ? { renderLoading } : undefined,
  );

  const binding: AngularWidgetBinding<TInputs> = Object.freeze({
    widgetId,
    inputs: options.inputs,
  });
  widgetRuntimes.set(binding, {
    widgetId,
    handle,
    ...(options.loadingComponent
      ? { loadingComponent: options.loadingComponent }
      : {}),
  });

  return binding;
}

export function readWidgetRuntime(
  binding: AngularWidgetBinding<object>,
): AngularWidgetRuntime {
  const runtime = widgetRuntimes.get(binding);
  if (runtime) return runtime;

  throw sdkError(
    `Atlas cannot render widget "${binding.widgetId}" because its Angular binding was not created by sdk.getWidget().`,
    {
      suggestedActions:
        'Create the binding with the injected Angular Atlas SDK, then pass it to [atlasWidget].',
      code: 'ATLAS_WIDGET_BINDING_INVALID',
    },
  );
}
