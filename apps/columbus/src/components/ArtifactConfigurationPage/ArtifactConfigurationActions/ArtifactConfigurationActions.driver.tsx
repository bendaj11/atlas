import { render, type RenderResult } from '@testing-library/react';
import { jest } from '@jest/globals';
import {
  ButtonTestkit,
  IconButtonTestkit,
} from '@wix/design-system/dist/testkit/testing-library.js';
import { ArtifactConfigurationActions } from './ArtifactConfigurationActions.js';

export class ArtifactConfigurationActionsDriver {
  private readonly onSave = jest.fn();
  private readonly onClear = jest.fn();
  private readonly onCancel = jest.fn();
  private saveDisabled = false;
  private clearDisabled = false;
  private cancelDisabled = false;
  private view: RenderResult | undefined;

  readonly given = {
    saveDisabled: (): this => {
      this.saveDisabled = true;
      return this;
    },
    clearDisabled: (): this => {
      this.clearDisabled = true;
      return this;
    },
    cancelDisabled: (): this => {
      this.cancelDisabled = true;
      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      this.view = render(
        <ArtifactConfigurationActions
          onSave={this.onSave}
          onClear={this.onClear}
          onCancel={this.onCancel}
          saveDisabled={this.saveDisabled}
          clearDisabled={this.clearDisabled}
          cancelDisabled={this.cancelDisabled}
        />,
      );
      return this;
    },
    saveClicked: async (): Promise<this> => {
      await this.get.saveButton().click();
      return this;
    },
    clearClicked: async (): Promise<this> => {
      await this.get.clearButton().click();
      return this;
    },
  };

  readonly get = {
    saveButton: () =>
      ButtonTestkit({
        wrapper: this.get.container(),
        dataHook: 'save-configuration',
      }),
    clearButton: () =>
      IconButtonTestkit({
        wrapper: this.get.container(),
        dataHook: 'clear-override',
      }),
    cancelButton: () =>
      ButtonTestkit({
        wrapper: this.get.container(),
        dataHook: 'cancel-configuration',
      }),
    saveCalls: (): number => this.onSave.mock.calls.length,
    clearCalls: (): number => this.onClear.mock.calls.length,
    container: (): HTMLElement => {
      if (!this.view) throw new Error('Actions were not rendered.');
      return this.view.container;
    },
  };
}
