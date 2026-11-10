import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' makes the built site work from any GitHub Pages address
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
