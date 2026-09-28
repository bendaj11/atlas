/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { ReactHostUiDriver } from './react-host-ui.driver.js';
import {
  createHostUiStore,
  createReactHostUiRenderers,
} from './react-host-ui.js';

const LOADING_KINDS = ['loading', 'widgetLoading'] as const;
const ERROR_KINDS = ['error', 'widgetError', 'hostError'] as const;

describe('AtlasHostUiPortals', () => {
  let driver: ReactHostUiDriver;

  beforeEach(() => {
    driver = new ReactHostUiDriver();
  });

  describe('when rendered under a theme context', () => {
    const theme = faker.word.noun();

    beforeEach(() => {
      driver.given.theme(theme).when.rendered();
    });

    it.each(LOADING_KINDS)(
      'should render the %s component into the status element when its status is shown',
      async (kind) => {
        await driver.when.loadingStatusShown(kind);

        expect(driver.get.rendered(kind)).not.toBeNull();
      },
    );

    it('should render the context value from above the portals when the loading status is shown', async () => {
      await driver.when.loadingStatusShown('loading');

      expect(driver.get.status().textContent).toBe(theme);
    });

    it('should unmount the component when its status is disposed', async () => {
      await driver.when.loadingStatusShown('loading');
      await driver.when.statusDisposed();

      expect(driver.get.status().childElementCount).toBe(0);
    });

    it.each(ERROR_KINDS)(
      'should pass the error to the %s component when its status is shown',
      async (kind) => {
        const error = new Error(faker.lorem.sentence());

        await driver.when.errorStatusShown(kind, error);

        expect(driver.get.rendered(kind)?.textContent).toBe(error.message);
      },
    );

    it.each(ERROR_KINDS)(
      'should call retry when the retry of the %s component is clicked',
      async (kind) => {
        await driver.when.errorStatusShown(
          kind,
          new Error(faker.lorem.sentence()),
        );
        await driver.when.retryClicked();

        expect(driver.get.retryMock()).toHaveBeenCalledTimes(1);
      },
    );
  });
});

describe('createReactHostUiRenderers', () => {
  it('should return no renderers when no components are given', () => {
    expect(
      createReactHostUiRenderers({ store: createHostUiStore(), components: {} }),
    ).toStrictEqual({});
  });
});

describe('createHostUiStore', () => {
  it('should keep the snapshot when a removed entry is removed again', () => {
    const store = createHostUiStore();
    const hide = store.show({
      kind: 'loading',
      element: document.createElement('div'),
    });

    hide();

    const snapshot = store.getSnapshot();

    hide();

    expect(store.getSnapshot()).toBe(snapshot);
  });
});
