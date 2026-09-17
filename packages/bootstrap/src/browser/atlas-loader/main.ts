import { showFatalError } from '../fatal-error/index.js';
import { startAtlasLoader } from './atlas-loader.js';

void startAtlasLoader().catch((error) => showFatalError({ error }));
