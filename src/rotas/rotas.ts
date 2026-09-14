import { useEffect, useState } from 'react';

/**
 * Roteador de hash, escrito a mao.
 *
 * Tres telas nao pagam uma dependencia de roteamento — mas pagam um roteador de
 * verdade em vez de um useState: com hash, voltar no navegador volta de tela, o
 * link pode ser compartilhado e recarregar a pagina cai onde a pessoa estava.
 * Com estado em memoria, o botao "voltar" fecharia o app.
 *
 * Hash e nao History API de proposito: `#/lancamentos` nao chega ao servidor,
 * entao nao exige fallback de SPA em nenhum host — inclusive no que ainda nem
 * foi escolhido.
 */
export const ROTAS = ['inicio', 'lancamentos', 'estatisticas', 'categorias'] as const;

export type Rota = (typeof ROTAS)[number];

const CAMINHOS: Record<Rota, string> = {
  inicio: '#/',
  lancamentos: '#/lancamentos',
  estatisticas: '#/estatisticas',
  categorias: '#/categorias',
};

export function caminhoDa(rota: Rota): string {
  return CAMINHOS[rota];
}

/** Hash desconhecido cai em 'inicio' em vez de tela em branco. */
export function rotaDoHash(hash: string): Rota {
  const limpo = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const encontrada = ROTAS.find((rota) => rota !== 'inicio' && rota === limpo);
  return encontrada ?? 'inicio';
}

export function useRota(): Rota {
  const [rota, setRota] = useState<Rota>(() => rotaDoHash(window.location.hash));

  useEffect(() => {
    function aoMudar(): void {
      setRota(rotaDoHash(window.location.hash));
      // Trocar de tela recomeca a leitura do topo; sem isso, sair de uma lista
      // longa entrega a tela seguinte ja rolada no meio.
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  return rota;
}
