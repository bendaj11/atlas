import '@wix/design-system/styles.global.css';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './components/App/App';
import { AppProvider } from './components/providers/AppProvider/AppProvider';

const root = document.getElementById('root');

if (!root) throw new Error('Missing extension element #root.');

createRoot(root).render(
  <AppProvider>
    <App />
  </AppProvider>,
);
