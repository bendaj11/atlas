import { render, type RenderResult } from '@testing-library/react';
import { jest } from '@jest/globals';
import { RadioGroupTestkit } from '@wix/design-system/dist/testkit/testing-library.js';
import type { Scope } from '../../../types/app.js';
import { BrowserOverrideScopePicker } from './BrowserOverrideScopePicker.js';

export class BrowserOverrideScopePickerDriver {
  private value: Scope = 'all';
  private disabled = false;
  private readonly onChange = jest.fn<(scope: Scope) => void>();
  private view: RenderResult | undefined;

  readonly given = {
    value: (value: Scope): this => {
      this.value = value;
      return this;
    },
    disabled: (): this => {
      this.disabled = true;
      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      this.view = render(
        <BrowserOverrideScopePicker
          value={this.value}
          disabled={this.disabled}
          onChange={this.onChange}
        />,
      );
      return this;
    },
    tabSelected: async (): Promise<this> => {
      await this.get.radioGroup().selectByValue('tab');
      return this;
    },
  };

  readonly get = {
    radioGroup: () =>
      RadioGroupTestkit({
        wrapper: this.get.container(),
        dataHook: 'override-scope',
      }),
    selectedScope: (): Scope | undefined => this.onChange.mock.calls[0]?.[0],
    container: (): HTMLElement => {
      if (!this.view) throw new Error('Scope picker was not rendered.');
      return this.view.container;
    },
  };
}
