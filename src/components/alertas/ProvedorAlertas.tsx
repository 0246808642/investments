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
  // Quem abriu: ao fechar, o foco volta para la em vez de cair no <body>.
  const gatilho = useRef<HTMLElement | null>(null);

  const abrir = useCallback((): void => {
    const ativo = document.activeElement;
    gatilho.current = ativo instanceof HTMLElement ? ativo : null;
    setAbertura((n) => n + 1);
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
      {aberta ? <FolhaAlertas key={abertura} aoFechar={fechar} /> : null}
    </ContextoAlertas.Provider>
  );
}
