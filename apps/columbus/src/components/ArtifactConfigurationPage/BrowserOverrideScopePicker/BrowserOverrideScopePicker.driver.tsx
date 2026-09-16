import { faker } from '@faker-js/faker';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { RadioGroupTestkit } from '@wix/design-system/dist/testkit/testing-library';
import type { Scope } from '../../../types/columbus-state';
import { BrowserOverrideScopePicker } from './BrowserOverrideScopePicker';

type ScopePickerProps = ComponentProps<typeof BrowserOverrideScopePicker>;

export class BrowserOverrideScopePickerDriver {
  private selectedScope: Scope = faker.helpers.arrayElement<Scope>([
    'all',
    'tab',
  ]);
  private disabled = false;
  private readonly onChange = jest.fn<ScopePickerProps['onChange']>();
  private baseElement!: Element;

  readonly given = {
    selectedScope: (selectedScope: Scope): this => {
      this.selectedScope = selectedScope;

      return this;
    },
    disabled: (disabled: boolean): this => {
      this.disabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      this.baseElement = render(
        <BrowserOverrideScopePicker
          selectedScope={this.selectedScope}
          disabled={this.disabled}
          onChange={this.onChange}
        />,
      ).baseElement;
    },
    scopeSelected: async (scope: Scope): Promise<void> => {
      await this.get.radioGroup().selectByValue(scope);
    },
  };

  readonly get = {
    radioGroup: () =>
      RadioGroupTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-scope',
      }),
    onChangeMock: (): ScopePickerProps['onChange'] => this.onChange,
  };
}
