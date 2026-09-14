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
  const gatilho = useRef<HTMLElement | null>(null);

  const guardarGatilho = useCallback((): void => {
    const ativo = document.activeElement;
    gatilho.current = ativo instanceof HTMLElement ? ativo : null;
  }, []);

  const abrir = useCallback(
    (novoMotivo: MotivoDaConta = 'menu'): void => {
      guardarGatilho();
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
      {motivo === null ? null : <FolhaDeConta aoFechar={fechar} motivo={motivo} />}
    </ContextoConta.Provider>
  );
}
