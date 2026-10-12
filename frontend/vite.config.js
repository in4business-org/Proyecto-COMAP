import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createRequire } from 'module'

/**
 * Modo demo (`npm run demo`): reemplaza la API y la sesión por datos de
 * ejemplo en memoria (src/demo/). No necesita backend, .env ni AWS.
 * En el build normal este plugin no se carga y nada de src/demo entra al bundle.
 */
function modoDemo() {
  const reemplazos = {
    'lib/api': path.resolve(__dirname, 'src/demo/api.js'),
    'context/AuthContext': path.resolve(__dirname, 'src/demo/auth.jsx'),
  }
  const VIRTUAL = 'virtual:demo-checklist'
  return {
    name: 'gpc-modo-demo',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === VIRTUAL) return '\0' + VIRTUAL
      if (importer?.includes(`${path.sep}demo${path.sep}`) || importer?.includes('/demo/')) return null
      for (const [fin, destino] of Object.entries(reemplazos)) {
        if (source.endsWith(fin)) return destino
      }
      return null
    },
    // El checklist del demo sale del archivo real del backend: no hay copia
    load(id) {
      if (id !== '\0' + VIRTUAL) return null
      const require = createRequire(import.meta.url)
      const base = path.resolve(__dirname, '../backend/src/common/constants')
      const archivos = ['checklist-items.js', 'checklist-preguntas.js']
      for (const a of archivos) delete require.cache[path.join(base, a)]
      const { CHECKLIST_PRESENTACION } = require(path.join(base, 'checklist-items.js'))
      let PREGUNTAS_CHECKLIST = []
      try {
        ;({ PREGUNTAS_CHECKLIST } = require(path.join(base, 'checklist-preguntas.js')))
      } catch { /* todavía no existe */ }
      return `export const CHECKLIST = ${JSON.stringify(CHECKLIST_PRESENTACION)};\n` +
        `export const PREGUNTAS = ${JSON.stringify(PREGUNTAS_CHECKLIST)};`
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [mode === 'demo' && modoDemo(), react(), tailwindcss()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'recharts': ['recharts'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
}))
