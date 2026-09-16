import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { DropdownTestkit } from '@wix/design-system/dist/testkit/testing-library';
import type { ComponentProps } from 'react';
import type { ArtifactVersion } from '../../../../types/artifact-version';
import { OverrideVersionDropdown } from './OverrideVersionDropdown';

type OverrideVersionDropdownProps = ComponentProps<
  typeof OverrideVersionDropdown
>;

export class OverrideVersionDropdownDriver {
  private artifactVersions: ArtifactVersion[] = [];
  private hostId = faker.string.uuid();
  private deployedArtifactVersion: ArtifactVersion | undefined;
  private disabled = faker.datatype.boolean();
  private readonly onChange =
    jest.fn<OverrideVersionDropdownProps['onChange']>();
  private baseElement!: Element;

  readonly given = {
    artifactVersions: (artifactVersions: ArtifactVersion[]): this => {
      this.artifactVersions = artifactVersions;

      return this;
    },
    hostId: (hostId: string): this => {
      this.hostId = hostId;

      return this;
    },
    deployedArtifactVersion: (
      deployedArtifactVersion: ArtifactVersion | undefined,
    ): this => {
      this.deployedArtifactVersion = deployedArtifactVersion;

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
        <OverrideVersionDropdown
          dataHook="override-version-dropdown"
          disabled={this.disabled}
          selectedArtifactVersionKey={faker.string.uuid()}
          artifactVersions={this.artifactVersions}
          hostId={this.hostId}
          deployedArtifactVersion={this.deployedArtifactVersion}
          onChange={this.onChange}
        />,
      ).baseElement;
    },
    opened: async (): Promise<void> => {
      await this.get.dropdown().inputDriver.click();
    },
    artifactVersionChosen: async (
      artifactVersion: ArtifactVersion,
    ): Promise<void> => {
      const option = await this.get.option(artifactVersion);
      await option.click();
    },
  };

  readonly get = {
    dropdown: () =>
      DropdownTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-version-dropdown',
      }),
    option: async (artifactVersion: ArtifactVersion) => {
      const options = await this.get.dropdown().dropdownLayoutDriver.options();
      const option = options[this.artifactVersions.indexOf(artifactVersion)];
      if (!option) throw new Error('Option was not rendered.');

      return option;
    },
    changeMock: () => this.onChange,
  };
}
