import 'es-module-shims';
import { showFatalError } from '../fatal-error/fatal-error.js';
import { startAtlasLoader } from './atlas-loader.js';

void startAtlasLoader().catch(showFatalError);
