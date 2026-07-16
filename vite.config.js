import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiTarget = env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "")
  const devPort = Number(env.VITE_DEV_PORT || 5174)

  const proxyCommon = {
    target: apiTarget,
    changeOrigin: true,
    secure: true,
    // Azure Set-Cookie Domain=*.azurewebsites.net → browser từ localhost/IP sẽ bỏ cookie.
    // Xóa Domain để ARRAffinity gắn đúng host Vite → sticky session SignalR không 404.
    cookieDomainRewrite: "",
    cookiePathRewrite: "/",
  }

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
                ...proxyCommon,
              },
              "/hubs": {
                ...proxyCommon,
                ws: true,
                rewriteWsOrigin: true,
                timeout: 0,
                proxyTimeout: 0,
                configure: (proxy) => {
                  proxy.on("error", (err) => {
                    console.warn("[vite /hubs proxy]", err?.message || err)
                  })
                },
              },
            },
          }
        : {}),
    },
  }
})
