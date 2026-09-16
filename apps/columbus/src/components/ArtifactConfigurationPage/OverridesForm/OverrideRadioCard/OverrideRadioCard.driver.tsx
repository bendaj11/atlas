import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { RadioTestkit } from '@wix/design-system/dist/testkit/testing-library';
import type { ComponentProps } from 'react';
import { OverrideRadioCard } from './OverrideRadioCard';

type OverrideRadioCardProps = ComponentProps<typeof OverrideRadioCard>;

export class OverrideRadioCardDriver {
  private title = faker.commerce.productName();
  private children = faker.lorem.sentence();
  private checked = false;
  private disabled = false;
  private readonly onSelect = jest.fn<OverrideRadioCardProps['onSelect']>();
  private baseElement!: Element;

  readonly given = {
    title: (title: string): this => {
      this.title = title;

      return this;
    },
    children: (children: string): this => {
      this.children = children;

      return this;
    },
    checked: (checked: boolean): this => {
      this.checked = checked;

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
        <OverrideRadioCard
          dataHook="override-radio-card"
          title={this.title}
          checked={this.checked}
          disabled={this.disabled}
          onSelect={this.onSelect}
        >
          {this.children}
        </OverrideRadioCard>,
      ).baseElement;
    },
    selected: async (): Promise<void> => {
      await this.get.radio().click();
    },
  };

  readonly get = {
    radio: () =>
      RadioTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-radio-card',
      }),
    selectMock: (): OverrideRadioCardProps['onSelect'] => this.onSelect,
  };
}
