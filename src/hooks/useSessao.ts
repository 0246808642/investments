import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import {
  alterarNomeNoServidor,
  alterarSenhaNoServidor,
  entrarNoServidor,
  registrarNoServidor,
} from '../api/cliente';
import { definirModoLocal } from '../api/modoLocal';
import type { FalhaApi } from '../api/erros';
import { ehErroApi } from '../api/erros';
import { lerSessao, limparSessao, salvarSessao, salvarSessaoDeLogin, sessaoExpirada } from '../api/sessao';
import { sincronizarAgora } from '../api/sincronizador';
import { contarPendentes } from '../db/consultas';
import { assumirDonoDosDados, limparDadosDoAparelho } from '../db/limpeza';
import type { Sessao } from '../db/sincronizacao';
import type { Textos } from '../i18n';
import { textosDe, idiomaAtual } from '../i18n';

/**
 * Resultado de entrar/registrar. Uniao fechada, e nao excecao: senha errada e
 * servidor fora do ar sao respostas previstas do fluxo de login, nao acidentes —
 * e a tela tem que mostrar as duas do mesmo jeito, numa lista de erros.
 *
 * Erro NAO previsto continua subindo como excecao: se a falha nao esta no
 * contrato, engoli-la aqui viraria "não foi possível" para sempre, sem rastro.
 */
export type ResultadoDeConta = { readonly ok: true } | { readonly ok: false; readonly erros: readonly string[] };

/**
 * Saida da conta. `ok: false` nao e erro: e a pergunta que falta responder —
 * sobrou coisa na fila, e sair agora apaga. Quem chama decide se insiste.
 */
export type ResultadoDeSaida =
  | { readonly ok: true }
  | { readonly ok: false; readonly pendentes: number };

export interface EstadoDaSessao {
  /** Sessao valida, ou null. Vencida nunca chega aqui. */
  sessao: Sessao | null;
  /** Primeira leitura do IndexedDB ainda em voo. */
  carregando: boolean;
  autenticado: boolean;
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<ResultadoDeConta>;
  registrar: (
    email: string,
    senha: string,
    nome: string,
    manterConectado: boolean,
  ) => Promise<ResultadoDeConta>;
  /**
   * Sai e apaga os dados deste aparelho. Tenta subir o que falta antes; se algo
   * ficar para tras (sem rede, por exemplo), devolve `ok: false` em vez de
   * apagar calado. `descartarPendentes` e a confirmacao de quem ja viu o aviso.
   */
  /** Troca o nome de exibicao. A sessao guardada aqui ja sai com o nome novo. */
  alterarNome: (nome: string) => Promise<ResultadoDeConta>;
  /** Troca a senha. A atual e exigida — token valido nao substitui saber a senha. */
  alterarSenha: (senhaAtual: string, senhaNova: string) => Promise<ResultadoDeConta>;
  sair: (descartarPendentes?: boolean) => Promise<ResultadoDeSaida>;
}

/**
 * A sessao do app.
 *
 * Mora no IndexedDB e e lida por `useLiveQuery`, entao entrar num canto da tela
 * atualiza todo mundo que depende disso — sidebar, gate de lancamento, folha de
 * conta — sem provedor de contexto e sem passar callback de mao em mao.
 *
 * A leitura e CRUA de proposito. `lerSessaoValida()` apaga o registro vencido, e
 * consulta que escreve dentro de um useLiveQuery dispara uma nova leitura por
 * causa da propria escrita; o vencimento e avaliado aqui e a limpeza acontece num
 * efeito, que e o lugar de efeito.
 */
