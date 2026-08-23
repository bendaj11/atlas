import { render, type RenderResult } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { OverridesTableToolbar } from './OverridesTableToolbar.js';

export class OverridesTableToolbarDriver {
  private readonly onVisibleOnlyChange = jest.fn();
  private readonly user = userEvent.setup();
  private visibleOnly = false;
  private view: RenderResult | undefined;

  readonly given = {
    visibleOnly: (): this => {
      this.visibleOnly = true;
      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      this.view = render(
        <OverridesTableToolbar
          onSearch={jest.fn()}
          totalCount={3}
          filteredCount={3}
          visibleOnly={this.visibleOnly}
          onVisibleOnlyChange={this.onVisibleOnlyChange}
        />,
      );
      return this;
    },
    visibleFilterClicked: async (): Promise<this> => {
      await this.user.click(this.get.visibleFilter());
      return this;
    },
  };

  readonly get = {
    visibleFilter: (): HTMLElement => {
      if (!this.view)
        throw new Error('Overrides table toolbar was not rendered.');
      return this.view.getByRole('button', {
        name: 'Show visible artifacts only',
      });
    },
    visibleOnlyChange: (): boolean | undefined => {
      const visibleOnly = this.onVisibleOnlyChange.mock.calls[0]?.[0];
      return typeof visibleOnly === 'boolean' ? visibleOnly : undefined;
    },
  };
}
