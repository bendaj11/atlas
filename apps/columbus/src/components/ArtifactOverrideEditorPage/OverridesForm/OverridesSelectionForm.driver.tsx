import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import {
  DropdownTestkit,
  InputTestkit,
  RadioTestkit,
} from '@wix/design-system/dist/testkit/testing-library';
import type { ComponentProps } from 'react';
import {
  type ArtifactOverrideOptions,
  OVERRIDE_TYPES,
  type OverrideSelection,
  type OverrideType,
} from '../../../types/artifact';
import type { ArtifactVersion } from '../../../types/artifact-version';
import { anArtifactOverrideOptions } from '../../../testkit/artifact.testkit';
import { OverridesSelectionForm } from './OverridesSelectionForm';

type OverridesSelectionFormProps = ComponentProps<
  typeof OverridesSelectionForm
>;

export class OverridesSelectionFormDriver {
  private selection: OverrideSelection = {
    type: faker.helpers.arrayElement(OVERRIDE_TYPES),
    value: faker.string.alphanumeric(8),
  };
  private overrideOptions = anArtifactOverrideOptions();
  private hostId = faker.string.uuid();
  private readonly onChange =
    jest.fn<OverridesSelectionFormProps['onChange']>();
  private baseElement!: Element;

  readonly given = {
    selection: (selection: OverrideSelection) => {
      this.selection = selection;

      return this;
    },
    hostId: (hostId: string) => {
      this.hostId = hostId;

      return this;
    },
    overrideOptions: (overrideOptions: ArtifactOverrideOptions) => {
      this.overrideOptions = overrideOptions;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.baseElement = render(
        <OverridesSelectionForm
          selection={this.selection}
          overrideOptions={this.overrideOptions}
          hostId={this.hostId}
          onChange={this.onChange}
        />,
      ).baseElement;
    },
    overrideTypeSelected: (overrideType: OverrideType) =>
      this.get.radio(`override-card-${overrideType}`).click(),
    customUrlEntered: (url: string) => this.get.customUrlInput().enterText(url),
    productionArtifactVersionChosen: (artifactVersion: ArtifactVersion) =>
      this.artifactVersionChosen(
        this.get.dropdown('override-version-production'),
        this.overrideOptions.productionArtifactVersions.indexOf(
          artifactVersion,
        ),
      ),
    prArtifactVersionChosen: (artifactVersion: ArtifactVersion) =>
      this.artifactVersionChosen(
        this.get.dropdown('override-version-pr'),
        this.overrideOptions.prArtifactVersions.indexOf(artifactVersion),
      ),
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
