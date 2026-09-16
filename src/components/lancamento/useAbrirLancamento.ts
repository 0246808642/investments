import { useContext, useEffect } from 'react';
import { ContextoLancamento } from './contextoLancamento';
import type { ControleDeLancamento } from './contextoLancamento';
import type { DataISO } from '../../types';

function useControle(): ControleDeLancamento {
  const controle = useContext(ContextoLancamento);
  if (controle === null) {
    throw new Error('useAbrirLancamento precisa estar dentro de <ProvedorLancamento>.');
  }
  return controle;
}

/**
 * Abre o formulario de lancamento de qualquer lugar da arvore, desde que
 * abaixo de <ProvedorLancamento>. Retorna a funcao estavel (useCallback no
 * provedor), entao pode ir direto para onClick sem gerar re-render.
 */
export function useAbrirLancamento(): () => void {
  return useControle().abrir;
}

/**
 * Diz em que dia a folha deve abrir enquanto esta tela estiver montada.
 *
 * Existe para o calendario: com o dia 15 selecionado, lancar ali e continuar o
 * mesmo gesto — escolher a data de novo, no formulario, e responder duas vezes a
 * pergunta que ja foi respondida no clique. A folha continua com os chips de
 * hoje/ontem e o seletor de data, entao trocar segue sendo um toque.
 *
 * Desfaz sozinha ao desmontar: a sugestao pertence a tela que a fez, e deixa-la
 * valendo depois de sair dali faria o FAB de outra pagina abrir numa data que
 * ninguem escolheu.
 */
export function useDataSugerida(data: DataISO | null): void {
  const { definirDataSugerida } = useControle();

  useEffect(() => {
    definirDataSugerida(data);
    return () => {
      definirDataSugerida(null);
    };
  }, [data, definirDataSugerida]);
}
