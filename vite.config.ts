import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Backend local durante o desenvolvimento. Nao e endereco de producao: em
// producao o frontend e a API sao dois servicos do MESMO projeto na Vercel, atras
// do mesmo dominio, e nao existe URL para configurar.
const BACKEND_LOCAL = 'http://localhost:5148';

export default defineConfig(({ mode }) => {
  const ambiente = loadEnv(mode, '.', 'VITE_');
  const alvo = (ambiente['VITE_API_URL'] ?? '').trim() || BACKEND_LOCAL;

  return {
    plugins: [react()],
    server: {
      // Permite abrir no celular pelo IP da maquina durante o desenvolvimento.
      host: true,

      // O proxy faz o desenvolvimento ter a MESMA forma da producao: o navegador
      // so conhece a origem do Vite, e `/api/...` atravessa para o backend por
      // dentro. Sem ele, dev seria cross-origin (5173 -> 5148) e producao
      // same-origin — e a diferenca apareceria como um erro de CORS que existe
      // numa ponta so, exatamente o tipo de divergencia que custa uma tarde.
      proxy: {
        '/api': { target: alvo, changeOrigin: true },
        '/saude': { target: alvo, changeOrigin: true },
      },
    },
  };
});
