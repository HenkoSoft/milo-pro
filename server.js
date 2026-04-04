const fs = require('fs');
const path = require('path');

const runtimePath = path.join(__dirname, 'backend', 'dist', 'server.js');

if (!fs.existsSync(runtimePath)) {
  throw new Error('Backend TypeScript runtime not built. Run `npm run build:backend` or `npm start`.');
}

require(runtimePath);
