import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const SW_PLACEHOLDERS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

function replaceSW(sw: string, env: Record<string, string>) {
  for (const key of SW_PLACEHOLDERS) {
    sw = sw.replace(`__${key}__`, env[key] || '')
  }
  return sw
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'firebase-sw-env',
        // Dev: serve the SW with env vars injected
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/firebase-messaging-sw.js') {
              const sw = readFileSync(resolve('public/firebase-messaging-sw.js'), 'utf-8')
              res.setHeader('Content-Type', 'application/javascript')
              res.end(replaceSW(sw, env))
              return
            }
            next()
          })
        },
        // Build: replace placeholders in output
        writeBundle() {
          const swPath = resolve('dist/firebase-messaging-sw.js')
          try {
            const sw = readFileSync(swPath, 'utf-8')
            writeFileSync(swPath, replaceSW(sw, env))
          } catch {}
        },
      },
    ],
  }
})
