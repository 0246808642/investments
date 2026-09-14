import { db } from './db';
import type { Categoria, Centavos, DataISO, MesISO, Rascunho, Transacao } from '../types';
import {
  agoraISO,
  ativo,
  centavos,
  dataISO,
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

export async function listarCategorias(): Promise<Categoria[]> {
  const categorias = await db.categorias.toArray();
  return categorias
    .filter(ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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

export async function criarTransacao(rascunho: Rascunho<Transacao>): Promise<Transacao> {
  const transacao: Transacao = {
    ...rascunho,
    id: novoId(),
    updatedAt: agoraISO(),
    deletedAt: null,
  };
  await db.transacoes.add(transacao);
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
