import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ArtifactConfiguration,
  EditorDraft,
  Manifest,
} from '../../../types/app';
import { aManifest } from '../../../types/app.testkit';
import { OverridesSelectionForm } from './OverridesSelectionForm';

export class OverridesSelectionFormDriver {
  private draft: EditorDraft = {
    type: 'custom',
    customUrl: '',
    productionKey: '',
    prKey: '',
  };
  private configuration: ArtifactConfiguration = {
    key: 'app:orders',
    hostId: 'host',
    productionManifest: aManifest(),
    selectedManifest: undefined,
    productionOptions: [],
    prOptions: [],
  };
  private readonly onDraftChange =
    jest.fn<(draft: Partial<EditorDraft>) => void>();

  readonly given = {
    draft: (draft: Partial<EditorDraft>): this => {
      this.draft = { ...this.draft, ...draft };

      return this;
    },
    productionOptions: (options: Manifest[]): this => {
      this.configuration = {
        ...this.configuration,
        productionOptions: options,
      };

      return this;
    },
    prOptions: (options: Manifest[]): this => {
      this.configuration = { ...this.configuration, prOptions: options };

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      render(
        <OverridesSelectionForm
          draft={this.draft}
          configuration={this.configuration}
          onDraftChange={this.onDraftChange}
        />,
      );

      return this;
    },
    typeChosen: async (title: string): Promise<this> => {
      await userEvent.click(screen.getByRole('radio', { name: title }));

      return this;
    },
    customUrlTyped: async (url: string): Promise<this> => {
      await userEvent.type(this.get.customUrlInput(), url);

      return this;
    },
    versionChosen: async (label: string): Promise<this> => {
      await userEvent.click(screen.getAllByRole('combobox')[0]!);
      await userEvent.click(
        screen.getByRole('option', { name: new RegExp(`^${label}`) }),
      );

      return this;
    },
  };

  readonly get = {
    radio: (title: string): HTMLInputElement =>
      screen.getByRole('radio', { name: title }),
    customUrlInput: (): HTMLInputElement =>
      screen.getByPlaceholderText('http://localhost:4200'),
    lastDraftChange: (): Partial<EditorDraft> | undefined =>
      this.onDraftChange.mock.calls.at(-1)?.[0],
  };
}
