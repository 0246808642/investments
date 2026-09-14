import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import type * as React from 'react';

import {
  RESUMO_VAZIO,
  gastosPorCategoriaDoMes,
  indexarPorId,
  listarCategorias,
  listarTransacoesDoMes,
  resumirMes,
  serieDeSaldo,
} from '../../db/consultas';
import type { Categoria, DataISO, MesISO, Transacao } from '../../types';
import { idiomaAtual, useTextos } from '../../i18n';
import { NOME_DO_APP } from '../../marca';
import type { Textos } from '../../i18n';
import {
  MENOS,
  centavos,
  formatarDataComSemana,
  formatarMesTitulo,
  formatarMoeda,
} from '../../types';

interface FolhaDeImpressaoProps {
  mes: MesISO;
  /** Chamado uma unica vez, quando TODO o conteudo ja esta no DOM. */
  aoFicarPronta?: () => void;
}

/**
 * O extrato do mes em forma de documento — a folha que vira PDF.
 *
 * Nao existe biblioteca de PDF aqui de proposito. O navegador ja tem um gerador
 * de PDF melhor do que qualquer uma delas: ele quebra pagina sozinho, respeita o
 * tamanho de papel da pessoa, mantem o texto selecionavel e pesquisavel, e nao
 * custa 300 KB no bundle. O que faltava era uma folha que valesse a pena
 * imprimir, e e isso que este componente e.
 *
 * Fora da impressao ela nao ocupa espaco nenhum (classe `so-impressao`), entao
 * pode ser montada em cima do app sem mexer no layout da tela.
 */
