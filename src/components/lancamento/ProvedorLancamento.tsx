import { useCallback, useMemo, useRef, useState } from 'react';
import { useModoLocal } from '../../api/modoLocal';
import { useSessao } from '../../hooks/useSessao';
import { useAbrirConta } from '../conta';
import { ContextoLancamento } from './contextoLancamento';
import type { ControleDeLancamento } from './contextoLancamento';
import type { DataISO } from '../../types';
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
 *
 * PORTAO DE SESSAO: sem conta, `abrir` nao abre o lancamento — abre a folha de
 * conta explicando o motivo. O desvio mora aqui, e nao em cada botao, porque sao
 * tres gatilhos (sidebar, barra e FAB) mais os dois convites de tela vazia: a
 * regra escrita cinco vezes e a regra que um dia vale em quatro lugares.
 *
 * Enquanto a sessao ainda esta sendo lida do IndexedDB, o clique NAO e barrado —
 * ele segue para o lancamento. Barrar por causa de um estado que ainda nao se
 * conhece mandaria para o login quem ja esta logado.
 *
 * Quem escolheu "usar sem conta" tambem passa: o app e offline-first, e exigir
 * servidor para escrever no banco do proprio aparelho contradiz a premissa.
 */
export function ProvedorLancamento({ children }: ProvedorLancamentoProps): React.JSX.Element {
  const { autenticado, carregando } = useSessao();
  const semConta = useModoLocal();
  const abrirConta = useAbrirConta();

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
  // Quem abriu. No desktop o foco tem que voltar para la ao fechar, senao ele
  // cai no <body> e o proximo Tab recomeca do topo da pagina.
  const gatilho = useRef<HTMLElement | null>(null);
  /*
   * Dia que a tela da frente sugere (o calendario, com um dia selecionado).
   *
   * Em ref e nao em estado: quem escreve e o dashboard a cada troca de dia, e
   * quem le e o `abrir`, no clique. Guardar em estado re-renderizaria o app
   * inteiro a cada clique no calendario — e nada na tela depende deste valor
   * enquanto a folha nao abre.
   */
  const dataSugerida = useRef<DataISO | null>(null);
  const [dataDaFolha, setDataDaFolha] = useState<DataISO | null>(null);

  const definirDataSugerida = useCallback((data: DataISO | null): void => {
    dataSugerida.current = data;
  }, []);

  const abrir = useCallback((): void => {
    const ativo = document.activeElement;
    gatilho.current = ativo instanceof HTMLElement ? ativo : null;

    if (!autenticado && !carregando && !semConta) {
      abrirConta('lancamento');
      return;
    }
    // A data e congelada NA ABERTURA: se a pessoa trocar o dia do calendario
    // com a folha aberta, o formulario que ela esta preenchendo nao muda de data
    // por baixo dela.
    setDataDaFolha(dataSugerida.current);
    setAbertura((n) => n + 1);
    setAberta(true);
  }, [autenticado, carregando, semConta, abrirConta]);

  const fechar = useCallback((): void => {
    setAberta(false);
    const alvo = gatilho.current;
    gatilho.current = null;
    if (alvo !== null && alvo.isConnected) {
      alvo.focus();
    }
  }, []);

  // As duas funcoes sao estaveis, entao o valor do contexto nunca muda: abrir e
  // fechar a folha nao re-renderiza a arvore inteira do app.
  const valor = useMemo<ControleDeLancamento>(
    () => ({ abrir, definirDataSugerida }),
    [abrir, definirDataSugerida],
  );

  return (
    <ContextoLancamento.Provider value={valor}>
      {children}
      <BotaoFlutuante aoTocar={abrir} />
      {aberta ? (
        <FolhaLancamento
          key={abertura}
          aoFechar={fechar}
          {...(dataDaFolha === null ? {} : { dataInicial: dataDaFolha })}
        />
      ) : null}
    </ContextoLancamento.Provider>
  );
}
