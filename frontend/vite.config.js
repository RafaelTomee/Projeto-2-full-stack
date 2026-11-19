import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A porta 5173 é a origem liberada no CORS do back-end (FRONTEND_URL).
// strictPort: se a porta estiver ocupada, falha em vez de trocar de porta em silêncio.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
