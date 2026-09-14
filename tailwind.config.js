/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cores semanticas do dominio. O codigo nunca escreve green-600 /
        // red-600 direto: usa text-entrada, bg-saida-suave, etc. Trocar a
        // paleta do app inteiro e mexer aqui.
        entrada: {
          DEFAULT: '#047857', // texto e valores de receita
          forte: '#065f46', // estado pressionado
          suave: '#ecfdf5', // fundo de chip / botao inativo
          borda: '#a7f3d0',
        },
        saida: {
          DEFAULT: '#b91c1c', // texto e valores de despesa
          forte: '#991b1b',
          suave: '#fef2f2',
          borda: '#fecaca',
        },
        superficie: {
          DEFAULT: '#ffffff', // cards e bottom sheet
          fundo: '#f1f5f9', // fundo da tela
          borda: '#e2e8f0',
        },
        tinta: {
          DEFAULT: '#0f172a', // texto principal
          suave: '#64748b', // texto secundario
        },
      },
      spacing: {
        // Alvo minimo de toque recomendado (44px). Usado como min-h-toque.
        toque: '44px',
      },
      borderRadius: {
        folha: '1.25rem', // cantos do bottom sheet
      },
    },
  },
  plugins: [],
};
