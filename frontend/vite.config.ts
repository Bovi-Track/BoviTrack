import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// https://vite.dev/config/
export default defineConfig({
  envDir: projectRoot,
  plugins: [react(), tailwindcss(), {
    name: 'bovitrack-offline-app',
    // RF-TR-01: genera la caché de aplicación con los nombres reales de los archivos compilados.
    generateBundle(_options, bundle) {
      const files = ['/index.html', '/manifest.webmanifest', '/favicon.svg',
        ...Object.keys(bundle).filter((file) => /\.(js|css|png|svg|woff2)$/.test(file)).map((file) => `/${file}`)]
      const template = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8')
      const version = createHash('sha256').update(JSON.stringify(files) + template).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template
        .replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)) })
    },
  }],
})
