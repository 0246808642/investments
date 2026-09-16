/**
 * O ciclo de sincronizacao: e quem faz o lancamento sair deste aparelho.
 *
 * Todas as pecas ja existiam — a fila de pendencias (`db/consultas.ts`), o
 * cursor do pull, o contrato de fio e o endpoint que faz push e pull na mesma
 * chamada. O que faltava era alguem CHAMAR: sem este modulo, `criarTransacao`
 * gravava no IndexedDB, enfileirava, e a fila crescia para sempre. O dado
 * existia no navegador e em lugar nenhum alem dele — trocar de aparelho, limpar
 * o site ou reinstalar o app apagava tudo.
 *
 * Um ciclo e: manda o lote pendente, recebe o que mudou no servidor desde o
 * ultimo marco, aplica, tira da fila o que foi confirmado e guarda o marco novo.
 * Repete enquanto houver trabalho — fila cheia ou pagina de pull cheia.
 *
 * Nada aqui lanca para quem chamou. Sincronizacao acontece em segundo plano, em
 * cima de uma rede que cai: falha vira estado (`situacao: 'falhou'`), o proximo
 * gatilho tenta de novo e o lancamento continua no banco local o tempo todo.
 */
import { sincronizarNoServidor } from './cliente';
import { paraTransacao, paraTransacaoFio } from './contratos';
import type { FalhaApi } from './erros';
import { ehErroApi, vaiAdiantarRepetir } from './erros';
import { lerSessaoValida } from './sessao';
import { db } from '../db/db';
import {
  aplicarTransacaoRemota,
  confirmarEnvio,
  contarPendentes,
  lerEstadoSincronizacao,
  listarPendentes,
  salvarEstadoSincronizacao,
} from '../db/consultas';

/**
 * Tamanho do lote, nos dois sentidos. O servidor aceita ate 1000 (LimiteMaximo
 * em `SincronizarTransacoes.cs`); 200 e menor de proposito — num celular em rede
 * ruim, o lote que cabe numa requisicao curta chega, e o que nao coube vem no
 * passo seguinte do mesmo ciclo.
 */
const LOTE = 200;

/**
 * Teto de passos por ciclo. Cada passo progride (ou a fila encolhe, ou o cursor
 * anda), entao o teto e cinto de seguranca contra um servidor que responda
 * `temMais: true` para sempre — nao o limite esperado de um ciclo normal.
 */
const MAXIMO_DE_PASSOS = 25;

/** Espera depois de uma escrita, para o lancamento seguinte entrar no mesmo lote. */
const ATRASO_APOS_ESCRITA_MS = 1_500;

/** Ritmo do ciclo de fundo enquanto o app esta na frente. */
const INTERVALO_MS = 5 * 60 * 1000;

/** Primeira espera depois de uma falha que vale repetir; dobra ate o teto. */
const RECUO_INICIAL_MS = 15_000;
const RECUO_MAXIMO_MS = 5 * 60 * 1000;

export type SituacaoSincronizacao = 'ocioso' | 'sincronizando' | 'falhou';

export interface EstadoDoSincronizador {
  readonly situacao: SituacaoSincronizacao;
  /**
   * O que derrubou o ultimo ciclo, como TIPO e nao como frase: quem desenha a
   * tela e que sabe em que idioma dizer, e "sem conexao" nao se traduz a partir
   * de uma mensagem que veio do servidor em portugues.
   */
  readonly falha: FalhaApi['tipo'] | null;
}

/* ------------------------------------------------------------------ *
 * Store de modulo (mesma forma de `modoLocal.ts`)
 * ------------------------------------------------------------------ */

let estado: EstadoDoSincronizador = { situacao: 'ocioso', falha: null };
const ouvintes = new Set<() => void>();

