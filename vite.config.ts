/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  server: {
    proxy: {
      '/zm/api': {
        target: process.env.VITE_ZM_SERVER_URL || 'http://192.168.1.60',
        changeOrigin: true,
        secure: false,
        // Ensure cookies are forwarded for session-based authentication
        cookieDomainRewrite: {
          '*': ''
        },
        // Rewrite cookie path to match the proxy path
        cookiePathRewrite: {
          '*': ''
        },
        // Additional headers for proper cookie handling
        headers: {
          'X-Forwarded-Host': 'localhost'
        }
      },
      '/zm/index.php': {
        target: process.env.VITE_ZM_SERVER_URL || 'http://192.168.1.60',
        changeOrigin: true,
        secure: false,
      },
      '/zm/cgi-bin': {
        target: process.env.VITE_ZM_SERVER_URL || 'http://192.168.1.60',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
