import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'precache-production-app',
    apply: 'build',
    writeBundle(options, bundle) {
      const assets = ['/', '/index.html', '/manifest.json', '/favicon.svg', ...Object.keys(bundle).filter(name => name !== 'index.html').map(name => '/' + name)];
      const version = crypto.createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 12);
      const source = fs.readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8')
        .replace('__BUILD_ID__', version)
        .replace("/* __PRECACHE__ */ ['/', '/index.html', '/manifest.json', '/favicon.svg']", JSON.stringify(assets));
      fs.writeFileSync(path.join(options.dir, 'sw.js'), source);
    }
  }],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
