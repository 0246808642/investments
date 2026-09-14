/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-tema="escuro"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /*
       * Nenhum hex aqui: cada token aponta para a variavel CSS declarada em
       * src/index.css, e e la que o tema claro e o escuro trocam de valor.
       * A sintaxe `rgb(var(--x) / <alpha-value>)` e o que mantem utilitarios
       * com opacidade (bg-tinta/40, ring-marca/50) funcionando.
       */
      colors: {
        // ─── Semantica de dominio. O codigo nunca escreve green-600 direto. ───

        entrada: {
          DEFAULT: 'rgb(var(--entrada) / <alpha-value>)',
          forte: 'rgb(var(--entrada-forte) / <alpha-value>)',
          suave: 'rgb(var(--entrada-suave) / <alpha-value>)',
          borda: 'rgb(var(--entrada-borda) / <alpha-value>)',
        },

        // Despesa. Dessaturado do vermelho puro, que e linguagem de ERRO: nem
        // toda saida e um alarme. REGRA: na lista, saida usa text-tinta com
        // prefixo "−". Esta cor so aparece nos chips comparativos, no saldo
        // negativo, nos avisos de limite e na rampa do calendario.
        saida: {
          DEFAULT: 'rgb(var(--saida) / <alpha-value>)',
          forte: 'rgb(var(--saida-forte) / <alpha-value>)',
          suave: 'rgb(var(--saida-suave) / <alpha-value>)',
          borda: 'rgb(var(--saida-borda) / <alpha-value>)',
          // Rampa de calor tokenizada em vez de bg-saida/20: opacidade compoe
          // com o fundo, e no tema escuro cada degrau e outro.
          calor1: 'rgb(var(--saida-calor1) / <alpha-value>)',
          calor2: 'rgb(var(--saida-calor2) / <alpha-value>)',
          calor3: 'rgb(var(--saida-calor3) / <alpha-value>)',
          calor4: 'rgb(var(--saida-calor4) / <alpha-value>)',
        },

        superficie: {
          DEFAULT: 'rgb(var(--superficie) / <alpha-value>)', // card / folha: e ele que cria o degrau
          fundo: 'rgb(var(--superficie-fundo) / <alpha-value>)', // atras do card
          borda: 'rgb(var(--superficie-borda) / <alpha-value>)', // fio hairline — SUBSTITUI toda shadow-sm
          forte: 'rgb(var(--superficie-forte) / <alpha-value>)', // divisor estrutural, borda de input
        },

        tinta: {
          DEFAULT: 'rgb(var(--tinta) / <alpha-value>)',
          suave: 'rgb(var(--tinta-suave) / <alpha-value>)', // rotulos de 11-12px ainda passam aqui
          fraca: 'rgb(var(--tinta-fraca) / <alpha-value>)', // so meta/timestamp/placeholder
          forte: 'rgb(var(--tinta-forte) / <alpha-value>)',
        },

        // Accent de marca: foco, selecao, mes ativo E o botao primario. Ele
        // separa ACAO de ESTADO FINANCEIRO — sem ele o unico elemento colorido
        // clicavel da tela seria verde ou vermelho.
        marca: {
          DEFAULT: 'rgb(var(--marca) / <alpha-value>)',
          forte: 'rgb(var(--marca-forte) / <alpha-value>)',
          suave: 'rgb(var(--marca-suave) / <alpha-value>)',
          borda: 'rgb(var(--marca-borda) / <alpha-value>)',
          // Texto POR CIMA de bg-marca. Branco no claro, quase-preto no escuro.
          contraste: 'rgb(var(--marca-contraste) / <alpha-value>)',
        },

        // Paleta categorica do grafico: 6 matizes + neutro, todos na mesma faixa
        // de luminosidade para lerem como UMA familia, e nenhum a menos de 30
        // graus de hue do entrada/saida — senao o usuario le "categoria vermelha
        // = ruim".
        categoria: {
          1: 'rgb(var(--categoria-1) / <alpha-value>)',
          2: 'rgb(var(--categoria-2) / <alpha-value>)',
          3: 'rgb(var(--categoria-3) / <alpha-value>)',
          4: 'rgb(var(--categoria-4) / <alpha-value>)',
          5: 'rgb(var(--categoria-5) / <alpha-value>)',
          6: 'rgb(var(--categoria-6) / <alpha-value>)',
          outros: 'rgb(var(--categoria-outros) / <alpha-value>)',
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
        //
        // A opacidade e alta de proposito: no tema escuro uma sombra preta sobre
        // fundo quase preto nao separa nada, e quem faz a folha flutuar passa a
        // ser o degrau de superficie + a borda. Estes valores dao conta dos dois
        // casos sem virar mancha no claro.
        flutuante: '0 8px 24px -6px rgb(0 0 0 / 0.28)',
        folha: '0 -8px 32px -8px rgb(0 0 0 / 0.26)',
        modal: '0 16px 48px -12px rgb(0 0 0 / 0.32)',
        menu: '0 6px 20px -6px rgb(0 0 0 / 0.24)',
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
