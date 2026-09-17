import { faker } from '@faker-js/faker';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { RadioGroupTestkit } from '@wix/design-system/dist/testkit/testing-library';
import { SCOPES, type Scope } from '../../../types/columbus-state';
import { BrowserOverrideScopePicker } from './BrowserOverrideScopePicker';

type ScopePickerProps = ComponentProps<typeof BrowserOverrideScopePicker>;

export class BrowserOverrideScopePickerDriver {
  private selectedScope = faker.helpers.arrayElement(SCOPES);
  private disabled = faker.datatype.boolean();
  private readonly onChange = jest.fn<ScopePickerProps['onChange']>();
  private baseElement!: Element;

  readonly given = {
    selectedScope: (selectedScope: Scope) => {
      this.selectedScope = selectedScope;

      return this;
    },
    disabled: (disabled: boolean) => {
      this.disabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.baseElement = render(
        <BrowserOverrideScopePicker
          selectedScope={this.selectedScope}
          disabled={this.disabled}
          onChange={this.onChange}
        />,
      ).baseElement;
    },
    scopeSelected: (scope: Scope) => this.get.radioGroup().selectByValue(scope),
  };

  readonly get = {
    radioGroup: () =>
      RadioGroupTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-scope',
      }),
    onChangeMock: () => this.onChange,
  };
}
