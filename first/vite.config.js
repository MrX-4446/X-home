import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // =============================================================
  // 部署配置：同时支持 Netlify 和 GitHub Pages
  // =============================================================
  base: './',  // GitHub Pages 需要相对路径
  
  build: {
    // 使用 esbuild 压缩（Vite 内置，稳定可靠）
    minify: 'esbuild',
    sourcemap: false,
    // 拆包优化 - 利用浏览器缓存
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
  // 本地开发代理
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