export function useSessao(): EstadoDaSessao {
  const guardada = useLiveQuery(() => lerSessao(), []);

  const carregando = guardada === undefined;
  const vencida = guardada != null && sessaoExpirada(guardada);
  const sessao = guardada != null && !vencida ? guardada : null;

  useEffect(() => {
    if (vencida) {
      void limparSessao();
    }
  }, [vencida]);

  const autenticar = useCallback(
    async (
      // Thunk em vez de (email, senha): registro manda um campo a mais, e alargar
      // a assinatura para caber os dois deixaria o login com um parametro que ele
      // ignora. Quem chama ja fecha sobre o que precisa enviar.
      chamar: () => Promise<{ token: string; expiraEm: string; nome: string | null }>,
      email: string,
      manterConectado: boolean,
    ): Promise<ResultadoDeConta> => {
      try {
        const resposta = await chamar();
        await salvarSessaoDeLogin({
          token: resposta.token,
          expiraEm: resposta.expiraEm,
          email,
          nome: resposta.nome,
          persistente: manterConectado,
        });
        // Entrou: o "usar sem conta" deixa de fazer sentido e sai do caminho.
        // Mante-lo ligado manteria o portao aberto depois de um logout futuro,
        // que e exatamente o contrario do que a pessoa escolheu ao entrar.
        definirModoLocal(false);
        // Antes de qualquer sincronizacao: se o que esta guardado aqui e de
        // outra conta, ele sai agora — senao a fila da pessoa anterior subiria
        // para esta conta no ciclo logo abaixo.
        await assumirDonoDosDados(email);
        // Entrar e o momento em que passa a haver para onde mandar: o que estava
        // na fila sobe agora, e o que ja existia na conta desce. Sem isto, um
        // aparelho novo mostraria a conta vazia ate a proxima escrita local.
        void sincronizarAgora();
        return { ok: true };
      } catch (erro) {
        if (!ehErroApi(erro)) {
          throw erro;
        }
        return { ok: false, erros: mensagensDe(erro.falha, textosDe(idiomaAtual())) };
      }
    },
    [],
  );

  const entrar = useCallback(
    (email: string, senha: string, manterConectado: boolean) =>
      autenticar(() => entrarNoServidor(email, senha), email, manterConectado),
    [autenticar],
  );

  const registrar = useCallback(
    (email: string, senha: string, nome: string, manterConectado: boolean) =>
      autenticar(() => registrarNoServidor(email, senha, nome), email, manterConectado),
    [autenticar],
  );

  /**
   * Regrava a sessao com o que o servidor devolveu.
   *
   * O e-mail e o "manter conectado" vem do registro atual, e nao da resposta: o
   * servidor nao tem opiniao sobre eles. Reescrever `persistente` com um padrao
   * aqui transformaria "so nesta janela" em "para sempre" por causa de uma troca
   * de nome — o mesmo cuidado que a renovacao ja toma.
   */
  const guardarSessaoAtualizada = useCallback(
    async (resposta: { token: string; expiraEm: string; nome: string | null }): Promise<void> => {
      const atual = await lerSessao();
      if (atual === null) {
        return;
      }
      await salvarSessao({
        token: resposta.token,
        expiraEm: resposta.expiraEm,
        email: atual.email,
        nome: resposta.nome,
        persistente: atual.persistente ?? true,
      });
    },
    [],
  );

  /** Mesma forma de entrar/registrar: erro previsto vira lista de mensagens. */
  const alterar = useCallback(
    async (
      chamar: () => Promise<{ token: string; expiraEm: string; nome: string | null }>,
    ): Promise<ResultadoDeConta> => {
      try {
        await guardarSessaoAtualizada(await chamar());
        return { ok: true };
      } catch (erro) {
        if (!ehErroApi(erro)) {
          throw erro;
        }
        return { ok: false, erros: mensagensDe(erro.falha, textosDe(idiomaAtual())) };
      }
    },
    [guardarSessaoAtualizada],
  );

  const alterarNome = useCallback(
    (nome: string) => alterar(() => alterarNomeNoServidor(nome)),
    [alterar],
  );

  const alterarSenha = useCallback(
    (senhaAtual: string, senhaNova: string) =>
      alterar(() => alterarSenhaNoServidor(senhaAtual, senhaNova)),
    [alterar],
  );

  const sair = useCallback(async (descartarPendentes = false): Promise<ResultadoDeSaida> => {
    // Uma ultima tentativa de subir o que falta. Tambem serve de barreira: se um
    // ciclo ja estava no ar, esta chamada espera por ele em vez de abrir outro —
    // apagar o banco no meio de uma sincronizacao deixaria o cursor gravado
    // apontando para dados que nao existem mais.
    await sincronizarAgora();

    const pendentes = await contarPendentes();
    if (pendentes > 0 && !descartarPendentes) {
      return { ok: false, pendentes };
    }

    // Os dados primeiro, a sessao depois. Na ordem inversa, uma falha no meio
    // deixaria exatamente o estado que este fluxo existe para impedir: ninguem
    // logado e os lancamentos de quem saiu ainda no aparelho.
    await limparDadosDoAparelho();
    await limparSessao();
    return { ok: true };
  }, []);

  return {
    sessao,
    carregando,
    autenticado: sessao !== null,
    entrar,
    registrar,
    alterarNome,
    alterarSenha,
    sair,
  };
}

/**
 * Traduz a falha do cliente para o que a pessoa precisa ler.
 *
 * Os `detalhes` do backend vem primeiro quando existem — sao os erros de campo,
 * e mostrar todos evita o vaivem de corrigir um por vez. Sem detalhes, cada tipo
 * de falha ganha a frase que diz o que fazer a seguir, e nao o que aconteceu por
 * dentro: "senha incorreta" e acionavel, "401" nao e.
 */
function mensagensDe(falha: FalhaApi, t: Textos): readonly string[] {
  // Os detalhes vem do backend, que fala portugues: sao erros de validacao de
  // campo, e traduzi-los aqui exigiria adivinhar de qual regra cada frase veio.
  // O que o app controla — as quatro falhas de transporte — sai no idioma certo.
  if ('detalhes' in falha && falha.detalhes.length > 0) {
    return falha.detalhes;
  }

  switch (falha.tipo) {
    case 'rede':
      return [t.conta.erroRede];
    case 'naoAutorizado':
      return [t.conta.erroCredenciais];
    case 'servidor':
      return [t.conta.erroServidor];
    case 'respostaInvalida':
      return [t.conta.erroResposta];
    case 'requisicaoInvalida':
      return [falha.mensagem];
  }
}
