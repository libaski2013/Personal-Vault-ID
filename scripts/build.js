/* Copy React UMD bundles into public so pages don't rely on external CDNs */
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'public/trustid/js');

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

function copy(src, dst) {
  if (!fs.existsSync(src)) { console.warn('Not found:', src); return; }
  fs.copyFileSync(src, dst);
  console.log('Copied', path.basename(src));
}

copy(
  path.join(root, 'node_modules/react/umd/react.production.min.js'),
  path.join(dest, 'react.min.js')
);
copy(
  path.join(root, 'node_modules/react-dom/umd/react-dom.production.min.js'),
  path.join(dest, 'react-dom.min.js')
);

console.log('Build complete.');
