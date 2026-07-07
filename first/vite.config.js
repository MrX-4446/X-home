import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 说明：pdfjs-dist 使用了 top-level await，需要把构建/依赖预打包目标提升到 esnext
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 自动更新：有新版本时后台静默更新，下次打开即为最新
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg', 'app-icon-maskable.svg'],
      manifest: {
        name: 'X · 阅读伙伴',
        short_name: 'X',
        description: 'AI 恋人聊天与阅读伙伴',
        lang: 'zh-CN',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'app-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'app-icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 预缓存前端静态资源，实现秒开 + 断网可打开界面壳
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // 后端 API 不缓存，始终走网络，避免拿到过期数据
        navigateFallbackDenylist: [/^\/api/],
        // 提高单文件缓存上限（pdfjs 等体积较大）
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
