import { Box } from '@wix/design-system';
import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ARTIFACT_CONFIGURATION_ROUTE,
  ARTIFACTS_ROUTE,
} from '../../scripts/routing/routes/routes';
import { ArtifactsOverridesPage } from '../ArtifactsOverridesPage/ArtifactsOverridesPage';
import { ArtifactConfigurationPage } from '../ArtifactConfigurationPage/ArtifactConfigurationPage';

export function App() {
  return (
    <Box direction="vertical" gap="12px" height="100%">
      <Routes>
        <Route path={ARTIFACTS_ROUTE} element={<ArtifactsOverridesPage />} />
        <Route
          path={ARTIFACT_CONFIGURATION_ROUTE}
          element={
            <Suspense fallback={null}>
              <ArtifactConfigurationPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to={ARTIFACTS_ROUTE} replace />} />
      </Routes>
    </Box>
  );
}
