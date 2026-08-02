import { mount } from './bootstrap';
const root = document.getElementById('root');
if (!root) throw new Error('React root is missing.');

void mount({ container: root });
