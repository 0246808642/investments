import { useCallback, useMemo, useRef, useState } from 'react';
import { ContextoLancamento } from './contextoLancamento';
import { BotaoFlutuante } from './BotaoFlutuante';
import { FolhaLancamento } from './FolhaLancamento';

export interface ProvedorLancamentoProps {
  children: React.ReactNode;
}

/**
 * Envolve o app: renderiza children, o FAB (so <md) e a folha/modal quando
 * aberta. O aberto/fechado mora aqui em vez de dentro do botao porque no
 * desktop o gatilho esta na sidebar ou na barra superior — outro ramo do DOM.
 *
 * A folha continua montando so quando aberta: cada lancamento nasce limpo e o
 * autofoco acontece dentro do gesto do usuario, que e o que o iOS exige para
 * subir o teclado.
 */
export function ProvedorLancamento({ children }: ProvedorLancamentoProps): React.JSX.Element {
  const [aberta, setAberta] = useState(false);
  // Quem abriu. No desktop o foco tem que voltar para la ao fechar, senao ele
  // cai no <body> e o proximo Tab recomeca do topo da pagina.
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

  // O contexto carrega so `abrir`, e `abrir` e estavel: o valor nunca muda,
  // entao abrir/fechar a folha nao re-renderiza a arvore inteira do app.
  const valor = useMemo(() => abrir, [abrir]);

  return (
    <ContextoLancamento.Provider value={valor}>
      {children}
      <BotaoFlutuante aoTocar={abrir} />
      {aberta ? <FolhaLancamento aoFechar={fechar} /> : null}
    </ContextoLancamento.Provider>
  );
}
