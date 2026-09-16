import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import {
  DropdownTestkit,
  InputTestkit,
  RadioTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { ComponentProps } from 'react';
import type {
  ArtifactConfiguration,
  OverrideSelection,
  OverrideType,
} from '../../../types/artifact';
import type { ArtifactVersion } from '../../../types/artifact-version';
import { anArtifactConfiguration } from '../../../types/artifact.testkit';
import { OverridesSelectionForm } from './OverridesSelectionForm';

type OverridesSelectionFormProps = ComponentProps<
  typeof OverridesSelectionForm
>;

export class OverridesSelectionFormDriver {
  private selection: OverrideSelection = {
    type: faker.helpers.arrayElement<OverrideType>([
      'custom',
      'production',
      'pr',
    ]),
    value: faker.string.alphanumeric(8),
  };
  private configuration: ArtifactConfiguration = anArtifactConfiguration();
  private readonly onChange =
    jest.fn<OverridesSelectionFormProps['onChange']>();
  private baseElement!: Element;

  readonly given = {
    selection: (selection: OverrideSelection): this => {
      this.selection = selection;

      return this;
    },
    hostId: (hostId: string): this => {
      this.configuration = { ...this.configuration, hostId };

      return this;
    },
    productionArtifactVersions: (
      productionArtifactVersions: ArtifactVersion[],
    ): this => {
      this.configuration = {
        ...this.configuration,
        productionArtifactVersions,
      };

      return this;
    },
    prArtifactVersions: (prArtifactVersions: ArtifactVersion[]): this => {
      this.configuration = { ...this.configuration, prArtifactVersions };

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      this.baseElement = render(
        <OverridesSelectionForm
          selection={this.selection}
          configuration={this.configuration}
          onChange={this.onChange}
        />,
      ).baseElement;
    },
    overrideTypeSelected: async (overrideType: OverrideType): Promise<void> => {
      await this.get.radio(`override-card-${overrideType}`).click();
    },
    customUrlEntered: async (url: string): Promise<void> => {
      await this.get.customUrlInput().enterText(url);
    },
    productionArtifactVersionChosen: async (
      artifactVersion: ArtifactVersion,
    ): Promise<void> => {
      await this.artifactVersionChosen(
        this.get.dropdown('override-version-production'),
        this.configuration.productionArtifactVersions.indexOf(artifactVersion),
      );
    },
    prArtifactVersionChosen: async (
      artifactVersion: ArtifactVersion,
    ): Promise<void> => {
      await this.artifactVersionChosen(
        this.get.dropdown('override-version-pr'),
        this.configuration.prArtifactVersions.indexOf(artifactVersion),
      );
    },
  };

  readonly get = {
    radio: (dataHook: string) =>
      RadioTestkit({ wrapper: this.baseElement, dataHook }),
    customUrlInput: () =>
      InputTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-custom-url',
      }),
    dropdown: (dataHook: string) =>
      DropdownTestkit({ wrapper: this.baseElement, dataHook }),
    changeMock: () => this.onChange,
  };

  private async artifactVersionChosen(
    dropdown: ReturnType<typeof DropdownTestkit>,
    index: number,
  ): Promise<void> {
    await dropdown.inputDriver.click();
    const options = await dropdown.dropdownLayoutDriver.options();
    const option = options[index];
    if (!option) throw new Error('Option was not rendered.');

    await option.click();
  }
}
