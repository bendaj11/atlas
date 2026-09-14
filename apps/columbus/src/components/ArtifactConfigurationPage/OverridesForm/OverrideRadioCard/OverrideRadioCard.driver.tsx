import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EditorDraft } from '../../../../types/app';
import { OverrideRadioCard } from './OverrideRadioCard';

export class OverrideRadioCardDriver {
  private type: EditorDraft['type'] = 'custom';
  private currentSelectedType: EditorDraft['type'] = 'production';
  private disabled = false;
  private readonly onSelect = jest.fn();

  readonly given = {
    type: (type: EditorDraft['type']): this => {
      this.type = type;

      return this;
    },
    currentSelectedType: (type: EditorDraft['type']): this => {
      this.currentSelectedType = type;

      return this;
    },
    disabled: (disabled: boolean): this => {
      this.disabled = disabled;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      render(
        <OverrideRadioCard
          type={this.type}
          title="Custom URL"
          disabled={this.disabled}
          currentSelectedType={this.currentSelectedType}
          onSelect={this.onSelect}
        >
          <span>child content</span>
        </OverrideRadioCard>,
      );

      return this;
    },
    selected: async (): Promise<this> => {
      await userEvent.click(this.get.radio());

      return this;
    },
  };

  readonly get = {
    radio: (): HTMLInputElement => screen.getByRole('radio'),
    title: (): HTMLElement | null => screen.queryByText('Custom URL'),
    children: (): HTMLElement | null => screen.queryByText('child content'),
    selectCount: (): number => this.onSelect.mock.calls.length,
  };
}
