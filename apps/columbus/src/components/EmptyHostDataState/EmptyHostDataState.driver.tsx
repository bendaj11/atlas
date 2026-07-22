import { render, type RenderResult } from '@testing-library/react';
import { jest } from '@jest/globals';
import {
  EmptyStateTestkit,
  TextButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library.js';
import { EmptyHostDataState } from './EmptyHostDataState.js';

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
    rendered: (): this => {
      this.view = render(
        <EmptyHostDataState
          message={this.message}
          onRefresh={this.onRefresh}
        />,
      );
      return this;
    },
    refreshClicked: async (): Promise<this> => {
      await this.get.refreshButton().click();
      return this;
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
    refreshCalls: (): number => this.onRefresh.mock.calls.length,
    container: (): HTMLElement => {
      if (!this.view) throw new Error('Empty state was not rendered.');
      return this.view.container;
    },
  };
}
