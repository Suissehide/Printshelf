import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 4271,
    strictPort: true,
    // En dev, l'API tourne à part (`back/`, port 4747) : le proxy évite tout CORS.
    proxy: { '/api': 'http://127.0.0.1:4747' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true, routeFileIgnorePattern: '\\.test\\.(ts|tsx)$' }),
    react(),
    tailwindcss(),
  ],
})
