import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'inject-sw-env',
        writeBundle() {
          const swPath = resolve('dist/firebase-messaging-sw.js')
          try {
            let sw = readFileSync(swPath, 'utf-8')
            const replacements: Record<string, string> = {
              '__VITE_FIREBASE_API_KEY__': env.VITE_FIREBASE_API_KEY || '',
              '__VITE_FIREBASE_AUTH_DOMAIN__': env.VITE_FIREBASE_AUTH_DOMAIN || '',
              '__VITE_FIREBASE_PROJECT_ID__': env.VITE_FIREBASE_PROJECT_ID || '',
              '__VITE_FIREBASE_STORAGE_BUCKET__': env.VITE_FIREBASE_STORAGE_BUCKET || '',
              '__VITE_FIREBASE_MESSAGING_SENDER_ID__': env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
              '__VITE_FIREBASE_APP_ID__': env.VITE_FIREBASE_APP_ID || '',
            }
            for (const [key, val] of Object.entries(replacements)) {
              sw = sw.replace(key, val)
            }
            writeFileSync(swPath, sw)
          } catch {}
        },
      },
    ],
  }
})
