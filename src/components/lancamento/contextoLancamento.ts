import { createContext } from 'react';

/**
 * O gatilho e o container moram em ramos diferentes da arvore: o botao rotulado
 * fica dentro da sidebar (>=lg) ou da barra superior (md-lg), DOM de outro
 * componente, enquanto a folha/modal precisa nascer no topo. O contexto e o
 * unico fio entre os dois — carrega so a funcao de abrir.
 *
 * null = fora do ProvedorLancamento; useAbrirLancamento transforma isso em erro.
 */
export const ContextoLancamento = createContext<(() => void) | null>(null);
