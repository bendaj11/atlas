import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { DropdownTestkit } from '@wix/design-system/dist/testkit/testing-library';
import type { ComponentProps } from 'react';
import type { ArtifactVersion } from '../../../../types/app';
import { OverrideVersionDropdown } from './OverrideVersionDropdown';

type OverrideVersionDropdownProps = ComponentProps<
  typeof OverrideVersionDropdown
>;

export class OverrideVersionDropdownDriver {
  private versions: ArtifactVersion[] = [];
  private hostId = faker.string.uuid();
  private deployedArtifactVersion: ArtifactVersion | undefined;
  private disabled = false;
  private readonly onChange =
    jest.fn<OverrideVersionDropdownProps['onChange']>();
  private baseElement!: Element;

  readonly given = {
    versions: (versions: ArtifactVersion[]): this => {
      this.versions = versions;

      return this;
    },
    hostId: (hostId: string): this => {
      this.hostId = hostId;

      return this;
    },
    deployedArtifactVersion: (manifest: ArtifactVersion | undefined): this => {
      this.deployedArtifactVersion = manifest;

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
          selectedId=""
          versions={this.versions}
          hostId={this.hostId}
          deployedArtifactVersion={this.deployedArtifactVersion}
          onChange={this.onChange}
        />,
      ).baseElement;
    },
    opened: async (): Promise<void> => {
      await this.get.dropdown().inputDriver.click();
    },
    versionChosen: async (version: ArtifactVersion): Promise<void> => {
      const option = await this.get.option(version);
      await option.click();
    },
  };

  readonly get = {
    dropdown: () =>
      DropdownTestkit({
        wrapper: this.baseElement,
        dataHook: 'override-version-dropdown',
      }),
    option: async (version: ArtifactVersion) => {
      const options = await this.get.dropdown().dropdownLayoutDriver.options();

      return options[this.versions.indexOf(version)];
    },
    changeMock: (): OverrideVersionDropdownProps['onChange'] => this.onChange,
  };
}
