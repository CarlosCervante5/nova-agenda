import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/booking/admin-dist/',
  server: {
    port: 5173,
    proxy: {
      '/booking/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/booking/, '')
      }
    }
  }
})
