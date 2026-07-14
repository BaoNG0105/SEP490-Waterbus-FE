import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiTarget = env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "")
  const devPort = Number(env.VITE_DEV_PORT || 5174)

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: devPort,
      strictPort: true,
      ...(apiTarget
        ? {
            proxy: {
              "/api": {
                target: apiTarget,
                changeOrigin: true,
                secure: true,
              },
              "/hubs": {
                target: apiTarget,
                changeOrigin: true,
                secure: true,
                ws: true,
              },
            },
          }
        : {}),
    },
  }
})
