import { installBrowserCompat } from '../browser-compat/browser-compat.js';
import { showFatalError } from '../fatal-error/fatal-error.js';
import { startAtlasLoader } from './atlas-loader.js';

installBrowserCompat();
void startAtlasLoader().catch(showFatalError);
