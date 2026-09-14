/**
 * Sessao persistida no IndexedDB (tabela `sessao`, singleton na chave 'atual').
 * Nada de localStorage — e regra do projeto, e o comentario do Day em
 * `src/db/sincronizacao.ts` explica que a troca nao e por seguranca: as duas sao
 * igualmente alcancaveis por XSS. O ganho e ter um lugar so de estado.
 */
import { db } from '../db/db';
import { CHAVE_SESSAO, type Sessao } from '../db/sincronizacao';

/**
 * Margem de folga antes do vencimento. Um token que expira em 3 segundos nao
 * sobrevive ao tempo de voo da requisicao: gastar a chamada para receber 401 e
 * pior do que ja tratar como expirado.
 */
const MARGEM_EXPIRACAO_MS = 30_000;

/** Le o registro cru, sem julgar validade. Devolve null quando nunca houve login. */
export async function lerSessao(): Promise<Sessao | null> {
  const sessao = await db.sessao.get(CHAVE_SESSAO);
  return sessao ?? null;
}

export async function salvarSessao(dados: Omit<Sessao, 'chave'>): Promise<void> {
  await db.sessao.put({ ...dados, chave: CHAVE_SESSAO });
}

export async function limparSessao(): Promise<void> {
  await db.sessao.delete(CHAVE_SESSAO);
}

/**
 * `expiraEm` ilegivel conta como expirado. O contrario — assumir valido o que
 * nao da para ler — deixaria o app tentando sincronizar para sempre com lixo no
 * cabecalho Authorization.
 */
export function sessaoExpirada(sessao: Sessao, agoraMs: number = Date.now()): boolean {
  const vencimento = Date.parse(sessao.expiraEm);
  if (Number.isNaN(vencimento)) {
    return true;
  }
  return vencimento - MARGEM_EXPIRACAO_MS <= agoraMs;
}

/**
 * Sessao utilizavel, ou null. Quando encontra uma vencida, apaga: manter o
 * registro faria a UI mostrar "logado" para um token que o servidor ja recusa.
 */
export async function lerSessaoValida(): Promise<Sessao | null> {
  const sessao = await lerSessao();
  if (sessao === null) {
    return null;
  }
  if (sessaoExpirada(sessao)) {
    await limparSessao();
    return null;
  }
  return sessao;
}

/**
 * Marca de "este navegador ainda nao fechou".
 *
 * `sessionStorage` e o unico armazenamento que o navegador limpa sozinho ao
 * fechar — e exatamente a semantica de "nao manter conectado". O token continua
 * no IndexedDB (nao ha outro lugar), mas sem esta marca ele e descartado na
 * proxima abertura.
 */
const MARCA_DE_JANELA = 'financeiro:janela';

function marcarJanela(): void {
  try {
    sessionStorage.setItem(MARCA_DE_JANELA, '1');
  } catch {
    // Armazenamento bloqueado: sem a marca, a sessao nao persistente cai na
    // proxima abertura. E o lado seguro do erro.
  }
}

function janelaMarcada(): boolean {
  try {
    return sessionStorage.getItem(MARCA_DE_JANELA) === '1';
  } catch {
    return false;
  }
}

/** Grava a sessao e, quando ela NAO e para manter, marca a janela atual. */
export async function salvarSessaoDeLogin(
  dados: Omit<Sessao, 'chave'> & { persistente: boolean },
): Promise<void> {
  if (!dados.persistente) {
    marcarJanela();
  }
  await salvarSessao(dados);
}

/**
 * Chamado uma vez na abertura do app, ANTES de qualquer tela ler a sessao.
 *
 * Descarta o token de quem nao pediu para ficar conectado e cujo navegador ja
 * fechou desde o login. Sessao antiga (sem o campo) e tratada como persistente.
 */
export async function descartarSessaoNaoPersistente(): Promise<void> {
  const sessao = await lerSessao();
  if (sessao === null) {
    return;
  }
  if (sessao.persistente === false && !janelaMarcada()) {
    await limparSessao();
    return;
  }
  if (sessao.persistente === false) {
    // Recarregar a pagina nao pode derrubar: a marca vale pela janela inteira.
    marcarJanela();
  }
}
