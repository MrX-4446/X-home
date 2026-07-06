import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 说明：pdfjs-dist 使用了 top-level await，需要把构建/依赖预打包目标提升到 esnext
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
})
