const root = document.querySelector('atlas-host-root');
if (!root) throw new Error('Atlas host root is missing.');

root.textContent = 'Start this Atlas host with atlas dev.';
