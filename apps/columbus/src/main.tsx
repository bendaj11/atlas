import '@wix/design-system/styles.global.css';
import { createRoot } from 'react-dom/client';
import './popup.css';
import { App } from './App';
import { PopupProvider } from './popup/PopupProvider.js';

const root = document.getElementById('root');

if (!root) throw new Error('Missing extension element #root.');

createRoot(root).render(
  <PopupProvider>
    <App />
  </PopupProvider>,
);