export function inscreverNoSincronizador(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerEstadoDoSincronizador(): EstadoDoSincronizador {
  return estado;
}

function publicar(novo: EstadoDoSincronizador): void {
  estado = novo;
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

/* ------------------------------------------------------------------ *
 * O ciclo
 * ------------------------------------------------------------------ */

/**
 * Um passo: manda o que tem, recebe o que mudou, confirma e guarda o marco.
 * Devolve `true` quando sobrou trabalho conhecido para o passo seguinte.
 */
async function umPasso(): Promise<boolean> {
  const pendentes = await listarPendentes(LOTE);
  const marco = await lerEstadoSincronizacao();

  const resposta = await sincronizarNoServidor({
    transacoes: pendentes.map(paraTransacaoFio),
    desde: marco.proximoDesde,
    ultimoId: marco.proximoUltimoId,
    limite: LOTE,
  });

  // Pull primeiro: aplicar antes de confirmar o push nao muda o resultado (o
  // last-write-wins e o mesmo nos dois lados), e deixa o banco local no estado
  // novo mesmo se a aba morrer no meio do que vem depois.
  for (const fio of resposta.transacoes) {
    const transacao = paraTransacao(fio);
    if (transacao === null) {
      // Linha fora do contrato nao pode travar o lote: o cursor avanca sem ela e
      // o ciclo segue. Sem isso, um registro torto no servidor pararia a
      // sincronizacao deste aparelho para sempre.
      console.warn(`Sincronizacao: transacao ${fio.id} veio fora do contrato e foi ignorada.`);
      continue;
    }
    await aplicarTransacaoRemota(transacao);
  }

  for (const resultado of resposta.resultados) {
    if (resultado.situacao === 'rejeitada') {
      console.warn(
        `Sincronizacao: o servidor recusou ${resultado.id}: ${resultado.motivo ?? 'sem motivo'}`,
      );
    }
  }

  /*
   * Sai da fila TUDO que voltou no lote, inclusive o rejeitado.
   *
   * Rejeicao vem de delta malformado ou invariante ferida — reenviar o mesmo
   * corpo da a mesma recusa, e mante-lo na fila faria todo ciclo carregar a
   * mesma linha envenenada para sempre. O `confirmarEnvio` ainda protege o caso
   * que importa: se a pessoa editou o registro enquanto a requisicao estava no
   * ar, o carimbo mudou e ele CONTINUA pendente — a versao nova ainda vai subir.
   */
  const removidas = await confirmarEnvio(resposta.resultados.map((resultado) => resultado.id));

  await salvarEstadoSincronizacao({
    proximoDesde: resposta.proximoDesde,
    proximoUltimoId: resposta.proximoUltimoId,
    ultimaSincronizacaoEm: resposta.servidorEm,
  });

  if (resposta.temMais) {
    return true;
  }
  // So continua por causa da fila quando ela ANDOU: sem isso, uma pendencia que
  // nao sai (carimbo sempre mudando) giraria o ciclo ate o teto de passos.
  return removidas > 0 && (await contarPendentes()) > 0;
}

let emVoo: Promise<void> | null = null;
let recuo = RECUO_INICIAL_MS;

async function executarCiclo(): Promise<void> {
  // Sem sessao valida nao ha para onde mandar: modo local, deslogado ou token
  // vencido. A fila espera — e exatamente para isso que ela existe.
  const sessao = await lerSessaoValida();
  if (sessao === null) {
    publicar({ situacao: 'ocioso', falha: null });
    return;
  }

  publicar({ situacao: 'sincronizando', falha: null });

  try {
    for (let passo = 0; passo < MAXIMO_DE_PASSOS; passo += 1) {
      if (!(await umPasso())) {
        break;
      }
    }
    recuo = RECUO_INICIAL_MS;
    publicar({ situacao: 'ocioso', falha: null });
  } catch (erro) {
    const falha: FalhaApi = ehErroApi(erro)
      ? erro.falha
      : { tipo: 'respostaInvalida', mensagem: 'Falha inesperada na sincronizacao.' };

    publicar({ situacao: 'falhou', falha: falha.tipo });

    if (!ehErroApi(erro)) {
      // Erro que nao e do contrato do cliente: aparece no console, porque nao
      // ter rastro dele deixaria uma sincronizacao quebrada em silencio.
      console.error('Sincronizacao: falha inesperada.', erro);
      return;
    }

    if (vaiAdiantarRepetir(falha)) {
      agendarSincronizacao(recuo);
      recuo = Math.min(recuo * 2, RECUO_MAXIMO_MS);
    }
  }
}

/**
 * Roda um ciclo. Chamada concorrente PEGA CARONA no ciclo em andamento em vez de
 * abrir outro: dois ciclos ao mesmo tempo mandariam o mesmo lote duas vezes e
 * avancariam o cursor por cima um do outro.
 */
export function sincronizarAgora(): Promise<void> {
  emVoo ??= executarCiclo().finally(() => {
    emVoo = null;
  });
  return emVoo;
}

let agendado: number | null = null;

/**
 * Marca um ciclo para daqui a pouco. Reagendar nao empilha: o timer pendente e
 * substituido, entao dez lancamentos seguidos viram um ciclo so — com os dez no
 * mesmo lote.
 */
export function agendarSincronizacao(atrasoMs: number = ATRASO_APOS_ESCRITA_MS): void {
  if (agendado !== null) {
    window.clearTimeout(agendado);
  }
  agendado = window.setTimeout(() => {
    agendado = null;
    void sincronizarAgora();
  }, atrasoMs);
}

/* ------------------------------------------------------------------ *
 * Gatilhos
 * ------------------------------------------------------------------ */

let iniciado = false;

/**
 * Liga os gatilhos. Chamado uma vez, na abertura do app.
 *
 * Sao cinco, e cada um cobre um buraco dos outros:
 *
 *  - escrita local: o lancamento sobe sem a pessoa pedir, poucos segundos depois
 *    de salvar. E o gatilho que faz o app parecer "salvar na nuvem".
 *  - abertura: puxa o que os outros aparelhos gravaram enquanto este estava
 *    fechado.
 *  - volta ao primeiro plano: num PWA de celular, "abrir" acontece uma vez e o
 *    app passa semanas em segundo plano. Sem isto, so a primeira abertura
 *    sincronizaria.
 *  - voltou a rede: o que ficou na fila durante o tunel sobe assim que da.
 *  - intervalo: o caso do app aberto e parado numa aba do desktop enquanto outro
 *    aparelho lanca.
 */
export function iniciarSincronizacaoAutomatica(): void {
  if (iniciado) {
    return;
  }
  iniciado = true;

  /*
   * O gancho fica na tabela de PENDENCIAS, e nao em transacoes: pendencia so
   * nasce de escrita que precisa subir. Escrita vinda do servidor (o pull, via
   * `aplicarTransacaoRemota`) nao enfileira nada — entao aplicar o que chegou
   * nao dispara outro ciclo, e o app nao fica conversando consigo mesmo.
   */
  db.pendencias.hook('creating', () => {
    agendarSincronizacao();
  });
  db.pendencias.hook('updating', () => {
    agendarSincronizacao();
  });

  window.addEventListener('online', () => {
    void sincronizarAgora();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void sincronizarAgora();
    }
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void sincronizarAgora();
    }
  }, INTERVALO_MS);

  void sincronizarAgora();
}
