/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Semantica de dominio. O codigo nunca escreve green-600 direto. ───

        // Receita. Hue mantido: ja esta calibrado e legivel.
        entrada: {
          DEFAULT: '#047857',
          forte: '#065f46',
          suave: '#edf8f3',
          borda: '#b7e3d0',
        },

        // Despesa. Dessaturado do #b91c1c anterior: vermelho puro e linguagem de
        // ERRO, e nem toda saida e um alarme. REGRA: na lista, saida usa
        // text-tinta com prefixo "−". Esta cor so aparece nos chips comparativos,
        // no saldo negativo e na rampa do calendario.
        saida: {
          DEFAULT: '#af3029',
          forte: '#8f241e',
          suave: '#fbf1f0',
          borda: '#ebc9c5',
          // Rampa de calor tokenizada em vez de bg-saida/20. Pre-requisito
          // barato para o modo escuro depois.
          calor1: '#fbf1f0',
          calor2: '#f3d9d6',
          calor3: '#e3aca6',
          calor4: '#c9756c',
        },

        superficie: {
          DEFAULT: '#ffffff', // card / folha. Branco puro: e ele que cria o degrau.
          fundo: '#f7f8fa', // era #f1f5f9 (slate-100): frio, recortava cada card.
          borda: '#e4e7ec', // fio hairline — SUBSTITUI toda shadow-sm
          forte: '#d0d5dd', // divisor estrutural, borda de input
        },

        tinta: {
          DEFAULT: '#0f172a',
          suave: '#4e5a6e', // era #64748b (4.76:1), falhava nos rotulos de 11-12px
          fraca: '#8a94a6', // so meta/timestamp/placeholder. Nunca conteudo.
          forte: '#1e293b', // hover do botao primario
        },

        // Accent de marca. Existe para separar ACAO de ESTADO FINANCEIRO: sem ele
        // o unico elemento colorido clicavel seria verde ou vermelho.
        // USO: anel de foco, dia selecionado, mes ativo, link secundario.
        // NAO USO: botao primario — esse continua bg-tinta (quase-preto).
        marca: {
          DEFAULT: '#37508f',
          forte: '#2a3e72',
          suave: '#eef1fa',
          borda: '#c7d0ea',
        },

        // Paleta categorica do grafico: 6 matizes + neutro, todos na mesma faixa
        // de luminosidade para lerem como UMA familia, e nenhum a menos de 30 graus
        // de hue do entrada/saida — senao o usuario le "categoria vermelha = ruim".
        categoria: {
          1: '#37508f',
          2: '#0e7490',
          3: '#7c3aed',
          4: '#be185d',
          5: '#b45309',
          6: '#57534e',
          outros: '#94a3b8',
        },
      },

      spacing: {
        toque: '44px', // alvo minimo de toque: min-h-toque md:min-h-0
        sidebar: '240px',
      },

      borderRadius: {
        // Raio ESCALONADO, nao uniforme: card rounded-xl (12) > filho rounded-lg (8)
        // > pill rounded-md (6). Raio unico em tudo e o kit SaaS-card.
        folha: '1.25rem', // 20px — so o topo do bottom sheet
      },

      boxShadow: {
        // Sombra existe APENAS para o que flutua. Card, tabela, grafico e
        // calendario usam border-superficie-borda.
        flutuante: '0 8px 24px -6px rgba(15, 23, 42, 0.16)',
        folha: '0 -8px 32px -8px rgba(15, 23, 42, 0.14)',
        modal: '0 16px 48px -12px rgba(15, 23, 42, 0.18)',
        menu: '0 6px 20px -6px rgba(15, 23, 42, 0.14)',
      },

      fontFamily: {
        // Inter Variable via Google Fonts (latin + latin-ext; latin-ext e
        // obrigatorio, senao "ó", "ã" e "ç" caem no fallback). App e
        // offline-capable: primeira visita sem rede usa o stack de sistema,
        // cujas metricas sao proximas. font-display: swap no link.
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },

      fontSize: {
        rotulo: ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        valor: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em' }],
        heroi: ['2.75rem', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'heroi-lg': ['3.25rem', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
      },

      maxWidth: {
        // Duas camadas: a sidebar e full-bleed (cola na borda esquerda) e SO o
        // conteudo e capado. Capar o conjunto todo faria o app virar uma ilha
        // flutuante em 1920px — exatamente o deserto a evitar.
        conteudo: '1280px',
        'conteudo-2xl': '1440px',
      },

      gridTemplateColumns: {
        // minmax(0,1fr) e obrigatorio: sem ele, valor monetario longo ou descricao
        // sem espaco estoura o grid em vez de truncar.
        app: '240px minmax(0, 1fr)',
        'app-2xl': '264px minmax(0, 1fr)',
      },
    },
  },
  plugins: [],
};
