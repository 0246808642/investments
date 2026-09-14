import { useCallback, useMemo, useRef, useState } from 'react';
import { ContextoAlertas } from './contextoAlertas';
import { FolhaAlertas } from './FolhaAlertas';

export interface ProvedorAlertasProps {
  children: React.ReactNode;
}

/**
 * Mesmo desenho do ProvedorLancamento: o aberto/fechado mora aqui porque os
 * gatilhos estao espalhados (faixa de saldo, barra de aviso, sidebar) e a folha
 * precisa nascer no topo da arvore.
 *
 * A folha monta so quando aberta — assim ela le a configuracao atual toda vez
 * que abre, em vez de guardar um rascunho velho de uma abertura anterior.
 */
export function ProvedorAlertas({ children }: ProvedorAlertasProps): React.JSX.Element {
  const [aberta, setAberta] = useState(false);
  // Quem abriu: ao fechar, o foco volta para la em vez de cair no <body>.
  const gatilho = useRef<HTMLElement | null>(null);

  const abrir = useCallback((): void => {
    const ativo = document.activeElement;
    gatilho.current = ativo instanceof HTMLElement ? ativo : null;
    setAberta(true);
  }, []);

  const fechar = useCallback((): void => {
    setAberta(false);
    const alvo = gatilho.current;
    gatilho.current = null;
    if (alvo !== null && alvo.isConnected) {
      alvo.focus();
    }
  }, []);

  const valor = useMemo(() => abrir, [abrir]);

  return (
    <ContextoAlertas.Provider value={valor}>
      {children}
      {aberta ? <FolhaAlertas aoFechar={fechar} /> : null}
    </ContextoAlertas.Provider>
  );
}
