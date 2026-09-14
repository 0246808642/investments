import { createContext } from 'react';

/** Por que a folha de conta abriu. Muda a frase do topo, nada mais. */
export type MotivoDaConta = 'menu' | 'lancamento';

export type AbrirConta = (motivo?: MotivoDaConta) => void;

/**
 * Mesmo arranjo dos outros provedores: o gatilho para abrir a conta aparece na
 * sidebar, na barra superior E no caminho de quem tentou lancar deslogado —
 * ramos distantes da arvore — enquanto a folha precisa nascer no topo.
 *
 * null = fora do ProvedorConta; useAbrirConta transforma isso em erro.
 */
export const ContextoConta = createContext<AbrirConta | null>(null);
