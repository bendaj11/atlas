import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { act, render } from '@testing-library/react';
import { createContext, createElement, useContext } from 'react';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import type { AtlasHostMountEvent } from '../host-runtime/host-runtime.types.js';
import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import type { AtlasErrorProps, AtlasHostComponents } from '../react.types.js';
import {
  AtlasHostUiPortals,
  createHostUiStore,
  createReactHostUiRenderers,
} from './react-host-ui.js';
import type {
  HostUiErrorKind,
  HostUiLoadingKind,
} from './react-host-ui.types.js';

const ThemeContext = createContext('');

function kindView(kind: HostUiLoadingKind) {
  return function LoadingView() {
    return createElement(
      'output',
      { 'data-testid': kind },
      useContext(ThemeContext),
    );
  };
}

function errorView(kind: HostUiErrorKind) {
  return function ErrorView(props: AtlasErrorProps) {
    return createElement(
      'button',
      { 'data-testid': kind, type: 'button', onClick: props.retry },
      props.error.message,
    );
  };
}

const COMPONENTS: AtlasHostComponents = {
  loading: kindView('loading'),
  widgetLoading: kindView('widgetLoading'),
  error: errorView('error'),
  widgetError: errorView('widgetError'),
  hostError: errorView('hostError'),
};

export class ReactHostUiDriver {
  private readonly status = document.createElement('div');
  private readonly retry = jest.fn<() => void>();
  private readonly store = createHostUiStore();
  private readonly renderers = createReactHostUiRenderers({
    store: this.store,
    components: COMPONENTS,
  });
  private theme = faker.word.noun();
  private dispose: DisposeRenderer | void = undefined;

  readonly given = {
    theme: (theme: string) => {
      this.theme = theme;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      render(
        createElement(
          ThemeContext.Provider,
          { value: this.theme },
          createElement(AtlasHostUiPortals, {
            store: this.store,
            components: COMPONENTS,
          }),
        ),
      );
    },
    loadingStatusShown: (kind: HostUiLoadingKind) =>
      act(() => {
        const show = {
          loading: () =>
            this.renderers.renderLoading!(this.status, this.mountEvent()),
          widgetLoading: () =>
            this.renderers.renderWidgetLoading!(this.status, {
              widgetId: faker.string.uuid(),
            }),
        };

        this.dispose = show[kind]();
      }),
    errorStatusShown: (kind: HostUiErrorKind, error: Error) =>
      act(() => {
        const show = {
          error: () =>
            this.renderers.renderError!(
              this.status,
              { ...this.mountEvent(), error },
              this.retry,
            ),
          widgetError: () =>
            this.renderers.renderWidgetError!(
              this.status,
              { widgetId: faker.string.uuid(), error },
              this.retry,
            ),
          hostError: () =>
            this.renderers.renderHostError!(this.status, error, this.retry),
        };

        this.dispose = show[kind]();
      }),
    statusDisposed: () =>
      act(() => {
        this.dispose?.();
      }),
    retryClicked: () =>
      act(() => {
        this.status.querySelector('button')!.click();
      }),
  };

  readonly get = {
    status: () => this.status,
    rendered: (kind: HostUiLoadingKind | HostUiErrorKind) =>
      this.status.querySelector(`[data-testid="${kind}"]`),
    retryMock: () => this.retry,
  };

  private mountEvent(): AtlasHostMountEvent {
    return {
      manifest: anAppManifest(),
      placement: aRoutePlacement(),
      container: document.createElement('div'),
      state: 'loading',
    };
  }
}
