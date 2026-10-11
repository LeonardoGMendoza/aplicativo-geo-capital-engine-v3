import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    // iPhones com iOS antigo (Safari < 16.4) ignoram @media (width<=767px).
    // Com este alvo o build gera @media (max-width:767px), que todo celular entende.
    cssTarget: ['safari14', 'chrome90', 'edge90', 'firefox90'],
  },
})
