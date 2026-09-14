import { jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Manifest } from '../../../../types/app';
import { OverrideVersionDropdown } from './OverrideVersionDropdown';

export class OverrideVersionDropdownDriver {
  private versions: Manifest[] = [];
  private selectedId = '';
  private hostId = 'host';
  private deployedManifest: Manifest | undefined;
  private disabled = false;
  private readonly onChange = jest.fn<(value: string) => void>();

  readonly given = {
    versions: (versions: Manifest[]): this => {
      this.versions = versions;

      return this;
    },
    selectedId: (selectedId: string): this => {
      this.selectedId = selectedId;

      return this;
    },
    hostId: (hostId: string): this => {
      this.hostId = hostId;

      return this;
    },
    deployedManifest: (manifest: Manifest | undefined): this => {
      this.deployedManifest = manifest;

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
        <OverrideVersionDropdown
          disabled={this.disabled}
          selectedId={this.selectedId}
          versions={this.versions}
          hostId={this.hostId}
          deployedManifest={this.deployedManifest}
          onChange={this.onChange}
        />,
      );

      return this;
    },
    opened: async (): Promise<this> => {
      await userEvent.click(this.get.input());

      return this;
    },
    optionChosen: async (label: string): Promise<this> => {
      await userEvent.click(this.get.input());
      await userEvent.click(this.get.option(label));

      return this;
    },
  };

  readonly get = {
    input: (): HTMLInputElement => screen.getByRole('combobox'),
    optionLabels: (): string[] =>
      screen.getAllByRole('option').map((option) => option.textContent ?? ''),
    option: (label: string): HTMLElement => {
      const option = screen
        .getAllByRole('option', { hidden: true })
        .find((item) => item.textContent?.startsWith(label));
      if (!option) throw new Error(`Option ${label} was not found.`);

      return option;
    },
    optionHasBadge: (label: string, badge: string): boolean =>
      within(this.get.option(label)).queryByText(badge) !== null,
    selectedValue: (): string | undefined => this.onChange.mock.calls[0]?.[0],
  };
}
