import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { ComponentProps } from 'react';
import {
  EmptyStateTestkit,
  TextButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import { EmptyHostDataState } from './EmptyHostDataState';

export class EmptyHostDataStateDriver {
  private message = faker.lorem.sentence();
  private readonly onRefresh =
    jest.fn<ComponentProps<typeof EmptyHostDataState>['onRefresh']>();
  private baseElement!: Element;

  readonly given = {
    message: (message: string) => {
      this.message = message;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.baseElement = render(
        <EmptyHostDataState
          message={this.message}
          onRefresh={this.onRefresh}
        />,
      ).baseElement;
    },
    refreshClicked: () => this.get.refreshButton().click(),
  };

  readonly get = {
    emptyState: () =>
      EmptyStateTestkit({
        wrapper: this.baseElement,
        dataHook: 'empty-host-data',
      }),
    refreshButton: () =>
      TextButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'refresh-host-data',
      }),
    refreshMock: () => this.onRefresh,
  };
}
