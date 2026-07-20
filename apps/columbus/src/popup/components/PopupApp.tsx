import { Navigate, Route, Routes } from 'react-router-dom';
import { usePopupHost } from '../../context/PopupHostContext';
import { usePopupOverrides } from '../../context/PopupOverridesContext';
import {
  ARTIFACT_CONFIGURATION_ROUTE,
  ARTIFACTS_ROUTE,
} from '../popup-routes.js';
import { ArtifactConfigurationPage } from './ArtifactConfigurationPage.js';
import { ArtifactsListPage } from './ArtifactsListPage.js';

export function PopupApp() {
  const { message: hostMessage } = usePopupHost();
  const { message: overrideMessage, status: overrideStatus } =
    usePopupOverrides();
  const message = overrideStatus === 'ERROR' ? overrideMessage : hostMessage;

  return (
    <>
      {message ? (
        <div className="popup-error" role="status">
          {message}
        </div>
      ) : null}
      <Routes>
        <Route path={ARTIFACTS_ROUTE} element={<ArtifactsListPage />} />
        <Route
          path={ARTIFACT_CONFIGURATION_ROUTE}
          element={<ArtifactConfigurationPage />}
        />
        <Route path="*" element={<Navigate to={ARTIFACTS_ROUTE} replace />} />
      </Routes>
    </>
  );
}
