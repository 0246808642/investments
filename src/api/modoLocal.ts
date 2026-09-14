import { useSyncExternalStore } from 'react';

const CHAVE = 'financeiro:modo-local';

/**
 * "Usar sem conta".
 *
 * O app e offline-first: o banco e o aparelho, e a conta existe para LEVAR os
 * lancamentos para outro aparelho, nao para autorizar o uso. Exigir login para
 * lancar transforma uma decisao de sincronizacao em pre-requisito de uso — e num
 * app instalado no celular, sem rede, isso e a diferenca entre funcionar e nao
 * funcionar.
 *
 * Entao o portao continua de pe, com uma saida explicita: quem escolhe "usar sem
 * conta" lanca normalmente, e o que fica de fora e so a sincronizacao. A escolha
 * e por aparelho e reversivel a qualquer momento pelo menu da conta.
 *
 * localStorage e nao IndexedDB: e uma preferencia de interface deste navegador,
 * nao um dado do dominio, e precisa ser lida de forma sincrona na primeira
 * pintura para o portao nao piscar.
 */
let ativo: boolean = lerGuardado();
const ouvintes = new Set<() => void>();

function lerGuardado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function lerSnapshot(): boolean {
  return ativo;
}

export function modoLocalAtivo(): boolean {
  return ativo;
}

export function definirModoLocal(novo: boolean): void {
  if (novo === ativo) {
    return;
  }
  ativo = novo;
  try {
    if (novo) {
      localStorage.setItem(CHAVE, '1');
    } else {
      localStorage.removeItem(CHAVE);
    }
  } catch {
    // Sem disco a escolha vale so nesta sessao — melhor que nao valer.
  }
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

export function useModoLocal(): boolean {
  return useSyncExternalStore(inscrever, lerSnapshot, lerSnapshot);
}
