import { Box } from '@wix/design-system';
import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ARTIFACT_OVERRIDE_ROUTE,
  ARTIFACTS_ROUTE,
} from '../../routing/routes/routes';
import { ArtifactsListPage } from '../ArtifactsListPage/ArtifactsListPage';
import { ArtifactOverrideEditorPage } from '../ArtifactOverrideEditorPage/ArtifactOverrideEditorPage';

export function App() {
  return (
    <Box direction="vertical" gap="12px" height="100%">
      <Routes>
        <Route path={ARTIFACTS_ROUTE} element={<ArtifactsListPage />} />
        <Route
          path={ARTIFACT_OVERRIDE_ROUTE}
          element={
            <Suspense fallback={null}>
              <ArtifactOverrideEditorPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to={ARTIFACTS_ROUTE} replace />} />
      </Routes>
    </Box>
  );
}
