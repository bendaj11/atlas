import {
  isActionThemeMessage,
  isHostDataResponse,
  isInspectHostRequest,
  isLoadArtifactVersionRequest,
  isLoadDevelopmentSessionRequest,
  isManifestResponse,
  isOverrideCountMessage,
  isRecord,
} from './messages';

const GUARDS = {
  inspectHostRequest: isInspectHostRequest,
  loadArtifactVersionRequest: isLoadArtifactVersionRequest,
  overrideCountMessage: isOverrideCountMessage,
  actionThemeMessage: isActionThemeMessage,
  loadDevelopmentSessionRequest: isLoadDevelopmentSessionRequest,
  hostDataResponse: isHostDataResponse,
  manifestResponse: isManifestResponse,
  record: isRecord,
};

export type MessageGuard = keyof typeof GUARDS;

export class MessagesDriver {
  private result: boolean | undefined;

  readonly when = {
    checked: (guard: MessageGuard, value: unknown): this => {
      this.result = GUARDS[guard](value);

      return this;
    },
  };

  readonly get = {
    result: (): boolean | undefined => this.result,
  };
}
