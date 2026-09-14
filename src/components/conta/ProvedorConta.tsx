import { useCallback, useMemo, useRef, useState } from 'react';
import type * as React from 'react';

import { ContextoConta, type MotivoDaConta } from './contextoConta';
import { FolhaDeConta } from './FolhaDeConta';

export interface ProvedorContaProps {
  children: React.ReactNode;
}

/**
 * Mesmo desenho dos outros provedores. Fica por FORA de todos porque a conta e
 * a condicao dos demais: o gate de lancamento precisa poder abrir esta folha, e
 * um provedor nao alcanca quem esta acima dele.
 *
 * O `motivo` guarda por que a folha abriu — menu ou tentativa de lancar — para
 * a folha explicar o barramento em vez de aparecer sem contexto.
 */
export function ProvedorConta({ children }: ProvedorContaProps): React.JSX.Element {
  const [motivo, setMotivo] = useState<MotivoDaConta | null>(null);
  /*
   * Contador de aberturas, usado como `key` da folha.
   *
   * Fechar tem 200ms de animacao, e nesses 200ms a folha AINDA ESTA MONTADA. Se
   * alguem tocar no gatilho de novo nesse intervalo — dois toques por
   * impaciencia, que e o gesto mais comum depois de salvar — o `aberta` volta a
   * true antes de o desmonte acontecer, a folha nunca desmonta e o estado
   * interno dela sobrevive. Entre esse estado esta o cronometro de saida ja
   * disparado, que faz `fechar()` virar no-op: a folha fica presa na tela,
   * imune a Esc e ao botao de fechar, ate recarregar a pagina.
   *
   * Com a key mudando a cada abertura, reabrir SEMPRE monta uma instancia nova e
   * limpa. O bug deixa de depender de timing porque deixa de existir.
   */
  const [abertura, setAbertura] = useState(0);
  const gatilho = useRef<HTMLElement | null>(null);

  const guardarGatilho = useCallback((): void => {
    const ativo = document.activeElement;
    gatilho.current = ativo instanceof HTMLElement ? ativo : null;
  }, []);

  const abrir = useCallback(
    (novoMotivo: MotivoDaConta = 'menu'): void => {
      guardarGatilho();
      setAbertura((n) => n + 1);
      setMotivo(novoMotivo);
    },
    [guardarGatilho],
  );

  const fechar = useCallback((): void => {
    setMotivo(null);
    const alvo = gatilho.current;
    gatilho.current = null;
    if (alvo !== null && alvo.isConnected) {
      alvo.focus();
    }
  }, []);

  const valor = useMemo(() => abrir, [abrir]);

  return (
    <ContextoConta.Provider value={valor}>
      {children}
      {motivo === null ? null : (
        <FolhaDeConta key={abertura} aoFechar={fechar} motivo={motivo} />
      )}
    </ContextoConta.Provider>
  );
}
