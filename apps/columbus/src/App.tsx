import { Box } from '@wix/design-system';
import { useEffect } from 'react';
import { usePopupHost } from './context';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ARTIFACT_CONFIGURATION_ROUTE,
  ARTIFACTS_ROUTE,
} from './popup/popup-routes';
import { ArtifactsOverridesPage } from './ArtifactsOverridesPage/ArtifactsOverridesPage';
import { ArtifactConfigurationPage } from './ArtifactConfigurationPage/ArtifactConfigurationPage';

export function App() {
  const { loadHost } = usePopupHost();

  useEffect(() => {
    void loadHost();
  }, []);

  return (
    <Box direction="vertical" gap="12px" height="100%">
      <Routes>
        <Route path={ARTIFACTS_ROUTE} element={<ArtifactsOverridesPage />} />
        <Route
          path={ARTIFACT_CONFIGURATION_ROUTE}
          element={<ArtifactConfigurationPage />}
        />
        <Route path="*" element={<Navigate to={ARTIFACTS_ROUTE} replace />} />
      </Routes>
    </Box>
  );
}
