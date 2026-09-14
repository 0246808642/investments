import type { Rota } from '../../rotas/rotas';
import { ROTAS, caminhoDa } from '../../rotas/rotas';
import { useTextos } from '../../i18n';

export interface ItemNav {
  readonly rota: Rota;
  readonly rotulo: string;
  readonly href: string;
}

/**
 * Fonte unica da navegacao. Sidebar (>=lg), barra superior (md-lg) e barra
 * inferior (<md) mostram os MESMOS destinos na MESMA ordem: tres mapas
 * diferentes do mesmo app e o jeito mais barato de fazer a pessoa se perder ao
 * girar o celular.
 *
 * Virou hook porque os rotulos agora vem do dicionario: uma constante de modulo
 * seria montada uma vez, no idioma que estivesse valendo naquele instante, e
 * nunca mais mudaria.
 */
export function useItensNav(): readonly ItemNav[] {
  const t = useTextos();
  return ROTAS.map((rota) => ({ rota, rotulo: t.navegacao[rota], href: caminhoDa(rota) }));
}
