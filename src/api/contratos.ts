/**
 * O contrato de fio, transcrito dos DTOs de
 * `backend/src/Financeiro.Application/Transacoes/Dtos/`.
 *
 * Tudo que chega da rede entra aqui como `unknown` e so vira tipo do dominio
 * depois de passar pelos construtores de `src/types` (`centavos`, `dataISO`).
 * Nada de `as Transacao` em cima do JSON: o servidor pode mandar `12.5` em
 * `valor` ou `"14/09/2026"` em `data`, e um cast poria isso dentro do IndexedDB
 * sem um unico erro — para so quebrar semanas depois, na hora de somar o mes.
 */
import type { Centavos, DataISO, TipoMovimento, Transacao } from '../types';
import { centavos, dataISO } from '../types';

export interface TransacaoFio {
  readonly id: string;
  readonly tipo: string;
  readonly valor: number;
  readonly data: string;
  readonly categoriaId: string;
  readonly descricao: string;
  readonly contaId: string | null;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export type SituacaoItem = 'criada' | 'atualizada' | 'descartada' | 'rejeitada';

export interface ResultadoItemFio {
  readonly id: string;
  readonly situacao: SituacaoItem;
  readonly motivo: string | null;
}

export interface RequisicaoSincronizacaoFio {
  readonly transacoes: readonly TransacaoFio[];
  readonly desde: string | null;
  readonly ultimoId: string | null;
  readonly limite: number;
}

export interface RespostaSincronizacaoFio {
  readonly transacoes: readonly TransacaoFio[];
  readonly resultados: readonly ResultadoItemFio[];
  readonly proximoDesde: string | null;
  readonly proximoUltimoId: string | null;
  readonly temMais: boolean;
  readonly servidorEm: string;
}

export interface RespostaTokenFio {
  readonly token: string;
  readonly expiraEm: string;
  /** Nome de exibicao. Nulo em conta criada antes do campo existir. */
  readonly nome: string | null;
}

export interface RespostaErroFio {
  readonly erro: string;
  readonly detalhes: readonly string[];
}

/* ------------------------------------------------------------------ *
 * Leitores defensivos: unknown -> tipo de fio, ou null
 * ------------------------------------------------------------------ */

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(fonte: Record<string, unknown>, chave: string): string | null {
  const valor = fonte[chave];
  return typeof valor === 'string' ? valor : null;
}

/**
 * Campo que o contrato declara anulavel. `undefined` conta como null porque o
 * System.Text.Json pode estar configurado para omitir nulos — a ausencia e a
 * mesma informacao.
 */
function textoAnulavel(fonte: Record<string, unknown>, chave: string): { ok: true; valor: string | null } | { ok: false } {
  const valor = fonte[chave];
  if (valor === null || valor === undefined) {
    return { ok: true, valor: null };
  }
  return typeof valor === 'string' ? { ok: true, valor } : { ok: false };
}

function inteiro(fonte: Record<string, unknown>, chave: string): number | null {
  const valor = fonte[chave];
  return typeof valor === 'number' && Number.isSafeInteger(valor) ? valor : null;
}

function lista(valor: unknown): readonly unknown[] | null {
  return Array.isArray(valor) ? valor : null;
}

export function lerTransacaoFio(bruto: unknown): TransacaoFio | null {
  if (!ehObjeto(bruto)) {
    return null;
  }
  const id = texto(bruto, 'id');
  const tipo = texto(bruto, 'tipo');
  const valor = inteiro(bruto, 'valor');
  const data = texto(bruto, 'data');
  const categoriaId = texto(bruto, 'categoriaId');
  const descricao = texto(bruto, 'descricao');
  const updatedAt = texto(bruto, 'updatedAt');
  const contaId = textoAnulavel(bruto, 'contaId');
  const deletedAt = textoAnulavel(bruto, 'deletedAt');

  if (
    id === null ||
    tipo === null ||
    valor === null ||
    data === null ||
    categoriaId === null ||
    descricao === null ||
    updatedAt === null ||
    !contaId.ok ||
    !deletedAt.ok
  ) {
    return null;
  }

  return { id, tipo, valor, data, categoriaId, descricao, updatedAt, contaId: contaId.valor, deletedAt: deletedAt.valor };
}

const SITUACOES: readonly SituacaoItem[] = ['criada', 'atualizada', 'descartada', 'rejeitada'];

function ehSituacao(valor: string): valor is SituacaoItem {
  return (SITUACOES as readonly string[]).includes(valor);
}

export function lerResultadoItemFio(bruto: unknown): ResultadoItemFio | null {
  if (!ehObjeto(bruto)) {
    return null;
  }
  const id = texto(bruto, 'id');
  const situacao = texto(bruto, 'situacao');
  const motivo = textoAnulavel(bruto, 'motivo');
  if (id === null || situacao === null || !ehSituacao(situacao) || !motivo.ok) {
    return null;
  }
  return { id, situacao, motivo: motivo.valor };
}

export function lerRespostaSincronizacao(bruto: unknown): RespostaSincronizacaoFio | null {
  if (!ehObjeto(bruto)) {
    return null;
  }
  const brutasTransacoes = lista(bruto['transacoes']);
  const brutosResultados = lista(bruto['resultados']);
  const servidorEm = texto(bruto, 'servidorEm');
  const proximoDesde = textoAnulavel(bruto, 'proximoDesde');
  const proximoUltimoId = textoAnulavel(bruto, 'proximoUltimoId');
  const temMais = bruto['temMais'];

  if (
    brutasTransacoes === null ||
    brutosResultados === null ||
    servidorEm === null ||
    !proximoDesde.ok ||
    !proximoUltimoId.ok ||
    typeof temMais !== 'boolean'
  ) {
    return null;
  }

  const transacoes: TransacaoFio[] = [];
  for (const item of brutasTransacoes) {
    const fio = lerTransacaoFio(item);
    if (fio === null) {
      return null;
    }
    transacoes.push(fio);
  }

  const resultados: ResultadoItemFio[] = [];
  for (const item of brutosResultados) {
    const resultado = lerResultadoItemFio(item);
    if (resultado === null) {
      return null;
    }
    resultados.push(resultado);
  }

  return {
    transacoes,
    resultados,
    proximoDesde: proximoDesde.valor,
    proximoUltimoId: proximoUltimoId.valor,
    temMais,
    servidorEm,
  };
}

export function lerRespostaToken(bruto: unknown): RespostaTokenFio | null {
  if (!ehObjeto(bruto)) {
    return null;
  }
  const token = texto(bruto, 'token');
  const expiraEm = texto(bruto, 'expiraEm');
  // Anulavel, nao opcional: ausencia de nome e um estado previsto (conta antiga),
  // enquanto um nome que venha como numero e resposta fora do contrato.
  const nome = textoAnulavel(bruto, 'nome');
  if (token === null || expiraEm === null || !nome.ok) {
    return null;
  }
  return { token, expiraEm, nome: nome.valor };
}

/** Corpo de erro do backend. Tolerante: um 500 do pipeline pode nao ter esse formato. */
export function lerRespostaErro(bruto: unknown): RespostaErroFio | null {
  if (!ehObjeto(bruto)) {
    return null;
  }
  const erro = texto(bruto, 'erro');
  if (erro === null) {
    return null;
  }
  const brutosDetalhes = lista(bruto['detalhes']) ?? [];
  const detalhes = brutosDetalhes.filter((d): d is string => typeof d === 'string');
  return { erro, detalhes };
}

/* ------------------------------------------------------------------ *
 * Fio <-> dominio
 * ------------------------------------------------------------------ */

function lerTipoMovimento(valor: string): TipoMovimento | null {
  return valor === 'entrada' || valor === 'saida' ? valor : null;
}

/**
 * Converte para o dominio ou devolve null. Nao lanca: um registro torto vindo do
 * servidor nao pode derrubar o lote inteiro — o ciclo pula esse e segue com o
 * resto, senao uma linha ruim travaria a sincronizacao para sempre.
 */
export function paraTransacao(fio: TransacaoFio): Transacao | null {
  const tipo = lerTipoMovimento(fio.tipo);
  if (tipo === null) {
    return null;
  }

  let valor: Centavos;
  let data: DataISO;
  try {
    valor = centavos(fio.valor);
    data = dataISO(fio.data);
  } catch {
    return null;
  }

  if (fio.id === '' || fio.categoriaId === '' || fio.updatedAt === '') {
    return null;
  }

  return {
    id: fio.id,
    tipo,
    valor,
    data,
    categoriaId: fio.categoriaId,
    descricao: fio.descricao,
    contaId: fio.contaId,
    updatedAt: fio.updatedAt,
    deletedAt: fio.deletedAt,
  };
}

/** Dominio -> fio. `valor` ja e inteiro por construcao do branded type. */
export function paraTransacaoFio(transacao: Transacao): TransacaoFio {
  return {
    id: transacao.id,
    tipo: transacao.tipo,
    valor: transacao.valor,
    data: transacao.data,
    categoriaId: transacao.categoriaId,
    descricao: transacao.descricao,
    contaId: transacao.contaId,
    updatedAt: transacao.updatedAt,
    deletedAt: transacao.deletedAt,
  };
}