export function FolhaDeImpressao({ mes, aoFicarPronta }: FolhaDeImpressaoProps): React.JSX.Element {
  const transacoes = useLiveQuery(() => listarTransacoesDoMes(mes), [mes]);
  const categorias = useLiveQuery(() => listarCategorias(), []);
  const gastos = useLiveQuery(() => gastosPorCategoriaDoMes(mes), [mes]);
  const curva = useLiveQuery(() => serieDeSaldo(mes, 1), [mes]);
  const t = useTextos();

  const carregando =
    transacoes === undefined ||
    categorias === undefined ||
    gastos === undefined ||
    curva === undefined;

  // Avisa quando o conteudo REAL esta montado. Em ref callback isso seria fragil:
  // o React 19 trata o retorno do callback como funcao de limpeza.
  useEffect(() => {
    if (!carregando) {
      aoFicarPronta?.();
    }
  }, [carregando, aoFicarPronta]);

  const porId = indexarPorId<Categoria>(categorias ?? []);
  const resumo = transacoes === undefined ? RESUMO_VAZIO : resumirMes(transacoes);
  const saldoFinal = curva?.at(0)?.saldo ?? null;

  // Cronologico na impressao, e nao do mais recente para o mais antigo: extrato
  // impresso se le como um relato do mes, do dia 1 para a frente.
  const dias = agruparPorDia([...(transacoes ?? [])].reverse());

  if (carregando) {
    return <div className="so-impressao" aria-hidden="true" />;
  }

  return (
    <div className="so-impressao">
      <header className="impressao-cabecalho">
        <div>
          <p className="impressao-marca">{NOME_DO_APP}</p>
          <h1 className="impressao-titulo">{t.impressao.extratoDe(formatarMesTitulo(mes))}</h1>
        </div>
        <p className="impressao-meta">
          {t.impressao.geradoEm(
            new Date().toLocaleString(idiomaAtual(), { dateStyle: 'short', timeStyle: 'short' }),
          )}
        </p>
      </header>

      <section className="impressao-resumo">
        <Celula rotulo={t.comum.entrou} valor={formatarMoeda(resumo.entradas)} />
        <Celula rotulo={t.comum.saiu} valor={formatarMoeda(resumo.saidas)} />
        <Celula rotulo={t.impressao.resultadoDoMes} valor={formatarMoeda(resumo.saldo)} destaque />
        <Celula
          rotulo={t.impressao.saldoAoFim}
          valor={saldoFinal === null ? '—' : formatarMoeda(saldoFinal)}
        />
      </section>

      {gastos.length === 0 ? null : (
        <section className="impressao-secao">
          <h2 className="impressao-secao-titulo">{t.impressao.saidasPorCategoria}</h2>
          <table className="impressao-tabela">
            <thead>
              <tr>
                <th scope="col">{t.impressao.categoria}</th>
                <th scope="col" className="direita">
                  {t.impressao.valor}
                </th>
                <th scope="col" className="direita">
                  {t.impressao.peso}
                </th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((item) => (
                <tr key={item.categoriaId}>
                  <td>{item.nome}</td>
                  <td className="direita numero">{formatarMoeda(item.total)}</td>
                  <td className="direita numero">{Math.round(item.fracao * 100)}%</td>
                </tr>
              ))}
              <tr className="impressao-total">
                <td>{t.impressao.total}</td>
                <td className="direita numero">{formatarMoeda(resumo.saidas)}</td>
                <td className="direita numero">100%</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section className="impressao-secao">
        <h2 className="impressao-secao-titulo">
          {t.impressao.lancamentos}
          <span className="impressao-contagem">{t.comum.lancamentos(transacoes.length)}</span>
        </h2>

        {dias.length === 0 ? (
          <p className="impressao-vazio">{t.impressao.semLancamentos}</p>
        ) : (
          <table className="impressao-tabela">
            <thead>
              <tr>
                <th scope="col">{t.impressao.data}</th>
                <th scope="col">{t.impressao.descricao}</th>
                <th scope="col">{t.impressao.categoria}</th>
                <th scope="col" className="direita">
                  {t.impressao.valor}
                </th>
              </tr>
            </thead>
            <tbody>
              {dias.map((dia) => (
                <Dia key={dia.data} dia={dia} porId={porId} textos={t} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="impressao-rodape">{t.impressao.rodape}</footer>
    </div>
  );
}

function Celula({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}): React.JSX.Element {
  return (
    <div className={destaque ? 'impressao-celula destaque' : 'impressao-celula'}>
      <p className="impressao-celula-rotulo">{rotulo}</p>
      <p className="impressao-celula-valor numero">{valor}</p>
    </div>
  );
}

interface DiaAgrupado {
  data: DataISO;
  itens: Transacao[];
  liquido: number;
}

/**
 * O cabecalho de dia entra como linha da propria tabela, e nao como tabela nova
 * por dia: em papel, cada tabela recomeca o cabecalho de coluna, e um mes com
 * vinte dias de movimento viraria vinte repeticoes de "Data | Descrição | ...".
 */
function Dia({
  dia,
  porId,
  textos: t,
}: {
  dia: DiaAgrupado;
  porId: Map<string, Categoria>;
  textos: Textos;
}): React.JSX.Element {
  return (
    <>
      <tr className="impressao-dia">
        <th scope="colgroup" colSpan={3}>
          {formatarDataComSemana(dia.data)}
        </th>
        <td className="direita numero">
          {dia.liquido < 0 ? MENOS : '+'}
          {formatarMoeda(centavos(Math.abs(dia.liquido)))}
        </td>
      </tr>

      {dia.itens.map((transacao) => {
        const categoria = porId.get(transacao.categoriaId);
        const descricao = transacao.descricao.trim();
        const nome = categoria?.nome ?? t.comum.semCategoria;
        const ehEntrada = transacao.tipo === 'entrada';

        return (
          <tr key={transacao.id}>
            <td className="numero">{transacao.data.slice(8, 10)}</td>
            <td>{descricao === '' ? nome : descricao}</td>
            <td>{nome}</td>
            <td className="direita numero">
              {ehEntrada ? '+' : MENOS}
              {formatarMoeda(transacao.valor)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function agruparPorDia(transacoes: readonly Transacao[]): DiaAgrupado[] {
  const dias: DiaAgrupado[] = [];

  for (const transacao of transacoes) {
    const atual = dias.at(-1);
    const delta = transacao.tipo === 'entrada' ? transacao.valor : -transacao.valor;

    if (atual !== undefined && atual.data === transacao.data) {
      atual.itens.push(transacao);
      atual.liquido += delta;
      continue;
    }
    dias.push({ data: transacao.data, itens: [transacao], liquido: delta });
  }

  return dias;
}
