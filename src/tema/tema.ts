import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Tema = 'claro' | 'escuro';
/** 'sistema' nao e um tema: e "siga o aparelho", e o padrao de quem nunca escolheu. */
export type PreferenciaDeTema = Tema | 'sistema';

const CHAVE = 'financeiro:tema';

const PREFERENCIAS: readonly PreferenciaDeTema[] = ['sistema', 'claro', 'escuro'];

export const ROTULOS: Record<PreferenciaDeTema, string> = {
  sistema: 'Automático',
  claro: 'Claro',
  escuro: 'Escuro',
};

function ehPreferencia(valor: string | null): valor is PreferenciaDeTema {
  return valor !== null && (PREFERENCIAS as readonly string[]).includes(valor);
}

function lerPreferencia(): PreferenciaDeTema {
  try {
    const guardado = localStorage.getItem(CHAVE);
    return ehPreferencia(guardado) ? guardado : 'sistema';
  } catch {
    // Modo anonimo com armazenamento bloqueado: o app nao pode quebrar por causa
    // da cor de fundo. Cai no automatico, que nao precisa de disco.
    return 'sistema';
  }
}

function consultaEscuro(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
}

export function temaEfetivo(preferencia: PreferenciaDeTema): Tema {
  if (preferencia !== 'sistema') {
    return preferencia;
  }
  return consultaEscuro()?.matches === true ? 'escuro' : 'claro';
}

/* ------------------------------------------------------------------ *
 * Store de modulo
 * ------------------------------------------------------------------ */

/**
 * O tema e UM so para a pagina inteira, entao ele nao pode viver em useState
 * dentro de cada componente: com o botao na sidebar E na barra superior, cada
 * cópia teria seu proprio valor e uma delas ficaria mostrando "Tema escuro"
 * enquanto a tela ja esta escura. Store de modulo + useSyncExternalStore da a
 * todos os leitores a mesma fonte.
 */
let preferenciaAtual: PreferenciaDeTema = lerPreferencia();
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function lerSnapshot(): PreferenciaDeTema {
  return preferenciaAtual;
}

/**
 * Aplica o tema no <html>.
 *
 * `data-trocando-tema` fica no ar por um quadro para desligar todas as
 * transicoes durante a troca — sem isso, centenas de `transition-colors`
 * disparam ao mesmo tempo e a troca vira um clarao arrastado.
 *
 * `theme-color` acompanha: no celular e a cor da barra do navegador, e uma barra
 * quase preta em cima de um app claro (ou o contrario) denuncia a troca pela
 * metade.
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;

  raiz.setAttribute('data-trocando-tema', '');
  if (tema === 'escuro') {
    raiz.setAttribute('data-tema', 'escuro');
  } else {
    raiz.removeAttribute('data-tema');
  }

  const cor = tema === 'escuro' ? '#0f121b' : '#f7f8fa';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);

  requestAnimationFrame(() => {
    raiz.removeAttribute('data-trocando-tema');
  });
}

function definirPreferencia(nova: PreferenciaDeTema): void {
  preferenciaAtual = nova;
  try {
    localStorage.setItem(CHAVE, nova);
  } catch {
    // Sem disco a escolha vale so nesta sessao — melhor que nao valer.
  }
  aplicarTema(temaEfetivo(nova));
  avisar();
}

/**
 * Chamado uma vez, antes do React montar. Pinta a tela ja no tema certo: se a
 * primeira pintura sai clara e o efeito escurece depois, o usuario de tema
 * escuro leva um flash branco na cara a cada abertura.
 */
export function iniciarTema(): void {
  aplicarTema(temaEfetivo(preferenciaAtual));

  const consulta = consultaEscuro();
  // Em 'sistema' o app continua ouvindo: o aparelho virar escuro ao anoitecer
  // tem que chegar aqui sem recarregar a pagina.
  consulta?.addEventListener('change', () => {
    if (preferenciaAtual === 'sistema') {
      aplicarTema(temaEfetivo('sistema'));
      avisar();
    }
  });
}

export interface EstadoDoTema {
  preferencia: PreferenciaDeTema;
  tema: Tema;
  definir: (preferencia: PreferenciaDeTema) => void;
  /** Alterna claro <-> escuro a partir do que esta valendo AGORA. */
  alternar: () => void;
}

export function useTema(): EstadoDoTema {
  const preferencia = useSyncExternalStore(inscrever, lerSnapshot, lerSnapshot);

  // Recalculado a cada notificacao: em 'sistema' ele muda sem a preferencia mudar.
  const tema = temaEfetivo(preferencia);

  const definir = useCallback((nova: PreferenciaDeTema): void => {
    definirPreferencia(nova);
  }, []);

  const alternar = useCallback((): void => {
    definirPreferencia(temaEfetivo(preferenciaAtual) === 'escuro' ? 'claro' : 'escuro');
  }, []);

  // Rede de seguranca para o HMR: em desenvolvimento o modulo pode recarregar e
  // perder o atributo do <html>. Em producao isto e um no-op depois do primeiro
  // quadro, porque iniciarTema() ja deixou tudo no lugar.
  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  return { preferencia, tema, definir, alternar };
}
