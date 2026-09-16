/**
 * Tabelas locais que so existem para a sincronizacao. Nao sao dominio: nunca sao
 * enviadas ao servidor e nunca aparecem na tela.
 */

/**
 * Fila do que ainda nao subiu. Existe porque `updatedAt` sozinho nao responde
 * "isso ja foi enviado?" — ele muda em toda escrita, inclusive nas que vieram do
 * proprio servidor. Sem a fila, o cliente reenviaria tudo a cada ciclo ou
 * perderia escrita feita durante um push em andamento.
 *
 * `updatedAtEnfileirado` guarda o carimbo do momento em que entrou na fila: ao
 * confirmar o envio, so sai da fila quem ainda estiver com o mesmo carimbo. Se o
 * usuario editou o registro enquanto a requisicao estava no ar, o carimbo mudou
 * e a pendencia permanece — senao a edicao feita no meio do voo sumiria.
 */
export interface Pendencia {
  /** Mesmo id da transacao. */
  id: string;
  updatedAtEnfileirado: string;
  enfileiradoEm: string;
}

/**
 * Marco do pull, guardado entre sessoes. O par (proximoDesde, proximoUltimoId) e
 * o cursor de keyset que o servidor devolve — precisa ser persistido inteiro,
 * porque so o carimbo perde linhas quando varias caem no mesmo milissegundo.
 */
export interface EstadoSincronizacao {
  /** Singleton: sempre 'estado'. */
  chave: string;
  proximoDesde: string | null;
  proximoUltimoId: string | null;
  ultimaSincronizacaoEm: string | null;
  /**
   * E-mail da conta a que os dados DESTE aparelho pertencem.
   *
   * Existe para o caso que o logout sozinho nao cobre: sessao vencida, ninguem
   * logado, e outra pessoa entra. Sem esta marca, o que sobrou na fila subiria
   * para a conta nova — o gasto de um caindo no extrato do outro. Na entrada, o
   * app compara: dono diferente, banco local zerado antes de sincronizar.
   *
   * `null` em duas situacoes legitimas: aparelho que nunca entrou em conta
   * nenhuma, e quem usou "sem conta" e depois criou a dele. Nos dois casos os
   * dados locais sao de quem esta entrando, e nada e apagado.
   */
  dono?: string | null;
}

/**
 * Sessao do usuario. Fica no IndexedDB e nao no localStorage por consistencia com
 * a regra do projeto — mas sem ilusao: as duas sao igualmente alcancaveis por XSS.
 * O que protege o token e ele ser curto e renovavel, nao onde esta guardado.
 */
export interface Sessao {
  /** Singleton: sempre 'atual'. */
  chave: string;
  token: string;
  expiraEm: string;
  email: string;
  /**
   * Nome de exibicao, para a UI nao mostrar e-mail.
   *
   * Opcional E anulavel: ausente nas sessoes gravadas antes deste campo existir,
   * nulo nas contas criadas antes da coluna existir no servidor. Quem le cai para
   * o e-mail nos dois casos.
   */
  nome?: string | null;
  /**
   * "Manter conectado". `false` = a sessao vale ate o navegador fechar; ela
   * continua gravada aqui (nao ha onde mais guardar), mas e descartada na
   * proxima abertura. Ausente em registro antigo conta como `true`: quem ja
   * estava logado nao pode ser deslogado por causa de um campo novo.
   */
  persistente?: boolean;
}

export const CHAVE_ESTADO = 'estado';
export const CHAVE_SESSAO = 'atual';
