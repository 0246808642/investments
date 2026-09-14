import { useIdioma } from './idiomas';
import { textosDe, type Textos } from './textos';

/**
 * Os textos do idioma atual.
 *
 * Assina a loja de idioma, entao trocar o idioma re-renderiza quem usa este hook.
 * O <App> tambem assina, e e isso que faz a arvore inteira repintar — inclusive
 * o que so depende dos formatadores de data e dinheiro, que leem o idioma de um
 * modulo e nao teriam como avisar o React sozinhos.
 */
export function useTextos(): Textos {
  useIdioma();
  return textosDe(useIdioma());
}
