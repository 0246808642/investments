import { db } from './db';
import { CHAVE_ESTADO, type EstadoSincronizacao, type Pendencia } from './sincronizacao';
import type { Categoria, Centavos, DataISO, MesISO, Rascunho, Transacao } from '../types';
import { MAXIMO_DE_CATEGORIAS } from '../types';
import {
  agoraISO,
  ativo,
  centavos,
  dataISO,
  mesAnterior,
  mesDe,
  novoId,
  primeiroDiaDoMes,
  somarLista,
  subtrair,
  ultimoDiaDoMes,
  ZERO,
} from '../types';

/**
 * Toda leitura passa por aqui e toda leitura aplica ativo() — e o unico lugar
 * onde o filtro de soft delete precisa ser lembrado.
 */

/**
 * Ativas, favoritas primeiro e depois em ordem alfabetica.
 *
 * A ordenacao mora na consulta e nao em cada tela: a grade do lancamento, o
 * filtro do extrato e a lista de categorias tem que concordar sobre qual e a
 * primeira, senao marcar uma favorita muda a ordem num lugar so.
 */
export async function listarCategorias(): Promise<Categoria[]> {
  const categorias = await db.categorias.toArray();
  return categorias
    .filter(ativo)
    .sort(
      (a, b) =>
        Number(b.favorita) - Number(a.favorita) || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
}

/** Quantas categorias ATIVAS do tipo existem. Alimenta o teto de MAXIMO_DE_CATEGORIAS. */
export async function contarCategoriasDoTipo(tipo: Categoria['tipo']): Promise<number> {
  const categorias = await db.categorias.where('tipo').equals(tipo).toArray();
  return categorias.filter(ativo).length;
}

/** Transacoes do mes, mais recentes primeiro. */
export async function listarTransacoesDoMes(mes: MesISO): Promise<Transacao[]> {
  const transacoes = await db.transacoes
    .where('data')
    .between(primeiroDiaDoMes(mes), ultimoDiaDoMes(mes), true, true)
    .toArray();

  return transacoes
    .filter(ativo)
    .sort((a, b) => b.data.localeCompare(a.data) || b.updatedAt.localeCompare(a.updatedAt));
}

/** Coloca na fila de envio. Sempre na mesma transacao da escrita que a originou. */
async function enfileirar(transacao: Transacao): Promise<void> {
  const pendencia: Pendencia = {
    id: transacao.id,
    updatedAtEnfileirado: transacao.updatedAt,
    enfileiradoEm: agoraISO(),
  };
  await db.pendencias.put(pendencia);
}

export async function criarTransacao(rascunho: Rascunho<Transacao>): Promise<Transacao> {
  const transacao: Transacao = {
    ...rascunho,
    id: novoId(),
    updatedAt: agoraISO(),
    deletedAt: null,
  };
  // Gravar e enfileirar precisam ser atomicos: um lancamento gravado que nao
  // entrou na fila nunca sobe, e some quando o aparelho for trocado.
  await db.transaction('rw', db.transacoes, db.pendencias, async () => {
    await db.transacoes.add(transacao);
    await enfileirar(transacao);
  });
  return transacao;
}

export interface ResumoDoMes {
  entradas: Centavos;
  saidas: Centavos;
  saldo: Centavos;
}

export function resumirMes(transacoes: readonly Transacao[]): ResumoDoMes {
  const porTipo = (tipo: Transacao['tipo']): Centavos =>
    somarLista(transacoes.filter((t) => t.tipo === tipo).map((t) => t.valor));

  const entradas = porTipo('entrada');
  const saidas = porTipo('saida');
  return { entradas, saidas, saldo: subtrair(entradas, saidas) };
}

export const RESUMO_VAZIO: ResumoDoMes = { entradas: ZERO, saidas: ZERO, saldo: ZERO };

export function indexarPorId<T extends { id: string }>(registros: readonly T[]): Map<string, T> {
  return new Map(registros.map((registro) => [registro.id, registro]));
}

/* ------------------------------------------------------------------ *
 * Agregacoes do dashboard
 * ------------------------------------------------------------------ */

/**
 * Saldo de todas as transacoes ativas, sem recorte de mes. E o "saldo atual":
 * quanto sobrou desde o inicio, nao o resultado do mes corrente.
 */
export async function saldoAcumulado(): Promise<Centavos> {
  const transacoes = (await db.transacoes.toArray()).filter(ativo);
  const total = (tipo: Transacao['tipo']): Centavos =>
    somarLista(transacoes.filter((t) => t.tipo === tipo).map((t) => t.valor));
  return subtrair(total('entrada'), total('saida'));
}

export interface GastoPorCategoria {
  categoriaId: string;
  nome: string;
  /** Hex vindo da categoria; aplicado inline, o Tailwind nao gera classe dinamica. */
  cor: string;
  total: Centavos;
  /** Participacao no total de saidas do mes, 0..1. E proporcao, nao dinheiro — float aqui e correto. */
  fracao: number;
}

/** Saidas do mes agrupadas por categoria, da maior para a menor. */
export async function gastosPorCategoriaDoMes(mes: MesISO): Promise<GastoPorCategoria[]> {
  const [transacoes, categorias] = await Promise.all([
    listarTransacoesDoMes(mes),
    listarCategorias(),
  ]);
  const porId = indexarPorId(categorias);

  const totais = new Map<string, number>();
  for (const transacao of transacoes) {
    if (transacao.tipo !== 'saida') {
      continue;
    }
    totais.set(transacao.categoriaId, (totais.get(transacao.categoriaId) ?? 0) + transacao.valor);
  }

  const totalGeral = [...totais.values()].reduce((soma, valor) => soma + valor, 0);

  return [...totais.entries()]
    .map(([categoriaId, soma]) => {
      const categoria = porId.get(categoriaId);
      return {
        categoriaId,
        nome: categoria?.nome ?? 'Sem categoria',
        cor: categoria?.cor ?? '#94a3b8',
        total: centavos(soma),
        fracao: totalGeral === 0 ? 0 : soma / totalGeral,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface MovimentoDiario {
  data: DataISO;
  /** Dia do mes, 1..31. */
  dia: number;
  entradas: Centavos;
  saidas: Centavos;
  quantidade: number;
}

/**
 * Um item por dia do mes, inclusive os dias sem movimento — o calendario precisa
 * desenhar a grade inteira, nao so os dias que tiveram lancamento.
 */
export async function movimentoPorDiaDoMes(mes: MesISO): Promise<MovimentoDiario[]> {
  const transacoes = await listarTransacoesDoMes(mes);

  const agrupadas = new Map<string, Transacao[]>();
  for (const transacao of transacoes) {
    const doDia = agrupadas.get(transacao.data);
    if (doDia === undefined) {
      agrupadas.set(transacao.data, [transacao]);
    } else {
      doDia.push(transacao);
    }
  }

  const ultimoDia = Number(ultimoDiaDoMes(mes).slice(8, 10));
  const dias: MovimentoDiario[] = [];

  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const data = dataISO(`${mes}-${dia.toString().padStart(2, '0')}`);
    const doDia = agrupadas.get(data) ?? [];
    const total = (tipo: Transacao['tipo']): Centavos =>
      somarLista(doDia.filter((t) => t.tipo === tipo).map((t) => t.valor));

    dias.push({
      data,
      dia,
      entradas: total('entrada'),
      saidas: total('saida'),
      quantidade: doDia.length,
    });
  }

  return dias;
}

export interface MovimentoMensal {
  mes: MesISO;
  entradas: Centavos;
  saidas: Centavos;
  /** entradas − saidas DO MES. Nao confundir com saldoAcumulado(), que ignora o recorte. */
  resultado: Centavos;
}

/**
 * Janela de `quantidade` meses terminando em `mesFinal`, do mais antigo para o
 * mais novo.
 *
 * Mes sem lancamento entra ZERADO em vez de sumir da lista: a trilha desenha uma
 * barra por mes e, se um mes vazio fosse omitido, duas barras vizinhas mentiriam
 * sobre a distancia no tempo entre elas.
 */
export async function movimentoPorMes(
  mesFinal: MesISO,
  quantidade: number,
): Promise<MovimentoMensal[]> {
  const meses: MesISO[] = [];
  let cursor = mesFinal;
  for (let restantes = quantidade; restantes > 0; restantes -= 1) {
    meses.unshift(cursor);
    cursor = mesAnterior(cursor);
  }

  const primeiro = meses.at(0);
  if (primeiro === undefined) {
    return [];
  }

  // Uma varredura so para a janela inteira; agrupar em memoria custa menos que
  // `quantidade` idas ao IndexedDB.
  const transacoes = (
    await db.transacoes
      .where('data')
      .between(primeiroDiaDoMes(primeiro), ultimoDiaDoMes(mesFinal), true, true)
      .toArray()
  ).filter(ativo);

  const agrupadas = new Map<string, Transacao[]>();
  for (const transacao of transacoes) {
    const mes = mesDe(transacao.data);
    const doMes = agrupadas.get(mes);
    if (doMes === undefined) {
      agrupadas.set(mes, [transacao]);
    } else {
      doMes.push(transacao);
    }
  }

  return meses.map((mes) => {
    const resumo = resumirMes(agrupadas.get(mes) ?? []);
    return { mes, entradas: resumo.entradas, saidas: resumo.saidas, resultado: resumo.saldo };
  });
}

/* ------------------------------------------------------------------ *
 * Fila de envio e aplicacao de deltas remotos
 * ------------------------------------------------------------------ */

/**
 * Chave ordinal do conteudo. E o desempate quando dois aparelhos gravam no mesmo
 * milissegundo: nao existe "o certo", entao precisa existir "o mesmo em todo
 * lugar". Tem que casar exatamente com a do servidor, senao cliente e servidor
 * escolhem vencedores diferentes e divergem para sempre.
 */
function chaveOrdinal(t: Transacao): string {
  return [t.tipo, t.valor.toString(), t.data, t.categoriaId, t.contaId ?? '', t.descricao, t.deletedAt ?? ''].join('|');
}

/** Espelha AplicarAtualizacaoRemota do dominio C#. Ver Transacao.cs no backend. */
function remotaVence(local: Transacao, remota: Transacao): boolean {
  if (remota.updatedAt !== local.updatedAt) {
    return remota.updatedAt > local.updatedAt;
  }
  // Empate no carimbo. Exclusao vence atualizacao: no cliente nao existe desfazer
  // exclusao, entao aceitar a atualizacao ressuscitaria a linha em um aparelho e
  // nao no outro.
  const remotaExcluida = remota.deletedAt !== null;
  const localExcluida = local.deletedAt !== null;
  if (remotaExcluida !== localExcluida) {
    return remotaExcluida;
  }
  // Persistindo o empate: ordem total e arbitraria, igual em qualquer maquina.
  return chaveOrdinal(remota) > chaveOrdinal(local);
}

/**
 * Grava uma transacao vinda do servidor. NAO enfileira: ela ja esta la.
 * Leitura, decisao e escrita acontecem na mesma transacao do Dexie — fora dela,
 * uma escrita local no meio do caminho seria sobrescrita sem disputar o conflito.
 */
export async function aplicarTransacaoRemota(remota: Transacao): Promise<'aplicada' | 'descartada'> {
  return db.transaction('rw', db.transacoes, async () => {
    const local = await db.transacoes.get(remota.id);
    if (local !== undefined && !remotaVence(local, remota)) {
      return 'descartada';
    }
    await db.transacoes.put(remota);
    return 'aplicada';
  });
}

/** Transacoes que ainda nao subiram, mais antigas primeiro. */
export async function listarPendentes(limite: number): Promise<Transacao[]> {
  const pendencias = await db.pendencias.orderBy('enfileiradoEm').limit(limite).toArray();
  const ids = pendencias.map((p) => p.id);
  const transacoes = await db.transacoes.bulkGet(ids);
  return transacoes.filter((t): t is Transacao => t !== undefined);
}

export async function contarPendentes(): Promise<number> {
  return db.pendencias.count();
}

/**
 * Tira da fila o que o servidor confirmou — mas so se o registro nao mudou desde
 * que entrou nela. Se o usuario editou enquanto a requisicao estava no ar, o
 * carimbo mudou e a pendencia fica: aquela edicao ainda precisa subir.
 */
export async function confirmarEnvio(ids: readonly string[]): Promise<number> {
  return db.transaction('rw', db.pendencias, db.transacoes, async () => {
    let removidas = 0;
    for (const id of ids) {
      const pendencia = await db.pendencias.get(id);
      const transacao = await db.transacoes.get(id);
      if (pendencia === undefined) {
        continue;
      }
      if (transacao !== undefined && transacao.updatedAt !== pendencia.updatedAtEnfileirado) {
        continue; // mudou durante o voo: continua pendente
      }
      await db.pendencias.delete(id);
      removidas += 1;
    }
    return removidas;
  });
}

export async function lerEstadoSincronizacao(): Promise<EstadoSincronizacao> {
  const estado = await db.estadoSincronizacao.get(CHAVE_ESTADO);
  return estado ?? { chave: CHAVE_ESTADO, proximoDesde: null, proximoUltimoId: null, ultimaSincronizacaoEm: null };
}

export async function salvarEstadoSincronizacao(estado: Omit<EstadoSincronizacao, 'chave'>): Promise<void> {
  await db.estadoSincronizacao.put({ ...estado, chave: CHAVE_ESTADO });
}

/** Exclusao logica local. Enfileira, porque precisa propagar. */
export async function excluirTransacao(id: string): Promise<void> {
  await db.transaction('rw', db.transacoes, db.pendencias, async () => {
    const transacao = await db.transacoes.get(id);
    if (transacao === undefined || transacao.deletedAt !== null) {
      return;
    }
    const instante = agoraISO();
    const excluida: Transacao = { ...transacao, deletedAt: instante, updatedAt: instante };
    await db.transacoes.put(excluida);
    await enfileirar(excluida);
  });
}

/* ------------------------------------------------------------------ *
 * Categorias: escrita
 * ------------------------------------------------------------------ */

/**
 * Categoria nao entra na fila de envio: o contrato de sincronizacao de
 * `src/api/contratos.ts` cobre so transacao. Quando o servidor passar a aceitar
 * categoria, e aqui que o enfileirar() entra.
 */
export class LimiteDeCategoriasAtingido extends Error {
  constructor(tipo: Categoria['tipo']) {
    super(
      `Ja existem ${MAXIMO_DE_CATEGORIAS.toString()} categorias de ${tipo}; o limite e ${MAXIMO_DE_CATEGORIAS.toString()}.`,
    );
    this.name = 'LimiteDeCategoriasAtingido';
  }
}

/**
 * O teto e conferido DENTRO da mesma transacao da escrita. Conferir so na tela
 * deixaria passar a decima categoria criada em duas abas ao mesmo tempo — raro,
 * mas e o tipo de furo que so aparece depois, com a grade ja estourada.
 */
export async function criarCategoria(rascunho: Rascunho<Categoria>): Promise<Categoria> {
  const categoria: Categoria = {
    ...rascunho,
    nome: rascunho.nome.trim(),
    id: novoId(),
    updatedAt: agoraISO(),
    deletedAt: null,
  };

  await db.transaction('rw', db.categorias, async () => {
    const existentes = (await db.categorias.where('tipo').equals(categoria.tipo).toArray()).filter(
      ativo,
    );
    if (existentes.length >= MAXIMO_DE_CATEGORIAS) {
      throw new LimiteDeCategoriasAtingido(categoria.tipo);
    }
    await db.categorias.add(categoria);
  });

  return categoria;
}

/** Liga/desliga o destaque. So mexe em `favorita` — nome e cor sao outra acao. */
export async function alternarFavorita(id: string): Promise<void> {
  const categoria = await db.categorias.get(id);
  if (categoria === undefined || categoria.deletedAt !== null) {
    return;
  }
  await db.categorias.update(id, { favorita: !categoria.favorita, updatedAt: agoraISO() });
}

/** Renomear e recolorir. O tipo NAO muda: ver excluirCategoria. */
export async function atualizarCategoria(
  id: string,
  campos: { nome: string; cor: string },
): Promise<void> {
  await db.categorias.update(id, {
    nome: campos.nome.trim(),
    cor: campos.cor,
    updatedAt: agoraISO(),
  });
}

/**
 * Exclusao logica. As transacoes que apontam para ela continuam apontando e
 * passam a aparecer como "Sem categoria" — de proposito: apagar o vinculo
 * reescreveria lancamentos ja fechados, e o historico de um extrato nao muda
 * porque a pessoa arrumou a lista de categorias hoje.
 */
export async function excluirCategoria(id: string): Promise<void> {
  const categoria = await db.categorias.get(id);
  if (categoria === undefined || categoria.deletedAt !== null) {
    return;
  }
  const instante = agoraISO();
  await db.categorias.put({ ...categoria, deletedAt: instante, updatedAt: instante });
}

/** Quantos lancamentos ativos usam a categoria. Alimenta o aviso antes de excluir. */
export async function contarUsosDaCategoria(id: string): Promise<number> {
  const transacoes = await db.transacoes.where('categoriaId').equals(id).toArray();
  return transacoes.filter(ativo).length;
}

/* ------------------------------------------------------------------ *
 * Series para os graficos
 * ------------------------------------------------------------------ */

export interface SaldoMensal extends MovimentoMensal {
  /** Saldo acumulado AO FIM do mes: tudo que entrou menos tudo que saiu ate ali. */
  saldo: Centavos;
}

/**
 * Curva de saldo: a janela de meses com o acumulado ao fim de cada um.
 *
 * O acumulado nao comeca em zero na primeira barra da janela — ele parte do que
 * ja existia ANTES dela. Sem isso, o grafico de quem tem seis meses de historico
 * mostraria a mesma curva de quem abriu o app ontem, e as duas coisas nao sao a
 * mesma.
 */
export async function serieDeSaldo(mesFinal: MesISO, quantidade: number): Promise<SaldoMensal[]> {
  const meses = await movimentoPorMes(mesFinal, quantidade);
  const primeiro = meses.at(0);
  if (primeiro === undefined) {
    return [];
  }

  const anteriores = (
    await db.transacoes.where('data').below(primeiroDiaDoMes(primeiro.mes)).toArray()
  ).filter(ativo);

  const total = (tipo: Transacao['tipo']): Centavos =>
    somarLista(anteriores.filter((t) => t.tipo === tipo).map((t) => t.valor));

  let acumulado: number = subtrair(total('entrada'), total('saida'));

  return meses.map((mes) => {
    acumulado += mes.resultado;
    return { ...mes, saldo: centavos(acumulado) };
  });
}

export interface ComparacaoDeCategoria {
  categoriaId: string;
  nome: string;
  cor: string;
  atual: Centavos;
  anterior: Centavos;
  /** Participacao no total de saidas do mes atual, 0..1. */
  fracao: number;
}

/**
 * Saidas por categoria do mes, lado a lado com o mesmo recorte no mes anterior.
 *
 * Inclui categoria que so aparece num dos dois meses: "parei de gastar com isso"
 * e "comecei a gastar com isso" sao as duas leituras mais uteis da tela, e as
 * duas sumiriam num inner join.
 */
export async function compararCategorias(mes: MesISO): Promise<ComparacaoDeCategoria[]> {
  const [atual, anterior] = await Promise.all([
    gastosPorCategoriaDoMes(mes),
    gastosPorCategoriaDoMes(mesAnterior(mes)),
  ]);

  const porId = new Map<string, ComparacaoDeCategoria>();

  for (const item of atual) {
    porId.set(item.categoriaId, {
      categoriaId: item.categoriaId,
      nome: item.nome,
      cor: item.cor,
      atual: item.total,
      anterior: ZERO,
      fracao: item.fracao,
    });
  }

  for (const item of anterior) {
    const existente = porId.get(item.categoriaId);
    if (existente === undefined) {
      porId.set(item.categoriaId, {
        categoriaId: item.categoriaId,
        nome: item.nome,
        cor: item.cor,
        atual: ZERO,
        anterior: item.total,
        fracao: 0,
      });
      continue;
    }
    existente.anterior = item.total;
  }

  return [...porId.values()].sort((a, b) => b.atual - a.atual || b.anterior - a.anterior);
}

/** Os N maiores lancamentos do mes, do maior para o menor. */
export async function maioresDoMes(mes: MesISO, limite: number): Promise<Transacao[]> {
  const transacoes = await listarTransacoesDoMes(mes);
  return [...transacoes].sort((a, b) => b.valor - a.valor).slice(0, limite);
}
