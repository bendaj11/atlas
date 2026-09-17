import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  IconButtonTestkit,
  SearchTestkit,
  TextTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import { ArtifactsListTableToolbar } from './ArtifactsListTableToolbar';

export class ArtifactsListTableToolbarDriver {
  private totalCount = faker.number.int({ min: 0, max: 100 });
  private filteredCount = faker.number.int({ min: 0, max: 100 });
  private visibleOnly = faker.datatype.boolean();
  private readonly onSearch =
    jest.fn<ComponentProps<typeof ArtifactsListTableToolbar>['onSearch']>();
  private readonly onVisibleOnlyChange =
    jest.fn<
      ComponentProps<typeof ArtifactsListTableToolbar>['onVisibleOnlyChange']
    >();
  private baseElement!: Element;

  readonly given = {
    totalCount: (totalCount: number) => {
      this.totalCount = totalCount;

      return this;
    },
    filteredCount: (filteredCount: number) => {
      this.filteredCount = filteredCount;

      return this;
    },
    visibleOnly: (visibleOnly: boolean) => {
      this.visibleOnly = visibleOnly;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.baseElement = render(
        <ArtifactsListTableToolbar
          onSearch={this.onSearch}
          totalCount={this.totalCount}
          filteredCount={this.filteredCount}
          visibleOnly={this.visibleOnly}
          onVisibleOnlyChange={this.onVisibleOnlyChange}
        />,
      ).baseElement;
    },
    searchTextEntered: (text: string) =>
      this.get.search().inputDriver.enterText(text),
    visibleFilterClicked: () => this.get.visibleFilterButton().click(),
  };

  readonly get = {
    search: () =>
      SearchTestkit({
        wrapper: this.baseElement,
        dataHook: 'artifacts-search',
      }),
    visibleFilterButton: () =>
      IconButtonTestkit({
        wrapper: this.baseElement,
        dataHook: 'visible-artifacts-filter',
      }),
    countLabel: () =>
      TextTestkit({ wrapper: this.baseElement, dataHook: 'artifacts-count' }),
    onSearch: () => this.onSearch,
    onVisibleOnlyChange: () => this.onVisibleOnlyChange,
  };
}
