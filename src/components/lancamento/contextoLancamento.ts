import { createContext } from 'react';
import type { DataISO } from '../../types';

export interface ControleDeLancamento {
  /** Abre a folha de lancamento. Sem parametro: quem tem contexto e a tela. */
  readonly abrir: () => void;
  /**
   * Em que dia a folha deve abrir enquanto esta tela estiver na frente.
   *
   * A tela que tem um dia em foco — o calendario com o 15 selecionado — anuncia
   * esse dia aqui, e a folha nasce nele em vez de em "hoje". Vai pelo contexto
   * porque os tres gatilhos (sidebar, barra e FAB) moram FORA da tela que sabe
   * qual dia esta selecionado: passar por prop pediria fio do dashboard ate o
   * topo da arvore e de volta.
   *
   * `null` desfaz a sugestao e devolve a folha para hoje.
   */
  readonly definirDataSugerida: (data: DataISO | null) => void;
}

/**
 * O gatilho e o container moram em ramos diferentes da arvore: o botao rotulado
 * fica dentro da sidebar (>=lg) ou da barra superior (md-lg), DOM de outro
 * componente, enquanto a folha/modal precisa nascer no topo. O contexto e o
 * unico fio entre os dois.
 *
 * null = fora do ProvedorLancamento; useAbrirLancamento transforma isso em erro.
 */
export const ContextoLancamento = createContext<ControleDeLancamento | null>(null);
