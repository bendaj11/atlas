import { ARTIFACT_CONFIGURATION_ROUTE } from './routes';

export class RoutesDriver {
  readonly get = {
    artifactConfigurationRoute: (): string => ARTIFACT_CONFIGURATION_ROUTE,
  };
}
