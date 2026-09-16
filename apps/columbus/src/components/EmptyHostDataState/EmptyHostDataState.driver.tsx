import { render, type RenderResult } from '@testing-library/react';
import { jest } from '@jest/globals';
import {
  EmptyStateTestkit,
  TextButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import { EmptyHostDataState } from './EmptyHostDataState';

export class EmptyHostDataStateDriver {
  private message = 'No runtime found.';
  private readonly onRefresh = jest.fn();
  private view: RenderResult | undefined;

  readonly given = {
    message: (message: string): this => {
      this.message = message;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      this.view = render(
        <EmptyHostDataState
          message={this.message}
          onRefresh={this.onRefresh}
        />,
      );
    },
    refreshClicked: async (): Promise<void> => {
      await this.get.refreshButton().click();
    },
  };

  readonly get = {
    emptyState: () =>
      EmptyStateTestkit({
        wrapper: this.get.container(),
        dataHook: 'empty-host-data',
      }),
    refreshButton: () =>
      TextButtonTestkit({
        wrapper: this.get.container(),
        dataHook: 'refresh-host-data',
      }),
    refreshMock: () => this.onRefresh,
    container: (): HTMLElement => {
      if (!this.view) throw new Error('Empty state was not rendered.');

      return this.view.container;
    },
  };
}
