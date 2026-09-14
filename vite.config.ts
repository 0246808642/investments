import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Permite abrir no celular pelo IP da maquina durante o desenvolvimento.
    host: true,
  },
});
