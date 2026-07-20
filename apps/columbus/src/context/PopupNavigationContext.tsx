import { createContext, type ReactNode, useContext } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { usePopupSession } from './PopupSessionContext';
import { createArtifactConfigurationViewModel } from '../popup/popup-view-models';
import type { EditorModel } from '../popup/types';
import {
  ARTIFACT_CONFIGURATION_ROUTE,
  ARTIFACTS_ROUTE,
  artifactConfigurationPath,
} from '../popup/popup-routes';

interface PopupNavigationContextValue {
  artifactConfiguration: EditorModel | undefined;
  showArtifactsList: () => void;
  showArtifactConfiguration: (key: string) => void;
}

const PopupNavigationContext = createContext<
  PopupNavigationContextValue | undefined
>(undefined);

export function PopupNavigationProvider({ children }: { children: ReactNode }) {
  const { session } = usePopupSession();
  const navigate = useNavigate();
  const configurationMatch = useMatch(ARTIFACT_CONFIGURATION_ROUTE);
  const artifactConfiguration = createArtifactConfigurationViewModel(
    configurationMatch?.params.artifactKey,
    session?.hostData,
    session?.activeOverrides ?? new Map(),
    session?.disabledOverrides ?? new Map(),
  );

  function showArtifactsList(): void {
    void navigate(ARTIFACTS_ROUTE);
  }

  function showArtifactConfiguration(key: string): void {
    void navigate(artifactConfigurationPath(key));
  }

  return (
    <PopupNavigationContext.Provider
      value={{
        artifactConfiguration,
        showArtifactsList,
        showArtifactConfiguration,
      }}
    >
      {children}
    </PopupNavigationContext.Provider>
  );
}

export function usePopupNavigation(): PopupNavigationContextValue {
  const value = useContext(PopupNavigationContext);
  if (!value)
    throw new Error(
      'usePopupNavigation must be used within PopupNavigationProvider.',
    );
  return value;
}
