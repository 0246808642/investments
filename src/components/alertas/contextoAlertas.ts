import { createContext } from 'react';

/**
 * Mesmo arranjo do lancamento: o gatilho para configurar limite aparece em tres
 * lugares distantes na arvore (a faixa de saldo, a barra do aviso e o botao da
 * sidebar) enquanto a folha precisa nascer no topo. O contexto carrega so a
 * funcao de abrir.
 *
 * null = fora do ProvedorAlertas; useAbrirAlertas transforma isso em erro.
 */
export const ContextoAlertas = createContext<(() => void) | null>(null);
