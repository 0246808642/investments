import { useSyncExternalStore } from 'react';

export type Idioma = 'pt-BR' | 'en' | 'es';

export const IDIOMAS: readonly Idioma[] = ['pt-BR', 'en', 'es'];

/** Cada idioma escrito NELE MESMO: quem procura espanhol procura "Español". */
export const NOMES_DOS_IDIOMAS: Record<Idioma, string> = {
  'pt-BR': 'Português',
  en: 'English',
  es: 'Español',
};

const CHAVE = 'financeiro:idioma';

function ehIdioma(valor: string | null): valor is Idioma {
  return valor !== null && (IDIOMAS as readonly string[]).includes(valor);
}

/**
 * Idioma do aparelho, reduzido ao que o app fala. `navigator.language` vem como
 * 'pt-BR', 'pt', 'en-GB', 'es-419'... entao a decisao e pelo PREFIXO: 'es-419' e
 * espanhol, e cair no ingles por causa do sufixo seria trocar o idioma certo por
 * um errado.
 */
function idiomaDoAparelho(): Idioma {
  const preferidos = typeof navigator === 'undefined' ? [] : [navigator.language];

  for (const marca of preferidos) {
    const prefixo = marca.toLowerCase().split('-')[0];
    if (prefixo === 'pt') {
      return 'pt-BR';
    }
    if (prefixo === 'es') {
      return 'es';
    }
    if (prefixo === 'en') {
      return 'en';
    }
  }
  return 'pt-BR';
}

function lerGuardado(): Idioma {
  try {
    const guardado = localStorage.getItem(CHAVE);
    return ehIdioma(guardado) ? guardado : idiomaDoAparelho();
  } catch {
    return idiomaDoAparelho();
  }
}

/* ------------------------------------------------------------------ *
 * Store de modulo
 * ------------------------------------------------------------------ */

/**
 * O idioma vive num modulo, e nao em contexto do React, porque quem mais precisa
 * dele NAO e componente: `formatarMoeda` e `formatarDataCurta` sao funcoes puras
 * chamadas em quarenta lugares, e passar locale por parametro em todas elas
 * poluiria cada assinatura do app para servir a um valor que e global de fato.
 *
 * Quem faz a tela reagir a troca e o <App>, que assina esta loja: uma mudanca
 * aqui re-renderiza a arvore inteira, e os formatadores ja leem o valor novo.
 */
let atual: Idioma = lerGuardado();
const ouvintes = new Set<() => void>();

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function lerSnapshot(): Idioma {
  return atual;
}

/** Para os formatadores, que nao sao componentes. */
export function idiomaAtual(): Idioma {
  return atual;
}

/** Aplica no <html lang>: leitor de tela e corretor do navegador dependem disso. */
export function aplicarIdioma(idioma: Idioma): void {
  document.documentElement.lang = idioma;
}

export function definirIdioma(idioma: Idioma): void {
  if (idioma === atual) {
    return;
  }
  atual = idioma;
  try {
    localStorage.setItem(CHAVE, idioma);
  } catch {
    // Sem disco a escolha vale so nesta sessao — melhor que nao valer.
  }
  aplicarIdioma(idioma);
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

/** Chamado uma vez, antes de montar: o <html lang> tem que sair certo na primeira pintura. */
export function iniciarIdioma(): void {
  aplicarIdioma(atual);
}

export function useIdioma(): Idioma {
  return useSyncExternalStore(inscrever, lerSnapshot, lerSnapshot);
}
