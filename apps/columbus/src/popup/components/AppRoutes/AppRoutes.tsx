import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ARTIFACT_CONFIGURATION_ROUTE,
  ARTIFACTS_ROUTE,
} from '../../popup-routes';
import { ArtifactConfigurationPage } from '../ArtifactConfigurationPage';
import { ArtifactsListPage } from '../ArtifactsListPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ARTIFACTS_ROUTE} element={<ArtifactsListPage />} />
      <Route
        path={ARTIFACT_CONFIGURATION_ROUTE}
        element={<ArtifactConfigurationPage />}
      />
      <Route path="*" element={<Navigate to={ARTIFACTS_ROUTE} replace />} />
    </Routes>
  );
}
