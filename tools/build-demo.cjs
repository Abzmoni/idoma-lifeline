const { execFileSync } = require('node:child_process');
const path = require('node:path');
execFileSync(process.execPath, [path.resolve(__dirname, '../frontend/node_modules/vite/bin/vite.js'), 'build'], {
  cwd: path.resolve(__dirname, '../frontend'), env: { ...process.env, VITE_API_URL: '' }, stdio: 'inherit', windowsHide: true
});
