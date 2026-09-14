import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { entrarNoServidor, registrarNoServidor } from '../api/cliente';
import { definirModoLocal } from '../api/modoLocal';
import type { FalhaApi } from '../api/erros';
import { ehErroApi } from '../api/erros';
import { lerSessao, limparSessao, salvarSessaoDeLogin, sessaoExpirada } from '../api/sessao';
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

export interface EstadoDaSessao {
  /** Sessao valida, ou null. Vencida nunca chega aqui. */
  sessao: Sessao | null;
  /** Primeira leitura do IndexedDB ainda em voo. */
  carregando: boolean;
  autenticado: boolean;
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<ResultadoDeConta>;
  registrar: (email: string, senha: string, manterConectado: boolean) => Promise<ResultadoDeConta>;
  sair: () => Promise<void>;
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
      chamar: (email: string, senha: string) => Promise<{ token: string; expiraEm: string }>,
      email: string,
      senha: string,
      manterConectado: boolean,
    ): Promise<ResultadoDeConta> => {
      try {
        const resposta = await chamar(email, senha);
        await salvarSessaoDeLogin({
          token: resposta.token,
          expiraEm: resposta.expiraEm,
          email,
          persistente: manterConectado,
        });
        // Entrou: o "usar sem conta" deixa de fazer sentido e sai do caminho.
        // Mante-lo ligado manteria o portao aberto depois de um logout futuro,
        // que e exatamente o contrario do que a pessoa escolheu ao entrar.
        definirModoLocal(false);
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
      autenticar(entrarNoServidor, email, senha, manterConectado),
    [autenticar],
  );

  const registrar = useCallback(
    (email: string, senha: string, manterConectado: boolean) =>
      autenticar(registrarNoServidor, email, senha, manterConectado),
    [autenticar],
  );

  const sair = useCallback(async (): Promise<void> => {
    await limparSessao();
  }, []);

  return { sessao, carregando, autenticado: sessao !== null, entrar, registrar, sair };
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
